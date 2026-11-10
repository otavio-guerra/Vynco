'use strict'
// Modo automático: a IA cria, o Vynco confere e aprova sozinho, e agenda com uma janela para você vetar.
// O plano da semana sai do seu perfil (frequência e objetivo) e da folga de uso das suas IAs:
//  - com folga, a IA principal cria tudo;
//  - com a semana pela metade, carrosséis (mais pesados, com pesquisa) caem para 1 por semana e a reserva divide o resto;
//  - com a semana quase no fim, só a reserva cria (ou, sem reserva, 1 post de texto por semana).
// Quem aprova é o Vynco (com a sua chave), nunca a IA: ela continua sem acesso à aprovação.

const DIAS = { 1: [2], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] }
const POR_OBJ = { 'conseguir uma vaga': ['licao', 'bastidores', 'dicas'], 'conseguir clientes': ['mito-verdade', 'dicas', 'recomendacao'], 'ser referência na área': ['dicas', 'opiniao', 'passo-a-passo'], 'fazer networking': ['pergunta', 'opiniao', 'bastidores'], 'divulgar meu negócio': ['passo-a-passo', 'bastidores', 'mito-verdade'], 'mudar de área': ['licao', 'recomendacao', 'pergunta'], 'aprender em público': ['licao', 'recomendacao', 'dicas'] }
const PESADO = m => m.formato === 'carrossel' || m.web

function porSemana(freq) {
  const f = String(freq || '').toLowerCase()
  return /todo dia/.test(f) ? 5 : /1 vez/.test(f) ? 1 : /2 a 3/.test(f) ? 3 : 3
}
function candidatos(perfil, modelos) {
  const obj = String(perfil.objetivo || '').toLowerCase(), ids = []
  for (const [o, lista] of Object.entries(POR_OBJ)) if (obj.includes(o)) for (const id of lista) if (!ids.includes(id)) ids.push(id)
  for (const id of ['dicas', 'licao', 'pergunta', 'bastidores', 'mito-verdade', 'recomendacao']) if (!ids.includes(id)) ids.push(id)
  return ids.map(id => modelos.find(m => m.id === id)).filter(Boolean)
}

// lim: { principal: { medidor, janelas: [{ pct }] }, reserva } · reserva: id da IA reserva ou null
function montar({ perfil = {}, modelos = [], lim = {}, reserva = null, cfg = {} }) {
  const semana = lim.principal?.medidor ? (lim.principal.janelas.find(j => /semana/i.test(j.rotulo)) || {}).pct : null
  const sessao = lim.principal?.medidor ? (lim.principal.janelas.find(j => /sess/i.test(j.rotulo)) || {}).pct : null
  let n = porSemana(perfil.frequencia), nivel = 'normal', motivo
  if (semana == null) motivo = 'A sua IA não informa o uso, então o plano segue a frequência do seu perfil.'
  else if (semana < 50) motivo = `A sua semana está em ${semana}%: dá para seguir a frequência do perfil com folga.`
  else if (semana < 80) { nivel = 'economia'; motivo = `A sua semana já está em ${semana}%: carrossel (o mais pesado) cai para 1 por semana${reserva ? ' e a IA reserva divide o resto' : ''}.` }
  else { nivel = 'reserva'; if (!reserva) n = 1; motivo = reserva ? `A sua semana está em ${semana}%: até renovar, só a IA reserva cria.` : `A sua semana está em ${semana}%: 1 post de texto por semana até renovar. Ligue uma IA reserva (o Gemini é grátis) para manter o ritmo.` }

  const lista = candidatos(perfil, modelos), slots = []
  let carrosseis = 0
  ;(DIAS[n] || DIAS[3]).forEach((dia, k) => {
    // o primeiro modelo da lista que ainda não entrou na semana e cabe no nível (economia: no máximo 1 pesado)
    const cabe = x => nivel === 'normal' || !PESADO(x) || (carrosseis < 1 && !(nivel === 'reserva' && !reserva))
    const livre = x => !slots.some(sl => sl.modelo === x.id)
    const m = lista.find(x => livre(x) && cabe(x)) || lista.find(cabe) || lista[k % lista.length]
    if (PESADO(m)) carrosseis++
    const ia = nivel === 'reserva' ? (reserva ? 'reserva' : 'principal') : nivel === 'economia' && reserva && k % 2 === 1 ? 'reserva' : 'principal'
    slots.push({ dia, modelo: m.id, titulo: m.titulo, formato: m.formato, criar: cfg.criar || '07:00', publicar: cfg.publicar || '12:00', ia })
  })
  // Daily UI (opcional, para quem é de design): todo dia útil, cria cedo e publica às 10h
  if (cfg.dailyUi && modelos.some(m => m.id === 'daily-ui')) for (const dia of [1, 2, 3, 4, 5]) slots.push({ dia, modelo: 'daily-ui', titulo: 'Daily UI', formato: 'imagem', criar: '07:30', publicar: '10:00', ia: nivel === 'reserva' && reserva ? 'reserva' : 'principal' })
  return { porSemana: slots.length, nivel, motivo, folga: { sessao, semana }, slots: slots.sort((a, b) => a.dia - b.dia || a.publicar.localeCompare(b.publicar)) }
}

// conferência antes de aprovar sozinho; devolve o motivo quando não passa
function conferir(it, perfil = {}) {
  const leg = String(it.caption || '').trim()
  if (it.rascunho) return 'ainda é rascunho'
  if (it.formato !== 'texto' && !it.hasFile) return 'a peça não foi gerada'
  if (leg.length < 40) return 'a legenda está curta demais'
  if (leg.length > 3000) return 'a legenda passa de 3.000 caracteres'
  if (/\b(todo|lorem ipsum|xxx|placeholder)\b|\[(inserir|preencher|link)[^\]]*\]/i.test(leg)) return 'a legenda tem um trecho por preencher'
  if (it.formato === 'carrossel' && it.paginas != null && it.paginas < 3) return 'o carrossel tem menos de 3 páginas'
  const evitar = (Array.isArray(perfil.evitar) ? perfil.evitar : String(perfil.evitar || '').split(',')).map(s => s.trim().toLowerCase()).filter(s => s.length > 2)
  const achou = evitar.find(p => leg.toLowerCase().includes(p))
  if (achou) return `a legenda fala de "${achou}", que está em "Evitar" no seu perfil`
  return null
}

// o próximo horário de publicação do slot, com pelo menos `veto` horas para você ver antes
function horario(hhmm, { veto = 2, ocupados = [] } = {}) {
  const [h, m] = String(hhmm || '12:00').split(':').map(Number), min = Date.now() + veto * 36e5
  const d = new Date(); d.setHours(h, m, 0, 0)
  for (let k = 0; k < 14; k++) {
    if (d.getTime() >= min && ![0, 6].includes(d.getDay()) && !ocupados.some(o => Math.abs(new Date(o) - d) < 30 * 60000)) return d
    d.setDate(d.getDate() + 1)
  }
  return d
}

module.exports = { montar, conferir, horario, porSemana }
