'use strict'
// Gera as pranchas do Vynco Design System em SVG (para abrir no Desigma e salvar como projeto editável).
//   node docs/design-system/gerar.js [saida.svg]
const fs = require('fs'), path = require('path')
const OUT = process.argv[2] || path.join(__dirname, 'vynco-design-system.svg')
const F = "'Segoe UI Variable Display','Segoe UI',sans-serif", FT = "'Segoe UI Variable Text','Segoe UI',sans-serif"
const W = 1600, P = 72
const C = { bg: '#0C1220', bg2: '#080D18', bg3: '#131A2B', text: '#F4F5FA', soft: '#AAB0C8', faint: '#8D93AD', edge: 'rgba(255,255,255,.09)', glass: 'rgba(255,255,255,.045)', brand: '#6C63FF', accent: '#8C85FF', btn: '#625AF6', green: '#7FFFD4', amber: '#FFB547', red: '#FF6470' }
const SEC = [['Início', '#8C85FF'], ['Estratégia', '#34D3C2'], ['Criar', '#FF8A65'], ['Revisar', '#FFB547'], ['Agenda', '#5AA9FF'], ['Rede', '#F472B6'], ['Ajustes', '#A3AEC6']]
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
let y = 0
const out = []
const t = (x, yy, s, o = {}) => out.push(`<text x="${x}" y="${yy}" font-family="${o.f || FT}" font-size="${o.s || 14}" font-weight="${o.w || 400}" fill="${o.c || C.text}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}>${esc(s)}</text>`)
const r = (x, yy, w, h, fill, o = {}) => out.push(`<rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="${o.rx || 0}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`)
const prancha = (titulo, sub, h, fn) => {
  out.push(`<g id="${esc(titulo)}" data-name="${esc(titulo)}">`)
  r(0, y, W, h, C.bg); r(0, y, W, 4, C.brand)
  t(P, y + 64, 'VYNCO DESIGN SYSTEM 1.0', { s: 11, w: 600, c: C.accent, ls: 1.4 })
  t(P, y + 108, titulo, { f: F, s: 34, w: 700 }); t(P, y + 140, sub, { s: 15, c: C.soft })
  fn(y + 190); out.push('</g>'); y += h + 40
}

