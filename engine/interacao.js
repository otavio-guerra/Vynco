'use strict'
// "Para interagir hoje": ajuda a manter a constância de comentar no LinkedIn, sem automatizar nada lá.
// - o registro do dia (quantos comentários você fez, a meta e a sequência de dias) é anotado por você;
// - as ideias de comentário vêm da sua IA a partir do seu perfil, sem inventar fatos, números ou falas;
// - as buscas abrem a busca de publicações do próprio LinkedIn. Curtir e comentar é sempre com você.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')
const PERFIS = require('./perfis.js')

const arq = id => path.join(C.ws('perfis'), id, 'interacao.json')
const ler = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const txt = (v, n = 300) => String(v ?? '').trim().slice(0, n)
const dia = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PADRAO = { meta: 3, dias: {}, ideias: [], buscas: [], ideiasEm: null }

function carregar(id) { return { ...PADRAO, ...ler(arq(id), {}) } }
function gravar(id, d) {
  // guarda só os últimos 90 dias do registro
  const corte = dia(new Date(Date.now() - 90 * 864e5))
  d.dias = Object.fromEntries(Object.entries(d.dias || {}).filter(([k]) => k >= corte))
  fs.mkdirSync(path.dirname(arq(id)), { recursive: true }); fs.writeFileSync(arq(id), JSON.stringify(d, null, 2), 'utf8')
  return d
}
// dias seguidos com pelo menos um comentário (se hoje ainda está zerado, conta a partir de ontem)
function sequencia(dias) {
  let n = 0, d = new Date()
  if (!(dias[dia(d)] > 0)) d = new Date(Date.now() - 864e5)
  while (dias[dia(d)] > 0) { n++; d = new Date(d.getTime() - 864e5) }
  return n
}
function estado(id) {
  const d = carregar(id), p = PERFIS.carregar(id)
  const semana = Array.from({ length: 7 }, (_, i) => { const x = new Date(Date.now() - (6 - i) * 864e5); return { dia: dia(x), n: d.dias[dia(x)] || 0 } })
  return { meta: d.meta, hoje: d.dias[dia()] || 0, sequencia: sequencia(d.dias), semana, ideias: d.ideias, buscas: d.buscas, ideiasEm: d.ideiasEm, perfil: { area: p.area || '', temas: p.temas || [] }, job: JOB && JOB.id === id ? { estado: JOB.estado, erro: JOB.erro || null } : null }
}
function registrar(id, { acao, n } = {}) {
  const d = carregar(id), k = dia()
  if (acao === 'comentei') d.dias[k] = (d.dias[k] || 0) + 1
  else if (acao === 'desfazer') d.dias[k] = Math.max(0, (d.dias[k] || 0) - 1)
  else if (acao === 'meta') d.meta = Math.max(1, Math.min(20, parseInt(n, 10) || 3))
  else throw new Error('ação desconhecida')
  gravar(id, d)
  return estado(id)
}

// ---------------------------------------------------------------- ideias de comentário (sua IA, só leitura)
let JOB = null
function prompt(p) {
  return `Você vai ajudar uma pessoa a comentar bem no LinkedIn. Responda em português do Brasil.

${PERFIS.resumo(p)}

Tarefa: sugira 5 ideias de comentário para posts que ela vai encontrar no feed sobre os temas e a área dela.
Regras:
- Não invente fatos, números, notícias, empresas, clientes ou falas. Nada de citar dados.
- Cada ideia é um ângulo que funciona em qualquer post sobre o tema: concordar trazendo um exemplo da prática dela, fazer uma pergunta que puxa conversa, trazer um contraponto respeitoso, compartilhar uma dica curta, ou contar um aprendizado.
- Para cada ideia, escreva um começo de comentário de até 220 caracteres, no tom dela, que ela vai completar com o assunto do post. Sem emoji, sem hashtag, sem elogio genérico ("ótimo post").
- Sugira também 4 termos curtos (de 1 a 3 palavras) para ela buscar posts recentes da área no LinkedIn.

Responda SOMENTE com um bloco JSON neste formato:
{"ideias": [{"tema": "", "angulo": "", "comeco": ""}], "buscas": [""]}`
}
function gerarIdeias(id, agente, perguntar) {
  if (JOB && JOB.estado === 'rodando') throw new Error('As ideias já estão sendo preparadas.')
  const p = PERFIS.carregar(id)
  if (!p.area && !(p.temas || []).length) throw new Error('Conte a sua área e os seus temas em Estratégia antes: é deles que saem as ideias.')
  const J = JOB = { id, estado: 'rodando', inicio: Date.now() }
  perguntar(agente, prompt(p), { timeout: 240000 }).then(saida => {
    const r = PERFIS.extrairJSON(saida)
    const ideias = (r.ideias || []).slice(0, 6).map(i => ({ tema: txt(i.tema, 80), angulo: txt(i.angulo, 120), comeco: txt(i.comeco, 280) })).filter(i => i.comeco)
    if (!ideias.length) throw new Error('A IA não trouxe ideias desta vez. Tente de novo.')
    const buscas = (r.buscas || []).map(b => txt(b, 50)).filter(Boolean).slice(0, 6)
    gravar(id, { ...carregar(id), ideias, buscas, ideiasEm: new Date().toISOString() })
    J.estado = 'pronto'
  }).catch(e => Object.assign(J, { estado: 'falhou', erro: e.message }))
  return estado(id)
}

module.exports = { estado, registrar, gerarIdeias }
