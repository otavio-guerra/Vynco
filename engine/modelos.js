'use strict'
// Modelos de post do Vynco: peças prontas que a IA cria a partir do perfil (área, público, tom, pilares), para qualquer profissão.
// Cada modelo vira uma rotina: o Vynco escreve as instruções em workspace/rotinas/<id>.md e a IA escolhida executa.
// - carrossel: a IA escreve uma pauta em engine/noticias/pautas/ (o mesmo motor dos carrosséis) e exporta PNG + PDF
// - texto: a IA cria uma pasta em workspace/avulsos/ com legenda.txt e post.json (entra na fila para aprovação)
// - Daily UI e o carrossel de notícias de design continuam, mas só aparecem para quem é da área de design.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')

const MODELOS = [
  { id: 'noticias-da-area', titulo: 'Notícias da sua área', formato: 'carrossel', web: true, freq: 'semanal', desc: 'O assunto mais quente da semana na sua área, com o que aconteceu, o outro lado e a sua leitura. Fontes checadas.' },
  { id: 'dicas', titulo: 'Dicas práticas', formato: 'carrossel', freq: 'semanal', desc: 'De 5 a 7 dicas curtas e acionáveis sobre um dos seus pilares, uma por slide.' },
  { id: 'mito-verdade', titulo: 'Mito ou verdade', formato: 'carrossel', freq: 'quinzenal', desc: 'Crenças comuns da sua área desmontadas com argumentos simples.' },
  { id: 'passo-a-passo', titulo: 'Passo a passo', formato: 'carrossel', freq: 'quinzenal', desc: 'Como fazer algo que o seu público precisa, em etapas claras.' },
  { id: 'licao', titulo: 'Lição aprendida', formato: 'texto', freq: 'semanal', desc: 'Uma história curta: o que aconteceu, o que você aprendeu e o que faria diferente.' },
  { id: 'bastidores', titulo: 'Bastidores do trabalho', formato: 'texto', freq: 'quinzenal', desc: 'Um processo, uma rotina ou uma ferramenta do seu dia a dia, contado com honestidade.' },
  { id: 'opiniao', titulo: 'Opinião sobre uma tendência', formato: 'texto', web: true, freq: 'quinzenal', desc: 'Uma tendência recente da área e o seu ponto de vista, com os dois lados.' },
  { id: 'pergunta', titulo: 'Pergunta para a rede', formato: 'texto', freq: 'semanal', desc: 'Um post curto que termina numa pergunta e puxa conversa nos comentários.' },
  { id: 'recomendacao', titulo: 'Recomendação', formato: 'texto', freq: 'mensal', desc: 'Um livro, curso, ferramenta ou pessoa que ajudou você, e por quê.' },
  // específicos de design (só aparecem para quem é da área)
  { id: 'daily-ui', titulo: 'Daily UI', formato: 'imagem', areas: ['design', 'ux', 'ui', 'produto'], freq: 'diario', desc: 'A tela do desafio Daily UI do dia, com as decisões de UX numeradas.', prompt: 'prompts/daily-ui.md' },
  { id: 'pauta-noticias', titulo: 'Carrosséis de IA e design', formato: 'carrossel', web: true, areas: ['design', 'ux', 'ui'], freq: 'diario', desc: 'Dois carrosséis por dia sobre IA, tecnologia e design.', prompt: 'prompts/pauta-noticias.md' },
]
const FREQ = { diario: 'todo dia útil', semanal: 'uma vez por semana', quinzenal: 'a cada 15 dias', mensal: 'uma vez por mês' }

// o modelo serve para esta pessoa? (os gerais servem para todo mundo; os de design, só para quem é da área)
function serve(m, perfil) {
  if (!m.areas) return true
  if (!String(perfil.area || '').trim()) return true   // área ainda não preenchida: mostra tudo (a triagem pergunta a área)
  const area = `${perfil.area || ''} ${(perfil.temas || []).join(' ')}`.toLowerCase()
  return m.areas.some(a => new RegExp(`\\b${a}`, 'i').test(area))
}
const disponiveis = perfil => MODELOS.filter(m => serve(m, perfil)).map(m => ({ ...m, freqTxt: FREQ[m.freq] }))

function instrucoes(m) {
  const hoje = new Date().toISOString().slice(0, 10), id = `${hoje}-${m.id}`
  const comum = `Você vai criar um post do tipo "${m.titulo}" para o LinkedIn de quem está descrito em workspace/perfil.md. Leia esse arquivo antes de tudo e escreva para o público, no tom e dentro da área que estão lá. Responda em português do Brasil, frases curtas.
O que é este modelo: ${m.desc}
Escolha o assunto pelos pilares e temas do perfil. Não repita assuntos já publicados (workspace/publicados.json) nem de posts recentes (pastas em workspace/avulsos/ e pautas em engine/noticias/pautas/).
Não invente fatos, números, datas, falas, clientes ou resultados sobre a pessoa. ${m.web ? 'Pesquise na web e confira cada fato numa fonte primária ou em dois veículos sérios; cite as fontes no fim da legenda.' : 'Se precisar de um exemplo pessoal que não está no perfil, escreva de um jeito que a pessoa possa completar, entre colchetes, como [conte aqui um caso seu].'}`
  if (m.formato === 'carrossel') return `${comum}

Formato: carrossel (PDF). Escreva engine/noticias/pautas/${id}.js no mesmo formato de engine/noticias/pautas/2026-11-03-a.js: exporta { titulo, accent, tema, fontes, slides, caption }. De 5 a 8 slides; use só as peças k.kick, k.title, k.para, k.cards e k.bubble e os tokens T de engine/brand/lib.js (nunca cores fixas). O primeiro slide é o gancho; o último termina com uma pergunta.
A legenda (caption) segue a skill vynco-legendas.
Depois rode: node engine/noticias/carrossel.js engine/noticias/pautas/${id}.js e node engine/noticias/exportar.js ${id}. Abra os PNG em workspace/noticias/png/${id}/ e corrija textos cortados ou sobrepostos.
Termine dizendo o título e "Pronto para aprovação no Vynco." Não publique nada.`
  return `${comum}

Formato: post de texto. Crie a pasta workspace/avulsos/${id}/ com dois arquivos:
- legenda.txt: o post completo (até 1.300 caracteres), seguindo a skill vynco-legendas;
- post.json: {"titulo": "<um título curto para a pessoa achar o post>", "rascunho": false}.
Termine dizendo o título e "Pronto para aprovação no Vynco." Não publique nada.`
}

// escreve as instruções do modelo e devolve o caminho relativo à raiz do Vynco (para a rotina)
function preparar(id) {
  const m = MODELOS.find(x => x.id === id); if (!m) throw new Error('modelo desconhecido')
  if (m.prompt) return { titulo: m.titulo, prompt: m.prompt }
  const arq = C.ws('rotinas', id + '.md'); fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, instrucoes(m), 'utf8')
  return { titulo: m.titulo, prompt: path.relative(C.ROOT, arq).split(path.sep).join('/') }
}

module.exports = { MODELOS, FREQ, disponiveis, preparar, serve }
