'use strict'
// Rede: conexões e vagas sugeridas pela sua IA a partir do perfil.
// A API do LinkedIn não dá acesso a busca de pessoas, conexões nem vagas para apps comuns, e automatizar isso viola
// os termos do LinkedIn. Então: a IA pesquisa na web (só leitura), sugere TIPOS de pessoas (nunca nomes inventados)
// com a busca pronta para abrir no próprio LinkedIn, e lista vagas públicas cujo link é conferido antes de aparecer.
// Convites e candidaturas são sempre feitos pela pessoa.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')
const PERFIS = require('./perfis.js')

const arq = id => path.join(C.ws('perfis'), id, 'rede.json')
const ler = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const txt = (v, n = 300) => String(v ?? '').trim().slice(0, n)
const buscaPessoas = q => 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q)
const buscaVagas = (q, local) => 'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(q) + (local ? '&location=' + encodeURIComponent(local) : '')

function carregar(id) { return ler(arq(id), { conexoes: [], seguir: [], vagas: [], prefs: {} }) }

function prompt(p, tipo, prefs) {
  const vagas = tipo !== 'conexoes'
  return `Você vai ajudar uma pessoa a crescer no LinkedIn. Responda em português do Brasil.

${PERFIS.resumo(p)}
Preferências para vagas: local "${prefs.local || 'não informado'}", modalidade "${prefs.modalidade || 'qualquer'}", senioridade "${prefs.senioridade || 'não informada'}".

Tarefa:
1. CONEXÕES: sugira de 6 a 8 TIPOS de pessoas para ela se conectar (cargos ou perfis, nunca nomes de pessoas reais), por que cada tipo ajuda o objetivo dela, as palavras-chave para buscar no LinkedIn e uma mensagem de convite curta (até 200 caracteres), no tom do perfil, sem prometer nada que ela não informou. Sugira também até 5 comunidades, eventos recorrentes ou hashtags para seguir na área dela.
${vagas ? `2. VAGAS: pesquise na web vagas publicadas nos últimos 30 dias que combinem com a área, o objetivo, o local, a modalidade e a senioridade. Inclua só vagas cuja página você realmente abriu, com o link direto da vaga. Até 8. Não invente vagas, empresas, salários nem links. Se não achar nenhuma, devolva a lista vazia.` : ''}

Responda SOMENTE com um bloco JSON neste formato:
{"conexoes": [{"perfil": "", "por_que": "", "busca": "", "convite": ""}], "seguir": [{"nome": "", "tipo": "comunidade|evento|hashtag", "por_que": ""}]${vagas ? ', "vagas": [{"titulo": "", "empresa": "", "local": "", "modalidade": "", "link": "", "por_que": "", "publicada": ""}]' : ''}}`
}

// confere cada link de vaga: some o que não existe (404, 410, endereço inválido); fica marcado o que o site não deixa conferir
async function conferir(link) {
  if (!/^https?:\/\/[^\s"<>]+$/i.test(link || '')) return 'invalido'
  try {
    const r = await fetch(link, { redirect: 'follow', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 (Farol)' } })
    if (r.status < 400) return 'ok'
    return [404, 410].includes(r.status) ? 'quebrado' : 'bloqueado'   // 403, 429 e o 999 do LinkedIn: o site barra robôs
  } catch { return 'quebrado' }
}

let JOB = null
function buscar(id, agente, perguntar, { tipo = 'ambos', local = '', modalidade = '', senioridade = '' } = {}) {
  if (JOB && JOB.estado === 'rodando') throw new Error('Já tem uma busca em andamento.')
  const p = PERFIS.carregar(id)
  if (!p.area && !p.temas.length && !p.sobre) throw new Error('Conte a sua área no Perfil antes: é dela que saem as sugestões.')
  const prefs = { local: txt(local, 80), modalidade: txt(modalidade, 40), senioridade: txt(senioridade, 40) }
  JOB = { id, tipo, estado: 'rodando', inicio: Date.now() }
  const J = JOB
  perguntar(agente, prompt(p, tipo, prefs), { timeout: 420000 }).then(async saida => {
    const r = PERFIS.extrairJSON(saida), antes = carregar(id)
    const conexoes = (r.conexoes || []).slice(0, 10).map(c => ({ perfil: txt(c.perfil, 120), por_que: txt(c.por_que), busca: txt(c.busca, 120), convite: txt(c.convite, 300) })).filter(c => c.perfil)
      .map(c => ({ ...c, url: buscaPessoas(c.busca || c.perfil) }))
    const seguir = (r.seguir || []).slice(0, 6).map(s => ({ nome: txt(s.nome, 100), tipo: txt(s.tipo, 20), por_que: txt(s.por_que, 200) })).filter(s => s.nome)
    let vagas = antes.vagas, descartadas = 0
    if (tipo !== 'conexoes') {
      const brutas = (r.vagas || []).slice(0, 10).map(v => ({ titulo: txt(v.titulo, 140), empresa: txt(v.empresa, 100), local: txt(v.local, 100), modalidade: txt(v.modalidade, 40), link: txt(v.link, 600), por_que: txt(v.por_que), publicada: txt(v.publicada, 40) })).filter(v => v.titulo && v.link)
      const marcas = await Promise.all(brutas.map(v => conferir(v.link)))
      vagas = brutas.map((v, i) => ({ ...v, conferido: marcas[i] === 'ok' })).filter((v, i) => !['quebrado', 'invalido'].includes(marcas[i]))
      descartadas = brutas.length - vagas.length
    }
    const termo = p.area || p.temas[0] || ''
    const dados = { conexoes: tipo === 'vagas' ? antes.conexoes : conexoes, seguir: tipo === 'vagas' ? antes.seguir : seguir, vagas, descartadas, prefs, maisVagas: buscaVagas(termo, prefs.local), agente, quando: new Date().toISOString() }
    fs.mkdirSync(path.dirname(arq(id)), { recursive: true }); fs.writeFileSync(arq(id), JSON.stringify(dados, null, 2), 'utf8')
    Object.assign(J, { estado: 'pronto' })
  }).catch(e => Object.assign(J, { estado: 'falhou', erro: e.message }))
  return { estado: 'rodando' }
}
const estado = () => JOB && { id: JOB.id, tipo: JOB.tipo, estado: JOB.estado, erro: JOB.erro, inicio: JOB.inicio }

module.exports = { carregar, buscar, estado, conferir, buscaPessoas, buscaVagas }
