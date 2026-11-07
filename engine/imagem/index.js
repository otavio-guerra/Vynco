'use strict'
// Geração e melhoria de imagens no Vynco, com qualquer provedor que siga a interface de engine/imagem/provedores/.
// - pedir(): confere chave e limites do mês, inicia uma tarefa por versão e guarda tudo em workspace/imagens/tarefas.json
// - um laço consulta as tarefas em andamento e, quando ficam prontas, baixa as imagens na hora para a biblioteca
//   (workspace/midia), com prompt, provedor, operação, custo estimado e a imagem "mãe" (quando é uma melhoria)
// - workspace/imagens/custos.json é o livro de gastos: uma linha por operação, com o valor estimado quando o provedor publica o preço
// A chave de cada provedor fica no cofre (imagem.<provedor>.chave) e só é usada aqui, no servidor.
const fs = require('fs')
const path = require('path')
const C = require('../config.js')
const S = require('../segredos.js')
const M = require('../midia.js')

const PROVEDORES = { magnific: require('./provedores/magnific.js') }
const DIR = C.ws('imagens'), TAREFAS = path.join(DIR, 'tarefas.json'), CUSTOS = path.join(DIR, 'custos.json')
const VALIDADE = 28 * 60 * 1000   // os links do provedor vencem em 30 min: depois disso, a tarefa é dada como perdida
const PADRAO = { limiteMensal: 30, orcamentoMensal: 10 }

const ler = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const gravar = (p, o) => { fs.mkdirSync(DIR, { recursive: true }); const tmp = p + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o, null, 2), 'utf8'); fs.renameSync(tmp, p) }
const mes = (t = Date.now()) => new Date(t).toISOString().slice(0, 7)
const config = () => ({ ...PADRAO, ...(C.load().imagens || {}) })
const chave = id => S.get(`imagem.${id}.chave`)
const provedor = id => { const p = PROVEDORES[id]; if (!p) throw new Error('provedor de imagem desconhecido'); return p }

function uso() {
  const linhas = ler(CUSTOS, []).filter(l => mes(Date.parse(l.quando)) === mes())
  return { mes: mes(), operacoes: linhas.length, gasto: +linhas.reduce((s, l) => s + (l.valor || 0), 0).toFixed(2), semPreco: linhas.filter(l => l.valor == null).length, ...config() }
}
function lista() { return ler(TAREFAS, []).slice(0, 20) }
function provedores() {
  return Object.values(PROVEDORES).map(p => ({ id: p.id, nome: p.nome, site: p.site, docs: p.docs, chaveUrl: p.chaveUrl, nota: p.nota, recursos: p.recursos, temChave: !!chave(p.id) }))
}
async function salvarChave(id, valor) {
  const p = provedor(id); valor = String(valor || '').trim()
  if (!valor) { S.del(`imagem.${id}.chave`); return { ok: true, removida: true } }
  await p.validar(valor)   // não gasta créditos
  S.set(`imagem.${id}.chave`, valor)
  return { ok: true }
}

// a imagem de origem (melhorar e refinar) vem da biblioteca
function origemDe(arquivo) {
  if (!arquivo) return null
  const item = M.listar().find(i => i.arquivo === arquivo)
  if (!item || !['imagem', 'gif'].includes(item.tipo)) throw new Error('escolha uma imagem da biblioteca')
  return item
}
function estimar({ provedor: id, op, params = {}, origem, versoes = 1 }) {
  const p = provedor(id), o = origemDe(origem)
  const n = op === 'gerar' ? Math.max(1, Math.min(+versoes || 1, p.recursos.gerar.maxVersoes)) : 1
  const e = p.estimar(op, params, o || {})
  return { ...e, versoes: n, total: e.valor == null ? null : +(e.valor * n).toFixed(2), uso: uso() }
}

