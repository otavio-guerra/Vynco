'use strict'
// Perfis do Farol: quem publica, para quem, com que tom, sobre o quê e com que cara.
// - Um perfil por conta do LinkedIn (id = id da conta) ou "principal" quando ainda não há conta.
//   Fica em workspace/perfis/<id>/perfil.json.
// - workspace/perfis/ativo.json diz qual perfil está em uso (o motor de peças lê para aplicar a marca, se o perfil pedir).
// - workspace/perfil.md é um resumo legível para a IA: as rotinas leem antes de escrever (agent/AGENTS.md).
const fs = require('fs')
const path = require('path')
const C = require('./config.js')

const DIR = C.ws('perfis'), ATIVO = path.join(DIR, 'ativo.json'), RESUMO = C.ws('perfil.md')
const ID = /^[A-Za-z0-9_-]{1,64}$/
const HEX = /^#[0-9a-f]{6}$/i
const CORES = ['principal', 'secundaria', 'acento', 'fundo', 'texto']

const vazio = id => ({
  id, nome: '', area: '', publico: '', objetivo: '', tom: '', temas: [], evitar: [], links: { site: '', portfolio: '' }, sobre: '',
  pilares: [],
  marca: { cores: Object.fromEntries(CORES.map(c => [c, ''])), fontes: { titulo: '', texto: '' }, estilo: '', referencias: [], aplicarNoMotor: false, usarNoEstudio: true },
  analise: null, atualizado: null,
})
const ler = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const gravar = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); const tmp = p + '.tmp'; fs.writeFileSync(tmp, typeof o === 'string' ? o : JSON.stringify(o, null, 2), 'utf8'); fs.renameSync(tmp, p) }
const arquivo = id => path.join(DIR, id, 'perfil.json')
const txt = (v, n = 300) => String(v ?? '').trim().slice(0, n)
const lista_ = (v, n = 12, m = 60) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => txt(x, m)).filter(Boolean).slice(0, n)

function carregar(id) {
  if (!ID.test(id || '')) throw new Error('perfil inválido')
  const base = vazio(id), salvo = ler(arquivo(id), {})
  return { ...base, ...salvo, id, links: { ...base.links, ...(salvo.links || {}) }, marca: { ...base.marca, ...(salvo.marca || {}), cores: { ...base.marca.cores, ...((salvo.marca || {}).cores || {}) }, fontes: { ...base.marca.fontes, ...((salvo.marca || {}).fontes || {}) } } }
}

