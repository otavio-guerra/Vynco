'use strict'
// Pedidos à sua IA: você escreve o que quer, do seu jeito ("um vídeo sobre X para hoje à tarde",
// "todo dia, monte um post com as fotos novas da pasta X sobre o avanço do meu trabalho").
// 1. Entender: a escolha mais barata da sua IA (ex.: Claude Haiku, esforço baixo) lê o pedido e devolve um plano. Só leitura.
// 2. Conferir: o Vynco checa o plano (pasta, fotos, chave do Magnific, horário) e mostra o que vai usar e quanto já gastou.
//    Nada é criado e nenhum crédito do Magnific é gasto antes de você confirmar.
// 3. Fazer: o Vynco separa as fotos, pede a imagem ou o vídeo ao Magnific (se o plano usar) e a sua IA principal escreve o post.
//    O post vai para Revisar. Se o pedido tiver horário, ele entra na agenda, mas só vai ao ar se você aprovar até lá.
// 4. Repetir: "todo dia" vira uma repetição que reaproveita o plano (não gasta o raciocínio de novo) e não repete foto.
// A IA nunca aprova nem publica: isso continua com você, no Vynco.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')
const AG = require('./agentes.js')
const PERFIS = require('./perfis.js')
const IMAGEM = require('./imagem/index.js')
const M = require('./midia.js')

const ARQ = () => C.ws('pedidos', 'pedidos.json'), REP = () => C.ws('pedidos', 'repeticoes.json')
const ler = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const gravar = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); const t = p + '.tmp'; fs.writeFileSync(t, JSON.stringify(o, null, 2), 'utf8'); fs.renameSync(t, p) }
const txt = (v, n = 300) => String(v ?? '').trim().slice(0, n)
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const dia = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const HHMM = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '').trim()) ? String(v).trim() : null
const slug = t => String(t || 'post').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'post'
const FORMATOS = { texto: 'Post de texto', carrossel: 'Carrossel em PDF', fotos: 'Post com as suas fotos', imagem: 'Imagem gerada no Magnific', video: 'Vídeo gerado no Magnific' }
const MAGNIFIC = f => f === 'imagem' || f === 'video'
const FOTO = /\.(jpe?g|png)$/i
const MAX_FOTO = 15 * 1024 * 1024
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

let H = {}   // ganchos do servidor: agenteId, avisar, agendar, queue
const todos = () => ler(ARQ(), [])
const pedido = id => todos().find(x => x.id === id)
function salvar(p) { const l = todos(), i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else l.unshift(p); gravar(ARQ(), l.slice(0, 60)); return p }
const repeticoes = () => ler(REP(), [])
function salvarRep(r) { const l = repeticoes(), i = l.findIndex(x => x.id === r.id); if (i >= 0) l[i] = r; else l.unshift(r); gravar(REP(), l); return r }

// ---------------------------------------------------------------- 1. entender (só raciocínio: a escolha mais barata)
function promptPlano(texto, perfil) {
  const a = new Date()
  return `Você é o planejador do Vynco, um app que cria posts para o LinkedIn. Leia o pedido e devolva um plano em JSON. Não escreva o post: só entenda o que a pessoa quer.
Agora: ${DIAS[a.getDay()]}, ${dia(a)}, ${a.toTimeString().slice(0, 5)} (horário do computador).

Quem pede:
${PERFIS.resumo(perfil)}

Pedido: """${texto}"""

Formatos possíveis:
- texto: post só de texto.
- carrossel: carrossel em PDF desenhado pelo Vynco (5 a 8 slides).
- fotos: post com fotos de uma pasta do computador (a pessoa diz qual pasta).
- imagem: uma imagem gerada por IA no Magnific (gasta créditos).
- video: um vídeo curto gerado por IA no Magnific (gasta créditos). Se a pessoa disser uma pasta de fotos, o vídeo anima a foto mais recente.
Regras:
- Use o formato que a pessoa pediu. Se ela não disser, use texto.
- Horários: "de manhã" = 09:00, "no almoço" = 12:00, "à tarde" = 15:00, "à noite" = 19:00. "hoje", "amanhã" e dias da semana contam a partir de agora.
- "todo dia" = dias [1,2,3,4,5] (segunda a sexta), a não ser que ela inclua o fim de semana. "toda segunda" = [1]. 0 é domingo.
- Não invente pasta, tema nem horário que a pessoa não disse. Use "duvida" só quando for impossível fazer sem a resposta (ex.: pediu fotos sem dizer a pasta). Horário de publicação não é essencial: sem ele, o post fica sem horário. Não peça para confirmar o que ela já disse.
- videoPrompt e imagemPrompt: em inglês, descrevendo a cena, sem texto escrito, sem logos e sem pessoas reais identificáveis.
Responda SOMENTE com um bloco JSON neste formato:
{"resumo":"uma frase do que vai ser feito","formato":"texto","tema":"","pasta":null,"quantasFotos":3,"videoPrompt":null,"imagemPrompt":null,"quando":null,"repetir":null,"horaPublicar":null,"duvida":null}
- quando: "AAAA-MM-DDTHH:MM" (horário local) para o post ir ao ar, ou null se ela não disse.
- repetir: null, ou {"dias":[1,2,3,4,5],"hora":"08:00"} quando ela pede que se repita (hora = quando criar; use 08:00 se ela não disser).
- horaPublicar: numa repetição, "HH:MM" em que cada post deve ir ao ar (null se ela não disse).`
}