prancha('Cores', 'Marca, neutros e estados. A cor forte fica para marca, brilho e estado; o texto usa neutros com contraste AA.', 560, y0 => {
  const cores = [['Vynco Purple', '--brand', C.brand], ['Midnight', '--bg', C.bg], ['Superfície', '--bg-3', C.bg3], ['Cloud', '--text', C.text], ['Apoio', '--soft', C.soft], ['Rótulo', '--faint', C.faint], ['Foco / link', '--accent', C.accent], ['Botão', '--btn', C.btn], ['Mint · sucesso', '--green', C.green], ['Âmbar · atenção', '--amber', C.amber], ['Erro', '--red', C.red]]
  cores.forEach(([n, tok, hex], i) => {
    const x = P + (i % 6) * 244, yy = y0 + Math.floor(i / 6) * 170
    r(x, yy, 220, 96, hex, { rx: 16, stroke: C.edge }); t(x, yy + 122, n, { s: 15, w: 600 }); t(x, yy + 144, `${tok} · ${hex}`, { s: 12, c: C.faint })
  })
})
prancha('Cores por seção', 'Cada área tem a sua cor: sobretítulo, indicador do menu, item ativo e brilho do fundo. Nunca no texto corrido.', 470, y0 => {
  SEC.forEach(([n, hex], i) => {
    const x = P + i * 208
    r(x, y0, 188, 188, C.bg3, { rx: 16, stroke: C.edge })
    r(x, y0, 188, 188, hex + '1f', { rx: 16 }); r(x + 20, y0 + 20, 36, 36, hex + '29', { rx: 8, stroke: hex + '59' })
    t(x + 20, y0 + 92, n.toUpperCase(), { s: 11, w: 600, c: hex, ls: 1.3 }); t(x + 20, y0 + 124, n, { f: F, s: 22, w: 700 })
    r(x + 20, y0 + 144, 44, 3, hex, { rx: 2 }); t(x + 20, y0 + 172, hex, { s: 12, c: C.faint })
  })
})
prancha('Tipografia', 'Segoe UI Variable em 8 degraus. Maiúsculas só em sobretítulos, sempre em 11 px, peso 600 e espaçamento .08em.', 720, y0 => {
  const esc8 = [['Display · 34/1.15 · 700', 34, 700, 'Bom dia, Otavio.', F], ['Title · 22/1.3 · 700', 22, 700, 'Uma lição desta semana', F], ['Heading · 17/1.3 · 600', 17, 600, 'Vai ao ar', F], ['Body large · 15/1.5 · 400', 15, 400, 'O próximo post sai amanhã, às 09:00.', FT], ['Body · 14/1.5 · 400', 14, 400, 'Leia a prévia e aprove. Nada vai ao ar sem isso.', FT], ['Small · 13/1.5 · 400', 13, 400, 'A sua IA lê isto antes de cada post.', FT], ['Caption · 12/1.4 · 400', 12, 400, 'qua., 11 de nov. · 09:00 · Público', FT], ['Overline · 11 · 600 · .08em', 11, 600, 'SEU CICLO · PRÓXIMO POST · APROVADO', FT]]
  let yy = y0
  esc8.forEach(([rot, s, w, ex, f]) => { t(P, yy + 20, rot, { s: 12, c: C.faint }); t(P + 300, yy + 22, ex, { f, s, w, ls: s === 11 ? 1.2 : 0 }); r(P, yy + 44, W - 2 * P, 1, C.edge); yy += 62 })
})
prancha('Espaçamento, raios e elevação', 'Escala de 4 px. Cinco raios. Três níveis de sombra.', 560, y0 => {
  [4, 8, 12, 16, 20, 24, 32, 40, 56].forEach((v, i) => { const x = P + i * 92; r(x, y0 + 56 - v, v, v, C.accent + '55', { rx: 2 }); t(x, y0 + 84, `${v}`, { s: 13, w: 600 }); t(x, y0 + 102, `--sp-${[1, 2, 3, 4, 5, 6, 8, 10, 14][i]}`, { s: 11, c: C.faint }) })
  ;[[8, 'sm · campos'], [12, 'md · botões, menus'], [16, 'lg · cartões'], [20, 'xl · destaque, diálogos'], [999, 'pill · chips, abas']].forEach(([v, n], i) => { const x = P + i * 200, yy = y0 + 150; r(x, yy, 168, 96, C.glass, { rx: Math.min(v, 48), stroke: C.edge }); t(x, yy + 124, `${v === 999 ? '999' : v} px`, { s: 14, w: 600 }); t(x, yy + 144, n, { s: 12, c: C.faint }) })
  ;[['e-1', 'cartões em repouso', 20], ['e-2', 'menus, avisos, hover', 40], ['e-3', 'diálogos e tour', 70]].forEach(([n, d, b], i) => { const x = P + 1040 + i * 150, yy = y0 + 150; out.push(`<rect x="${x}" y="${yy + b / 6}" width="120" height="96" rx="16" fill="#000" opacity="${0.18 + i * 0.12}" filter="url(#sombra${i})"/>`); r(x, yy, 120, 96, C.bg3, { rx: 16, stroke: C.edge }); t(x, yy + 124, '--' + n, { s: 14, w: 600 }); t(x, yy + 144, d, { s: 12, c: C.faint }) })
})
prancha('Componentes', 'Botões, chips, lista de escolha, aviso, erro explicado e barra da janela, no estilo do app (nada de navegador ou Windows).', 760, y0 => {
  // botões
  r(P, y0, 196, 44, C.btn, { rx: 12 }); t(P + 98, y0 + 28, 'Ligar o modo automático', { s: 14, w: 600, a: 'middle' })
  r(P + 216, y0, 120, 44, C.glass, { rx: 12, stroke: 'rgba(255,255,255,.16)' }); t(P + 276, y0 + 28, 'Voltar', { s: 14, w: 600, a: 'middle' })
  t(P + 360, y0 + 28, 'Ajustar em Estratégia', { s: 14, w: 600, c: C.accent })
  // chips com modos
  ;[['Esperando você', C.amber, true], ['Aprovados', C.green, false], ['Rascunhos', '#A3AEC6', false]].forEach(([n, c, on], i) => { const x = P + i * 170, yy = y0 + 80; r(x, yy, 156, 36, on ? c + '29' : C.glass, { rx: 18, stroke: on ? c + '8c' : 'rgba(255,255,255,.16)' }); out.push(`<circle cx="${x + 18}" cy="${yy + 18}" r="4" fill="${c}"/>`); t(x + 30, yy + 23, n, { s: 13, w: 600, c: on ? C.text : C.soft }) })
  // lista de escolha
  const lx = P + 560, ly = y0
  r(lx, ly, 200, 38, 'rgba(255,255,255,.08)', { rx: 8, stroke: 'rgba(255,255,255,.16)' }); t(lx + 12, ly + 24, '2 horas', { s: 14, w: 500 }); out.push(`<path d="M${lx + 176} ${ly + 16} l5 5 l5 -5" fill="none" stroke="${C.soft}" stroke-width="1.8" stroke-linecap="round"/>`)
  r(lx, ly + 46, 200, 150, C.bg3, { rx: 12, stroke: 'rgba(255,255,255,.16)' })
  ;['1 hora', '2 horas', '4 horas', '12 horas'].forEach((n, i) => { const yy = ly + 54 + i * 34; if (i === 1) r(lx + 4, yy, 192, 30, 'rgba(255,255,255,.08)', { rx: 8 }); t(lx + 16, yy + 20, n, { s: 14, w: i === 1 ? 600 : 400, c: i === 1 ? C.text : C.soft }); if (i === 1) out.push(`<circle cx="${lx + 86}" cy="${yy + 15}" r="3" fill="${SEC[2][1]}"/>`) })
  // aviso
  const ax = P + 820
  r(ax, y0, 380, 64, C.bg3, { rx: 12, stroke: 'rgba(255,255,255,.16)' }); out.push(`<circle cx="${ax + 22}" cy="${y0 + 32}" r="6" fill="${C.green}"/>`); t(ax + 40, y0 + 28, 'Pronto: Dicas práticas', { s: 14, w: 600 }); t(ax + 40, y0 + 48, 'O post está em Revisar esperando você.', { s: 12, c: C.soft }); r(ax, y0 + 62, 240, 2, C.green, { rx: 1 })
  // erro explicado
  r(ax, y0 + 90, 380, 92, 'rgba(255,181,71,.09)', { rx: 12, stroke: 'rgba(255,181,71,.32)' }); t(ax + 14, y0 + 116, 'A sua IA chegou ao limite de uso', { s: 14, w: 600, c: C.amber }); t(ax + 14, y0 + 138, 'Ela volta quando a cota renovar. Com uma IA reserva,', { s: 13, c: C.soft }); t(ax + 14, y0 + 156, 'o Vynco não para.', { s: 13, c: C.soft }); t(ax + 14, y0 + 174, 'Abrir Ajustes', { s: 13, w: 600, c: C.accent })
  // barra da janela
  const bx = P, by = y0 + 240
  r(bx, by, W - 2 * P, 52, C.bg2, { rx: 12, stroke: C.edge }); t(bx + 20, by + 32, 'vynco', { f: F, s: 15, w: 600 })
  ;['—', '▢', '✕'].forEach((g, i) => { const x = bx + W - 2 * P - 138 + i * 46; if (i === 2) r(x, by, 46, 34, '#c42b1c'); t(x + 23, by + 22, g, { s: 12, c: i === 2 ? '#fff' : C.soft, a: 'middle' }) })
  t(bx, by + 84, 'Barra da janela do próprio Vynco: arrastar, minimizar, maximizar e fechar (fechar esconde na bandeja).', { s: 13, c: C.faint })
  // menu do botão direito
  const cx = P + 820, cy = by + 110
  r(cx, cy, 200, 150, C.bg3, { rx: 12, stroke: 'rgba(255,255,255,.16)' })
  ;[['Recortar', 1], ['Copiar', 1], ['Colar', 1], ['Selecionar tudo', 1]].forEach(([n], i) => t(cx + 16, cy + 30 + i * 32 + (i === 3 ? 8 : 0), n, { s: 13, w: 500, c: i === 0 ? C.faint : C.text }))
  r(cx + 8, cy + 112, 184, 1, C.edge)
  t(P, cy + 30, 'Botão direito: só nos campos de texto, com o menu do app. No resto, nada (sem menu de navegador).', { s: 13, c: C.faint })
})

const H = y
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${[0, 1, 2].map(i => `<filter id="sombra${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${[8, 14, 22][i]}"/></filter>`).join('')}</defs>${out.join('')}</svg>`)
console.log(JSON.stringify({ svg: OUT, altura: H }))