async function pedir(pedido) {
  const { provedor: id, op } = pedido, p = provedor(id)
  if (!p.recursos[op]) throw new Error('operação não disponível neste provedor')
  const k = chave(id); if (!k) throw new Error(`Salve a chave da API do ${p.nome} em Ajustes antes.`)
  const params = { ...(pedido.params || {}) }
  if (op === 'gerar' && !String(params.prompt || '').trim()) throw new Error('Descreva a imagem que você quer.')
  const est = estimar(pedido), u = est.uso
  if (u.operacoes + est.versoes > u.limiteMensal) throw new Error(`Isso passaria do limite de ${u.limiteMensal} operações neste mês (já foram ${u.operacoes}). Dá para mudar o limite em Ajustes.`)
  if (est.total != null && u.gasto + est.total > u.orcamentoMensal) throw new Error(`Isso passaria do orçamento de €${u.orcamentoMensal} neste mês (estimativa já usada: €${u.gasto}). Dá para mudar em Ajustes.`)
  const o = origemDe(pedido.origem)
  if (op === 'melhorar' && o && o.largura) {
    const f = parseInt(params.scale_factor || '2x'), max = p.recursos.melhorar.maxPixels
    if (o.largura * f * o.altura * f > max) throw new Error(`Com ${params.scale_factor || '2x'} a imagem passaria de ${(max / 1e6).toFixed(1)} milhões de pixels, o máximo do ${p.nome}. Escolha um fator menor.`)
  }
  const imagem = o ? fs.readFileSync(M.caminho(o.arquivo)).toString('base64') : undefined
  if (op === 'gerar' && params.estiloArquivo) { const e = origemDe(params.estiloArquivo); params.estilo = fs.readFileSync(M.caminho(e.arquivo)).toString('base64') }

  const job = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), provedor: id, op, criado: Date.now(), estado: 'rodando', origem: o ? o.arquivo : null, prompt: params.prompt || null, params: semBase64(params), estimativa: est, itens: [] }
  const custos = ler(CUSTOS, [])
  for (let v = 0; v < est.versoes; v++) {
    try {
      const t = await p.iniciar(op, params, k, imagem)
      job.itens.push({ ...t, estado: 'rodando' })
      custos.push({ quando: new Date().toISOString(), provedor: id, op, valor: est.valor, aPartir: !!est.aPartir, tarefa: t.tarefa, job: job.id })
    } catch (e) {
      if (!job.itens.length) throw e   // a primeira falhou: nada foi pedido
      job.itens.push({ estado: 'falhou', erro: e.message })
    }
  }
  gravar(CUSTOS, custos)
  const todas = ler(TAREFAS, []); todas.unshift(job); gravar(TAREFAS, todas.slice(0, 100))
  acordar()
  return job
}
const semBase64 = p => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'estilo'))

// ---------------------------------------------------------------- laço de consulta (só roda enquanto há tarefa em andamento)
let laco = null, ocupado = false
function acordar() { if (!laco) laco = setInterval(rodada, 4000) }
async function rodada() {
  if (ocupado) return; ocupado = true
  try {
    const todas = ler(TAREFAS, []), vivas = todas.filter(j => j.estado === 'rodando')
    if (!vivas.length) { clearInterval(laco); laco = null; return }
    for (const job of vivas) {
      const p = PROVEDORES[job.provedor], k = chave(job.provedor)
      for (const item of job.itens.filter(i => i.estado === 'rodando')) {
        if (Date.now() - job.criado > VALIDADE) { Object.assign(item, { estado: 'falhou', erro: 'O tempo acabou: os links do provedor vencem em 30 minutos.' }); continue }
        if (!p || !k) { Object.assign(item, { estado: 'falhou', erro: 'A chave do provedor foi removida.' }); continue }
        try {
          const r = await p.consultar(item, k)
          if (r.estado === 'pronto') {
            const arquivos = []
            for (const [n, url] of (r.urls || []).entries()) arquivos.push(await baixar(job, url, n))
            Object.assign(item, { estado: 'pronto', arquivos })
          } else if (r.estado === 'falhou') Object.assign(item, { estado: 'falhou', erro: r.erro })
        } catch (e) { if (e.status === 401 || e.status === 403) Object.assign(item, { estado: 'falhou', erro: e.message }) }   // erro passageiro: tenta na próxima rodada
      }
      if (job.itens.every(i => i.estado !== 'rodando')) { job.estado = job.itens.some(i => i.estado === 'pronto') ? 'pronto' : 'falhou'; job.fim = Date.now() }
    }
    // grava por cima do que está no disco agora (outra tarefa pode ter entrado durante a rodada)
    const atual = ler(TAREFAS, []), porId = Object.fromEntries(todas.map(j => [j.id, j]))
    gravar(TAREFAS, atual.map(j => porId[j.id] && j.estado === 'rodando' ? porId[j.id] : j))
  } finally { ocupado = false }
}
// baixa na hora (o link vence) e guarda na biblioteca com a origem de tudo
async function baixar(job, url, n) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) })
  if (!r.ok) throw new Error('não consegui baixar a imagem pronta (' + r.status + ')')
  const tipo = r.headers.get('content-type') || '', ext = /png/.test(tipo) || /\.png(\?|$)/i.test(url) ? 'png' : 'jpg'
  const base = job.op === 'gerar' ? (job.prompt || 'imagem').slice(0, 40) : `${path.basename(job.origem || 'imagem').replace(/\.[^.]+$/, '')}-${job.op === 'melhorar' ? 'melhorada' : 'refinada'}`
  const p = PROVEDORES[job.provedor]
  const item = M.guardar(`${base}${n ? '-' + (n + 1) : ''}.${ext}`, Buffer.from(await r.arrayBuffer()), {
    origem: job.provedor, provedor: p ? p.nome : job.provedor, op: job.op, prompt: job.prompt || undefined,
    custo: job.estimativa && job.estimativa.valor != null ? { valor: job.estimativa.valor, moeda: job.estimativa.moeda, estimado: true } : undefined,
    mae: job.origem || undefined, tarefa: job.id,
  })
  return item.arquivo
}

// ao subir o servidor, retoma o que ficou em andamento
function retomar() { if (ler(TAREFAS, []).some(j => j.estado === 'rodando')) acordar() }

module.exports = { provedores, salvarChave, estimar, pedir, lista, uso, retomar, PROVEDORES }