// o que a IA devolveu, só com valores válidos
function limpar(r = {}) {
  const pl = {
    resumo: txt(r.resumo, 240), formato: FORMATOS[r.formato] ? r.formato : 'texto', tema: txt(r.tema, 200),
    pasta: r.pasta ? txt(r.pasta, 400).replace(/^["']|["']$/g, '') : null,
    quantasFotos: Math.max(1, Math.min(9, parseInt(r.quantasFotos, 10) || 3)),
    videoPrompt: r.videoPrompt ? txt(r.videoPrompt, 1500) : null, imagemPrompt: r.imagemPrompt ? txt(r.imagemPrompt, 1500) : null,
    quando: null, repetir: null, horaPublicar: HHMM(r.horaPublicar), duvida: r.duvida ? txt(r.duvida, 240) : null,
  }
  if (r.quando) { const d = new Date(String(r.quando)); if (!isNaN(d)) pl.quando = d.toISOString() }
  if (r.repetir && Array.isArray(r.repetir.dias)) {
    const dias = [...new Set(r.repetir.dias.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
    if (dias.length) pl.repetir = { dias, hora: HHMM(r.repetir.hora) || '08:00' }
  }
  if (pl.repetir) pl.quando = null
  if (pl.formato === 'video' && !pl.videoPrompt) pl.videoPrompt = pl.tema ? `A calm, cinematic short scene illustrating: ${pl.tema}` : null
  if (pl.formato === 'imagem' && !pl.imagemPrompt) pl.imagemPrompt = pl.tema ? `Editorial illustration about: ${pl.tema}` : null
  return pl
}

// a pasta que a pessoa citou: tem que existir e não pode ser a pasta do cofre do Vynco
function pastaOk(p) {
  if (!p) return { ok: false, erro: 'Diga qual pasta tem as fotos.' }
  const abs = path.resolve(p)
  if (!path.isAbsolute(p)) return { ok: false, erro: `Use o caminho completo da pasta (ex.: C:\\Users\\voce\\Pictures\\Obra), não "${p}".` }
  if (abs.toLowerCase().startsWith(path.join(C.ROOT, 'config').toLowerCase())) return { ok: false, erro: 'Essa pasta é do Vynco e não pode ser usada.' }
  let st; try { st = fs.statSync(abs) } catch { return { ok: false, erro: `Não achei a pasta ${abs}.` } }
  if (!st.isDirectory()) return { ok: false, erro: `${abs} não é uma pasta.` }
  return { ok: true, abs }
}
const chaveFoto = (nome, st) => `${nome}:${st.size}:${Math.round(st.mtimeMs)}`
function fotosDa(abs, usadas = []) {
  const u = new Set(usadas), l = []
  let nomes = []; try { nomes = fs.readdirSync(abs) } catch { }
  for (const n of nomes.filter(n => FOTO.test(n))) {
    let st; try { st = fs.statSync(path.join(abs, n)) } catch { continue }
    if (!st.isFile() || st.size > MAX_FOTO) continue
    const k = chaveFoto(n, st); if (!u.has(k)) l.push({ nome: n, chave: k, quando: st.mtimeMs, abs: path.join(abs, n) })
  }
  return l.sort((a, b) => b.quando - a.quando)
}

// confere o plano sem gastar nada; devolve os avisos e o que vai ser usado
function conferir(pl, { usadas = [] } = {}) {
  const ag = H.agenteId ? H.agenteId() : null, avisos = [], bloqueios = []
  if (!ag) bloqueios.push('Escolha a sua IA em Ajustes antes.')
  if (pl.duvida) bloqueios.push(pl.duvida)
  let fotos = null
  if (pl.formato === 'fotos' || (pl.formato === 'video' && pl.pasta)) {
    const p = pastaOk(pl.pasta)
    if (!p.ok) bloqueios.push(p.erro)
    else { const l = fotosDa(p.abs, usadas); fotos = { pasta: p.abs, novas: l.length, usar: Math.min(l.length, pl.formato === 'video' ? 1 : pl.quantasFotos) }; if (!l.length) (pl.repetir ? avisos : bloqueios).push(pl.repetir ? 'A pasta ainda não tem fotos novas: nos dias sem foto nova, a repetição pula o post e avisa você.' : 'Não achei fotos (JPG ou PNG, até 15 MB) novas nessa pasta.') }
  }
  let magnific = null
  if (MAGNIFIC(pl.formato)) {
    const pv = IMAGEM.provedores().find(x => x.id === 'magnific')
    if (!pv || !pv.temChave) bloqueios.push('Para imagem ou vídeo, salve a chave da API do Magnific em Ajustes.')
    const op = pl.formato === 'video' ? 'video' : 'gerar'
    const est = IMAGEM.estimar({ provedor: 'magnific', op, params: paramsMagnific(pl) })
    magnific = { op, modelo: op === 'video' ? (pl.pasta ? 'Kling 2.6 Pro · 5 s' : 'Seedance 2.0 Pro · 720p · 5 s') : 'Mystic · 2K · 4:5', valor: est.total, moeda: est.moeda, nota: est.nota, usoMes: est.uso && { operacoes: est.uso.operacoes, limite: est.uso.limiteMensal, gasto: est.uso.gasto, orcamento: est.uso.orcamentoMensal } }
    if (est.uso && est.uso.operacoes + 1 > est.uso.limiteMensal) bloqueios.push(`O Magnific já chegou ao seu limite de ${est.uso.limiteMensal} operações neste mês (dá para mudar em Ajustes).`)
  }
  if (pl.quando && new Date(pl.quando).getTime() < Date.now() + 20 * 60000) avisos.push('O horário pedido já passou ou está muito perto: o post vai para Revisar sem horário, e você escolhe quando sai.')
  const esc = ag ? AG.escolhaPub(ag).criar : {}
  const escrever = ag ? { ia: AG.AGENTES[ag].nome, modelo: esc.modelo || null, esforco: esc.esforco || null, antes: mediaDe(ag, pl.formato) } : null
  return { bloqueios, avisos, fotos, magnific, escrever }
}
const paramsMagnific = pl => pl.formato === 'video'
  ? (pl.pasta ? { modelo: 'kling', duracao: '5', prompt: pl.videoPrompt || '' } : { modelo: 'seedance', resolucao: '720p', duracao: '5', aspect_ratio: 'square_1_1', prompt: pl.videoPrompt || '' })
  : { prompt: pl.imagemPrompt || pl.tema, aspect_ratio: 'social_post_4_5', resolution: '2k' }
// quanto a escrita costuma gastar, pelos últimos pedidos do mesmo formato com a mesma IA (nada inventado: sem histórico, sem número)
function mediaDe(ag, formato) {
  const l = todos().filter(p => p.estado === 'pronto' && p.plano && p.plano.formato === formato && p.uso && p.uso.escrever && p.uso.escrever.ia === AG.AGENTES[ag].nome && !p.uso.escrever.estimado).slice(0, 5)
  return l.length ? { vezes: l.length, tokens: Math.round(l.reduce((s, p) => s + p.uso.escrever.total, 0) / l.length) } : null
}

let ENTENDENDO = 0
async function entender(texto) {
  texto = txt(texto, 1500)
  if (texto.length < 6) throw new Error('Escreva o que você quer que a sua IA faça.')
  const ag = H.agenteId && H.agenteId(); if (!ag) throw new Error('Escolha a sua IA em Ajustes antes.')
  if (ENTENDENDO > 1) throw new Error('Já tem um pedido sendo entendido. Espere um pouco.')
  const p = salvar({ id: novoId(), texto, criado: Date.now(), estado: 'entendendo', uso: {} })
  ENTENDENDO++
  AG.perguntar(ag, promptPlano(texto, PERFIS.carregar(H.perfilAtivo())), { timeout: 180000, barato: true, detalhe: true })
    .then(r => {
      const x = pedido(p.id); if (!x || x.estado !== 'entendendo') return
      x.plano = limpar(PERFIS.extrairJSON(r.texto))
      x.uso.entender = { ia: AG.nomeBarato(ag), ...r.uso }
      x.conferencia = conferir(x.plano)
      x.estado = 'conferir'
      salvar(x)
    })
    .catch(e => { const x = pedido(p.id); if (x) salvar({ ...x, estado: 'falhou', erro: e.message }) })
    .finally(() => { ENTENDENDO-- })
  return p
}

// ---------------------------------------------------------------- 2. confirmar
async function confirmar(id, { agora = true, magnificTodoDia = false } = {}) {
  const p = pedido(id); if (!p) throw new Error('pedido não encontrado')
  if (p.estado !== 'conferir') throw new Error('Este pedido não está esperando confirmação.')
  const cf = conferir(p.plano)
  if (cf.bloqueios.length) { salvar({ ...p, conferencia: cf }); throw new Error(cf.bloqueios[0]) }
  if (p.plano.repetir) {
    if (MAGNIFIC(p.plano.formato) && !magnificTodoDia) throw new Error('Esta repetição usa o Magnific todo dia (gasta créditos). Marque que você concorda antes.')
    const r = salvarRep({ id: novoId(), texto: p.texto, plano: p.plano, dias: p.plano.repetir.dias, hora: p.plano.repetir.hora, ativo: true, criado: Date.now(), ultima: null, usadas: [], posts: [], magnific: !!magnificTodoDia, pedido: p.id })
    salvar({ ...p, estado: 'repetindo', repeticao: r.id })
    if (agora) { r.ultima = dia(); salvarRep(r); return iniciarDaRep(r) }
    return pedido(id)
  }
  return fazer(p)
}
// você corrige o plano à mão (formato, pasta, horário, repetição) sem gastar a IA de novo
function ajustar(id, m = {}) {
  const p = pedido(id); if (!p || p.estado !== 'conferir') throw new Error('Este pedido não está esperando confirmação.')
  const pl = { ...p.plano }
  if (m.formato && FORMATOS[m.formato]) pl.formato = m.formato
  if ('pasta' in m) pl.pasta = m.pasta ? txt(m.pasta, 400).replace(/^["']|["']$/g, '') : null
  if ('quantasFotos' in m) pl.quantasFotos = m.quantasFotos
  if ('tema' in m) pl.tema = txt(m.tema, 200)
  if ('quando' in m) pl.quando = m.quando || null
  if ('repetir' in m) pl.repetir = m.repetir || null
  if ('horaPublicar' in m) pl.horaPublicar = m.horaPublicar || null
  if (m.limparDuvida) pl.duvida = null
  const novo = limpar({ ...pl, quando: pl.quando ? new Date(pl.quando).toString() !== 'Invalid Date' ? pl.quando : null : null })
  novo.resumo = pl.resumo; novo.duvida = pl.duvida || null
  return salvar({ ...p, plano: novo, conferencia: conferir(novo), ajustado: true })
}
function cancelar(id) {
  const p = pedido(id); if (!p) throw new Error('pedido não encontrado')
  if (['fazendo', 'esperando-midia'].includes(p.estado)) { const pr = PROC[id]; if (pr) try { pr.kill() } catch { } }
  return salvar({ ...p, estado: 'cancelado', fim: Date.now() })
}
function apagar(id) { gravar(ARQ(), todos().filter(x => x.id !== id || ['fazendo', 'entendendo', 'esperando-midia'].includes(x.estado))); return { ok: true } }

// ---------------------------------------------------------------- 3. fazer
const PROC = {}
function instrucoes(p, alvo, extra) {
  const pl = p.plano
  const comum = `Você vai criar um post para o LinkedIn a pedido da pessoa descrita em workspace/perfil.md. Leia esse arquivo antes de tudo e escreva para o público, no tom e dentro da área que estão lá. Português do Brasil, frases curtas.
O pedido, nas palavras dela: """${p.texto}"""
O que o Vynco entendeu: ${pl.resumo || '-'}${pl.tema ? `\nTema: ${pl.tema}` : ''}
Não invente fatos, números, datas, falas, clientes ou resultados. Se precisar de um detalhe pessoal que não está no perfil${pl.formato === 'fotos' ? ' nem nas fotos' : ''}, deixe entre colchetes para ela completar, como [conte aqui o resultado].
Não repita assuntos já publicados (workspace/publicados.json).${extra.anteriores && extra.anteriores.length ? `\nPosts anteriores desta mesma repetição (continue a história, sem repetir): ${extra.anteriores.map(t => `"${t}"`).join(', ')}.` : ''}`
  const fim = '\nTermine dizendo o título e "Pronto para aprovação no Vynco." Não publique nada.'
  const post = `- legenda.txt: o post completo (até 1.300 caracteres), seguindo a skill vynco-legendas;
- post.json: {"titulo": "<um título curto para a pessoa achar o post>", "rascunho": false}.`
  if (pl.formato === 'carrossel') return `${comum}

Formato: carrossel (PDF). Escreva engine/noticias/pautas/${alvo.id}.js no mesmo formato de engine/noticias/pautas/2026-11-03-a.js: exporta { titulo, accent, tema, fontes, slides, caption }. De 5 a 8 slides; use só as peças k.kick, k.title, k.para, k.cards e k.bubble e os tokens T de engine/brand/lib.js (nunca cores fixas). O primeiro slide é o gancho; o último termina com uma pergunta.
A legenda (caption) segue a skill vynco-legendas.
Depois rode: node engine/noticias/carrossel.js engine/noticias/pautas/${alvo.id}.js e node engine/noticias/exportar.js ${alvo.id}. Abra os PNG em workspace/noticias/png/${alvo.id}/ e corrija textos cortados ou sobrepostos.${fim}`
  if (pl.formato === 'fotos') return `${comum}

Formato: post com fotos. O Vynco já copiou ${extra.fotos} foto(s) da pasta dela para workspace/avulsos/${alvo.id}/ (01, 02…, na ordem em que foram tiradas). Abra cada uma e olhe com atenção: fale só do que dá para ver nelas e do que está no pedido e no perfil.
Na mesma pasta, crie:
${post}
- para cada foto, um texto alternativo curto (o que a foto mostra, para quem não enxerga): 01.alt.txt, 02.alt.txt…${fim}`
  if (MAGNIFIC(pl.formato)) return `${comum}

Formato: ${pl.formato === 'video' ? 'vídeo curto' : 'imagem'}. O Vynco está gerando ${pl.formato === 'video' ? 'o vídeo' : 'a imagem'} no Magnific com esta descrição: "${pl.formato === 'video' ? pl.videoPrompt : pl.imagemPrompt}". O arquivo entra na pasta quando ficar pronto: você não precisa mexer nele.
Crie a pasta workspace/avulsos/${alvo.id}/ com:
${post}${fim}`
  return `${comum}

Formato: post de texto. Crie a pasta workspace/avulsos/${alvo.id}/ com:
${post}${fim}`
}

async function fazer(p, rep = null) {
  const ag = H.agenteId(), pl = p.plano
  const id = `${dia()}-${slug(pl.tema || pl.resumo)}-${p.id.slice(-4)}`
  const alvo = pl.formato === 'carrossel' ? { kind: 'noticias', id } : { kind: 'avulsos', id }
  const pasta = C.ws('avulsos', id)
  Object.assign(p, { estado: 'fazendo', inicio: Date.now(), post: alvo, erro: null, passos: [] })
  const passo = t => { p.passos.push({ t: Date.now(), texto: t }); salvar(p) }
  try {
    let fotos = [], origem = null
    if (pl.formato === 'fotos' || (pl.formato === 'video' && pl.pasta)) {
      const ok = pastaOk(pl.pasta); if (!ok.ok) throw new Error(ok.erro)
      fotos = fotosDa(ok.abs, rep ? rep.usadas : []).slice(0, pl.formato === 'video' ? 1 : pl.quantasFotos).reverse()
      if (!fotos.length) throw Object.assign(new Error('Nenhuma foto nova na pasta.'), { pular: true })
      if (pl.formato === 'fotos') {
        fs.mkdirSync(pasta, { recursive: true })
        fotos.forEach((f, k) => fs.copyFileSync(f.abs, path.join(pasta, `${String(k + 1).padStart(2, '0')}${path.extname(f.nome).toLowerCase().replace('.jpeg', '.jpg')}`)))
        passo(`Copiei ${fotos.length} foto(s) de ${ok.abs}.`)
      } else { origem = M.guardar(fotos[0].nome, fs.readFileSync(fotos[0].abs), { origem: 'pedido', pedido: p.id }).arquivo; passo(`A foto ${fotos[0].nome} vai virar vídeo.`) }
      if (rep) { rep.usadas = [...rep.usadas, ...fotos.map(f => f.chave)].slice(-2000); salvarRep(rep) }
    }
    if (MAGNIFIC(pl.formato)) {
      const op = pl.formato === 'video' ? 'video' : 'gerar'
      const job = await IMAGEM.pedir({ provedor: 'magnific', op, params: paramsMagnific(pl), origem })
      p.magnific = { job: job.id, op, estado: 'rodando', estimativa: job.estimativa ? { valor: job.estimativa.total, moeda: job.estimativa.moeda, nota: job.estimativa.nota } : null }
      passo(`Pedi ${op === 'video' ? 'o vídeo' : 'a imagem'} ao Magnific (1 operação).`)
    }
    const arq = C.ws('pedidos', `${p.id}.md`)
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    fs.writeFileSync(arq, instrucoes(p, alvo, { fotos: fotos.length, anteriores: rep ? rep.posts.slice(-3).map(x => x.titulo) : [] }), 'utf8')
    const rel = path.relative(C.ROOT, arq).split(path.sep).join('/')
    const pr = AG.executar(ag, rel)
    PROC[p.id] = pr
    passo(`O ${AG.AGENTES[ag].nome} está escrevendo o post.`)
    let saida = '', erro = ''
    const log = C.ws('logs', `pedido-${p.id}.log`); fs.mkdirSync(path.dirname(log), { recursive: true })
    const out = fs.createWriteStream(log)
    pr.stdout.on('data', d => { saida += d; if (saida.length > 4e6) saida = saida.slice(-2e6); out.write(d) })
    pr.stderr.on('data', d => { erro += d; out.write(d) })
    pr.on('error', e => { erro += e.message })
    pr.on('close', code => {
      out.end(); delete PROC[p.id]
      const x = pedido(p.id) || p; if (x.estado === 'cancelado') return
      const u = AG.lerUso(ag, saida, fs.readFileSync(arq, 'utf8'))
      const esc = AG.escolhaPub(ag).criar
      x.uso = { ...(x.uso || {}), escrever: { ia: AG.AGENTES[ag].nome, modelo: u.uso.modelo || esc.modelo || null, ...u.uso } }
      x.log = path.relative(C.WS, log)
      if (code !== 0 || u.erro) return salvar({ ...x, estado: 'falhou', fim: Date.now(), erro: `A IA não terminou: ${(u.erro || erro || saida).trim().split('\n').pop().slice(0, 200) || 'erro ' + code}` })
      const naFila = H.queue().find(i => i.kind === alvo.kind && i.id === alvo.id)
      if (!naFila) return salvar({ ...x, estado: 'falhou', fim: Date.now(), erro: 'A IA terminou, mas o post não apareceu em Revisar. Veja o registro.' })
      if (rep) { rep.posts = [...(rep.posts || []), { quando: Date.now(), titulo: naFila.title, kind: alvo.kind, id: alvo.id }].slice(-30); salvarRep(rep) }
      x.titulo = naFila.title
      if (x.magnific && x.magnific.estado === 'rodando') {
        rascunho(pasta, true)
        x.passos.push({ t: Date.now(), texto: 'A legenda está pronta. Esperando o Magnific terminar.' })
        salvar({ ...x, estado: 'esperando-midia' }); vigiar(); return
      }
      concluir(x)
    })
    return p
  } catch (e) {
    if (rep && e.pular) { avisarH(false, rep.texto, 'Hoje não teve foto nova na pasta, então a repetição pulou o post.'); return salvar({ ...p, estado: 'pulado', fim: Date.now(), erro: e.message }) }
    return salvar({ ...p, estado: 'falhou', fim: Date.now(), erro: e.message })
  }
}
function rascunho(pasta, sim) { const f = path.join(pasta, 'post.json'), j = ler(f, {}); j.rascunho = !!sim; try { fs.writeFileSync(f, JSON.stringify(j, null, 2), 'utf8') } catch { } }

// agenda (se o pedido tem horário) e avisa com o que foi gasto
function concluir(x) {
  const pl = x.plano
  let quando = pl.quando && new Date(pl.quando).getTime() > Date.now() + 20 * 60000 ? pl.quando : null
  if (!quando && x.repeticao && pl.horaPublicar) { const [h, m] = pl.horaPublicar.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); if (d.getTime() > Date.now() + 30 * 60000) quando = d.toISOString() }
  if (quando) { try { H.agendar(x.post.kind, x.post.id, quando); x.agendado = quando } catch { } }
  salvar({ ...x, estado: 'pronto', fim: Date.now() })
  avisarH(true, x.titulo || x.texto, `Pronto em Revisar${quando ? `, agendado para ${new Date(quando).toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} (só sai se você aprovar)` : ''}. Gasto: ${resumoUso(x)}.`, `${x.post.kind}:${x.post.id}`)
}
const mil = n => n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 1e5 ? 0 : 1 })} mil` : String(n)
// "claude-opus-5-5" → "Opus 5.5"
const nomeModelo = m => { const r = /claude-([a-z]+)-(\d+)-(\d+)/i.exec(String(m || '')); return r ? `${r[1][0].toUpperCase()}${r[1].slice(1)} ${r[2]}.${r[3]}` : m ? String(m).split(',')[0] : '' }
const linhaUso = (rot, u, ia) => `${rot} ${u.estimado ? '~' : ''}${mil(u.total)} tokens${u.cache ? `, ${mil(u.cache)} do cache` : ''} (${ia}${u.modelo && !/·/.test(ia) ? ' ' + nomeModelo(u.modelo) : ''})`
function resumoUso(x) {
  const u = x.uso || {}, l = []
  if (u.entender) l.push(linhaUso('entender', u.entender, u.entender.ia))
  if (u.escrever) l.push(linhaUso('escrever', u.escrever, u.escrever.ia))
  if (x.magnific) l.push(`Magnific 1 ${x.magnific.op === 'video' ? 'vídeo' : 'imagem'}${x.magnific.estimativa && x.magnific.estimativa.valor != null ? ` (~€${x.magnific.estimativa.valor})` : ''}`)
  return l.join(' · ') || 'nada'
}
const avisarH = (ok, titulo, texto, chave) => { try { H.avisar && H.avisar({ ok, titulo: `Pedido: ${String(titulo).slice(0, 60)}`, texto, chave }) } catch { } }

// o Magnific termina por conta própria: quando o arquivo chega, vai para a pasta do post
let VIGIA = null
function vigiar() {
  if (VIGIA) return
  VIGIA = setInterval(() => {
    const l = todos().filter(p => p.estado === 'esperando-midia')
    if (!l.length) { clearInterval(VIGIA); VIGIA = null; return }
    const tarefas = IMAGEM.lista()
    for (const x of l) {
      const job = tarefas.find(j => j.id === x.magnific.job)
      if (!job || job.estado === 'rodando') continue
      const pasta = C.ws('avulsos', x.post.id)
      const arq = job.estado === 'pronto' && (job.itens.find(i => i.arquivos && i.arquivos.length) || {}).arquivos
      if (!arq) { x.magnific.estado = 'falhou'; salvar({ ...x, estado: 'falhou', fim: Date.now(), erro: `O Magnific não entregou: ${(job.itens.find(i => i.erro) || {}).erro || 'sem arquivo'}. A legenda ficou em Revisar como rascunho.` }); avisarH(false, x.titulo || x.texto, 'O Magnific não conseguiu gerar o arquivo. A legenda ficou em Revisar como rascunho.'); continue }
      try {
        const de = M.caminho(arq[0]), ext = path.extname(de).toLowerCase()
        fs.copyFileSync(de, path.join(pasta, (x.magnific.op === 'video' ? 'video' : '01') + ext))
        rascunho(pasta, false)
        x.magnific.estado = 'pronto'; x.magnific.arquivo = arq[0]
        x.passos.push({ t: Date.now(), texto: `O ${x.magnific.op === 'video' ? 'vídeo' : 'a imagem'} chegou do Magnific.` })
        concluir(x)
      } catch (e) { salvar({ ...x, estado: 'falhou', fim: Date.now(), erro: e.message }) }
    }
  }, 5000)
  VIGIA.unref && VIGIA.unref()
}

// ---------------------------------------------------------------- 4. repetições
function iniciarDaRep(r) {
  const p = salvar({ id: novoId(), texto: r.texto, criado: Date.now(), estado: 'fazendo', plano: { ...r.plano }, uso: {}, repeticao: r.id, daRepeticao: true })
  return fazer(p, r)
}
function rodarRepeticoes() {
  if (!H.agenteId || !H.agenteId()) return
  const agora = new Date(), hh = agora.toTimeString().slice(0, 5), ocupados = new Set(todos().filter(p => ['fazendo', 'esperando-midia'].includes(p.estado)).map(p => p.repeticao))
  for (const r of repeticoes()) {
    if (!r.ativo || !r.dias.includes(agora.getDay()) || hh < r.hora || r.ultima === dia() || ocupados.has(r.id)) continue
    if (MAGNIFIC(r.plano.formato) && !r.magnific) continue
    r.ultima = dia(); salvarRep(r)
    iniciarDaRep(r).catch(e => avisarH(false, r.texto, `A repetição não rodou: ${e.message}`))
  }
}
function mudarRep(id, { ativo, apagar: tirar } = {}) {
  const l = repeticoes(), r = l.find(x => x.id === id); if (!r) throw new Error('repetição não encontrada')
  if (tirar) { gravar(REP(), l.filter(x => x.id !== id)); return { ok: true } }
  if (ativo != null) r.ativo = !!ativo
  return salvarRep(r)
}

// ao subir: o que estava no meio não tem como continuar (a IA foi encerrada junto); o Magnific continua sozinho
function ligar(h) {
  H = h
  const l = todos(); let mudou = false
  for (const p of l) if (p.estado === 'entendendo' || p.estado === 'fazendo') { p.estado = 'falhou'; p.erro = 'O Vynco fechou no meio. Peça de novo.'; mudou = true }
  if (mudou) gravar(ARQ(), l)
  if (l.some(p => p.estado === 'esperando-midia')) vigiar()
}

function estado() {
  const l = todos().slice(0, 20).map(p => ({ ...p, uso: p.uso ? { ...p.uso, resumo: resumoUso(p) } : null }))
  const reps = repeticoes().map(r => ({ id: r.id, texto: r.texto, resumo: r.plano.resumo, formato: r.plano.formato, pasta: r.plano.pasta, dias: r.dias, hora: r.hora, horaPublicar: r.plano.horaPublicar, ativo: r.ativo, ultima: r.ultima, feitos: (r.posts || []).length, magnific: r.magnific }))
  const ag = H.agenteId && H.agenteId()
  return { pedidos: l, repeticoes: reps, formatos: FORMATOS, ia: ag ? { principal: AG.AGENTES[ag].nome, barata: AG.nomeBarato(ag) } : null }
}

module.exports = { ligar, entender, ajustar, confirmar, cancelar, apagar, estado, rodarRepeticoes, mudarRep, conferir, limpar, FORMATOS }