// limpa o que chega da tela (ou da análise da IA) antes de gravar
function limpar(p) {
  const m = p.marca || {}, cores = m.cores || {}
  return {
    nome: txt(p.nome, 80), area: txt(p.area, 200), publico: txt(p.publico, 300), objetivo: txt(p.objetivo, 200), tom: txt(p.tom, 200),
    temas: lista_(p.temas), evitar: lista_(p.evitar),
    links: { site: /^https?:\/\//i.test(p.links?.site || '') ? txt(p.links.site, 300) : '', portfolio: /^https?:\/\//i.test(p.links?.portfolio || '') ? txt(p.links.portfolio, 300) : '' },
    sobre: txt(p.sobre, 3000),
    pilares: (Array.isArray(p.pilares) ? p.pilares : []).slice(0, 8).map(x => ({ tema: txt(x.tema, 80), por_que: txt(x.por_que, 300), ideias: lista_(x.ideias, 6, 200) })).filter(x => x.tema),
    marca: {
      cores: Object.fromEntries(CORES.map(c => [c, HEX.test(cores[c] || '') ? cores[c].toLowerCase() : ''])),
      fontes: { titulo: txt(m.fontes?.titulo, 60), texto: txt(m.fontes?.texto, 60) },
      estilo: txt(m.estilo, 600),
      referencias: (Array.isArray(m.referencias) ? m.referencias : []).filter(r => /^(midia|dailyui|series|noticias)\/[^\\]+\.(png|jpe?g|gif)$/i.test(r) && !r.includes('..')).slice(0, 3),
      aplicarNoMotor: !!m.aplicarNoMotor, usarNoEstudio: m.usarNoEstudio !== false,
    },
  }
}
function salvar(id, dados) {
  const atual = carregar(id)
  const novo = { ...atual, ...limpar({ ...atual, ...dados, marca: { ...atual.marca, ...(dados.marca || {}) } }), id, analise: dados.analise !== undefined ? dados.analise : atual.analise, atualizado: new Date().toISOString() }
  gravar(arquivo(id), novo)
  if (ativoId() === id) escreverResumo(novo)
  return novo
}

const ativoId = () => (ler(ATIVO, {}).id) || 'principal'
// o perfil em uso acompanha a conta do LinkedIn em uso
function definirAtivo(id) {
  id = ID.test(id || '') ? id : 'principal'
  if (ler(ATIVO, {}).id !== id) gravar(ATIVO, { id })
  escreverResumo(carregar(id))
  return id
}
function lista(contas = []) {
  const ids = new Set(['principal', ...contas.map(c => c.id)])
  try { for (const d of fs.readdirSync(DIR)) if (ID.test(d) && fs.existsSync(arquivo(d))) ids.add(d) } catch { }
  return [...ids].map(id => { const p = carregar(id), c = contas.find(x => x.id === id); return { id, nome: p.nome || (c && c.nome) || (id === 'principal' ? 'Perfil principal' : id), conta: c ? c.nome : null } })
}

// resumo que a IA lê antes de escrever (workspace/perfil.md)
function resumo(p) {
  const l = (rot, v) => v && (Array.isArray(v) ? v.length : true) ? `- **${rot}:** ${Array.isArray(v) ? v.join(', ') : v}\n` : ''
  const c = p.marca.cores, cores = CORES.filter(k => c[k]).map(k => `${k} ${c[k]}`).join(', ')
  return `<!-- gerado pelo Farol a partir do perfil "${p.id}". Edite na tela Perfil. -->
# Perfil de quem publica

${l('Nome', p.nome)}${l('Área de atuação', p.area)}${l('Público', p.publico)}${l('Objetivo no LinkedIn', p.objetivo)}${l('Tom de voz', p.tom)}${l('Temas', p.temas)}${l('Evitar', p.evitar)}${l('Site', p.links.site)}${l('Portfólio', p.links.portfolio)}
${p.pilares.length ? `## Pilares de conteúdo\n${p.pilares.map(x => `- **${x.tema}**${x.por_que ? `: ${x.por_que}` : ''}${x.ideias.length ? `\n${x.ideias.map(i => `  - ${i}`).join('\n')}` : ''}`).join('\n')}\n` : ''}
## Identidade visual
${l('Cores', cores)}${l('Fontes', [p.marca.fontes.titulo && `títulos em ${p.marca.fontes.titulo}`, p.marca.fontes.texto && `texto em ${p.marca.fontes.texto}`].filter(Boolean).join(', '))}${l('Estilo', p.marca.estilo)}
Use estes dados para escolher assuntos, tom e cores. Não invente nada sobre a pessoa além do que está aqui.
`
}
function escreverResumo(p) { try { gravar(RESUMO, resumo(p)) } catch { } }

// ---------------------------------------------------------------- análise com a IA (só leitura e web; nada é gravado sem você aplicar)
function prompt(p, sobre) {
  const dados = { nome: p.nome, area: p.area, publico: p.publico, objetivo: p.objetivo, tom: p.tom, temas: p.temas, evitar: p.evitar, links: p.links }
  return `Você vai analisar o perfil profissional de uma pessoa para ajudar a planejar posts no LinkedIn. Responda em português do Brasil.

O que ela informou (JSON): ${JSON.stringify(dados)}
Texto "Sobre" que ela colou (pode estar vazio):
"""
${String(sobre || p.sobre || '').slice(0, 3000)}
"""

Se houver site ou portfólio nos links, abra (leitura na web) para entender a área, os serviços, o público e a identidade visual (cores principais e estilo).
Regras: não invente fatos (clientes, números, cargos, prêmios). Se não tiver informação, deixe o campo vazio. Seja específico e curto. Cores em hexadecimal (#rrggbb), só se vierem do site ou do que ela informou.

Responda SOMENTE com um bloco JSON, sem texto antes ou depois, neste formato:
{"resumo": "duas frases sobre a área e a proposta", "area": "", "publico": "", "objetivo": "", "tom": "", "temas": [""], "pilares": [{"tema": "", "por_que": "", "ideias": ["ideia de post 1", "ideia de post 2"]}], "cores": {"principal": "", "secundaria": "", "acento": "", "fundo": "", "texto": ""}, "fontes": {"titulo": "", "texto": ""}, "estilo_visual": "", "observacoes": [""]}`
}
// tira o JSON da resposta da IA (o último bloco {...} que for válido)
function extrairJSON(texto) {
  const blocos = [...String(texto).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1])
  for (const b of [...blocos.reverse(), String(texto).slice(String(texto).indexOf('{'), String(texto).lastIndexOf('}') + 1)]) { try { const j = JSON.parse(b); if (j && typeof j === 'object') return j } catch { } }
  throw new Error('A IA não devolveu a análise no formato esperado. Tente de novo.')
}
let ANALISE = null
function analisar(id, agente, perguntar, sobre) {
  if (ANALISE && ANALISE.estado === 'rodando') throw new Error('Já tem uma análise em andamento.')
  const p = carregar(id)
  if (!p.area && !p.sobre && !sobre && !p.links.site && !p.links.portfolio) throw new Error('Conte um pouco sobre você (área, texto "Sobre" ou um link) antes de pedir a análise.')
  ANALISE = { id, agente, estado: 'rodando', inicio: Date.now() }
  const A = ANALISE
  perguntar(agente, prompt(p, sobre), { timeout: 300000 })
    .then(r => { A.resultado = extrairJSON(r); A.estado = 'pronto'; salvar(id, { analise: { ...A.resultado, agente, quando: new Date().toISOString() } }) })
    .catch(e => { A.estado = 'falhou'; A.erro = e.message })
  return { estado: 'rodando' }
}
const estadoAnalise = () => ANALISE && { id: ANALISE.id, agente: ANALISE.agente, estado: ANALISE.estado, erro: ANALISE.erro, resultado: ANALISE.resultado, inicio: ANALISE.inicio }

module.exports = { carregar, salvar, lista, ativoId, definirAtivo, resumo, analisar, estadoAnalise, extrairJSON, CORES }
