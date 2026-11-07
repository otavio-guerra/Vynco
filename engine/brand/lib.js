'use strict'
// Biblioteca de desenho das pranchas do design system (gera SVG que o desigma importa sem perda).
// O desigma ignora filtros SVG, então sombras e molduras são feitas com retângulos, como no próprio site (box-shadow duro).
const fs = require('fs')
const path = require('path')

const ROOT = require('../config.js').ROOT
const SITE = require('../config.js').ASSETS

// ---------------------------------------------------------------- tokens (valores reais do css/site.scoped.css, v4.css, v5.css e jogo/js/art.js)
const T = {
  ink: '#1a1230', deep: '#0f0a1e', panel: '#2a2259', panel2: '#342b6e', line: '#4e4590', rim: '#ece4f2',
  text: '#f6f2ff', soft: '#d3caec', muted: '#bdb4e2',
  primary: '#9246f9', primaryHi: '#a974fb', primaryLo: '#7a2fe0', primaryInk: '#2d1468',
  secondary: '#26eda0', secondaryHi: '#62f0b8', secondaryLo: '#17c483', secondaryInk: '#0d3a2c',
  parch: '#fff6e4', sky: '#2f62c8', danger: '#ff8a7a',
  island: { apresentacao: '#a99cff', design: '#ffc640', vfx: '#f05ab0', d3: '#3cc8f0', web: '#3cdcaa', contato: '#e85a48' },
  swamp: { black: '#07060b', pack: '#0d0b14', label: '#15111f', edge: '#2a2440', purple: '#8a3ffc', purpleHi: '#a066ff', lilac: '#b48cff', chrome: '#8c8ca6' },
  quest: { wood: '#7a4a2c', woodDark: '#5a3320', frame: '#3b2416', paper: '#ecdcb6', rust: '#a2552f', wax: '#b8323f', pin: '#e0484f', gold: '#ffc640' },
  card: { film: '#120c22', filmInfo: '#1b1233', rec: '#ff4d5e', glass: '#101833', glassLine: '#8ae6ff', browser: '#142231', browserBar: '#2b3f55', browserUrl: '#8fb3d0' },
  ramps: {
    grass: ['#1d4a45', '#23704c', '#3d9a4c', '#6cc153', '#ade06a'], wood: ['#3a1f2c', '#5e3236', '#8a4d3e', '#b5704c', '#dc9c6a'],
    wall: ['#5d4e82', '#9184b6', '#c7bcdc', '#ece4f2', '#fffaf2'], tile: ['#4a1530', '#7c1f3a', '#b8323e', '#e85a48', '#ff9468'],
    gold: ['#5c2c1c', '#9c5222', '#dc8a2a', '#ffc640', '#fff09a'], cyan: ['#123a6a', '#1460a0', '#1a90d0', '#3cc8f0', '#a8f0ff'],
    pink: ['#4a1044', '#851a6e', '#c22a8e', '#f05ab0', '#ffa6d8'], navy: ['#141436', '#20255a', '#2e3a7e', '#4256a4', '#6a82cc'],
    steel: ['#2c2c4e', '#4a4c74', '#7176a0', '#a3a9cc', '#d8dcf0'], mint: ['#0c3a3a', '#11695c', '#18a084', '#3cdcaa', '#b0ffe2'],
  },
}
const FONT = { display: 'Space Grotesk', copy: 'IBM Plex Sans', pixel: 'Press Start 2P', game: 'VT323', serif: 'DM Serif Display' }

// ---------------------------------------------------------------- cor
const hex2rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) }
const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mix = (a, b, t) => '#' + hex2rgb(a).map((v, i) => Math.round(v + (hex2rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')

// Marca do perfil (tela Perfil): se o perfil em uso pedir ("usar nas peças geradas"), as cores e fontes dele
// substituem os tokens acima. Sem isso, nada muda. Lê só o workspace (funciona dentro da caixa de permissões).
;(function marcaDoPerfil() {
  try {
    const WS = require('../config.js').WS, hex = v => /^#[0-9a-f]{6}$/i.test(v || '')
    const id = JSON.parse(fs.readFileSync(path.join(WS, 'perfis', 'ativo.json'), 'utf8')).id
    const m = JSON.parse(fs.readFileSync(path.join(WS, 'perfis', id, 'perfil.json'), 'utf8')).marca || {}
    if (!m.aplicarNoMotor) return
    const c = m.cores || {}
    if (hex(c.fundo)) Object.assign(T, { ink: c.fundo, deep: mix(c.fundo, '#000000', 0.35), panel: mix(c.fundo, '#ffffff', 0.08), panel2: mix(c.fundo, '#ffffff', 0.14), line: mix(c.fundo, '#ffffff', 0.3) })
    if (hex(c.texto)) Object.assign(T, { text: c.texto, soft: mix(c.texto, T.ink, 0.2), muted: mix(c.texto, T.ink, 0.3) })
    if (hex(c.principal)) Object.assign(T, { primary: c.principal, primaryHi: mix(c.principal, '#ffffff', 0.2), primaryLo: mix(c.principal, '#000000', 0.15), primaryInk: mix(c.principal, '#000000', 0.6) })
    if (hex(c.secundaria)) Object.assign(T, { secondary: c.secundaria, secondaryHi: mix(c.secundaria, '#ffffff', 0.2), secondaryLo: mix(c.secundaria, '#000000', 0.15), secondaryInk: mix(c.secundaria, '#000000', 0.6) })
    if (m.fontes && m.fontes.titulo) FONT.display = m.fontes.titulo
    if (m.fontes && m.fontes.texto) FONT.copy = m.fontes.texto
  } catch { /* sem perfil ou sem marca: tokens padrão */ }
})()
const onColor = bg => (contrast(bg, '#ffffff') >= contrast(bg, T.ink) ? '#ffffff' : T.ink)

// ---------------------------------------------------------------- SVG
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
class Board {
  constructor(name, w, h, bg = T.ink) { this.name = name; this.w = w; this.h = h; this.bg = bg; this.parts = []; this.defs = []; this.n = 0 }
  add(s) { this.parts.push(s); return this }
  // grupo nomeado (vira uma camada com nome no desigma)
  group(name, fn) { this.parts.push(`<g id="${esc(name).replace(/[^\w\-]+/g, '_')}" data-name="${esc(name)}">`); fn(); this.parts.push('</g>'); return this }
  rect(x, y, w, h, fill, o = {}) {
    const a = [`x="${+x.toFixed(2)}"`, `y="${+y.toFixed(2)}"`, `width="${+w.toFixed(2)}"`, `height="${+h.toFixed(2)}"`, `fill="${fill}"`]
    if (o.rx) a.push(`rx="${o.rx}"`)
    if (o.op != null) a.push(`fill-opacity="${o.op}"`)
    if (o.stroke) a.push(`stroke="${o.stroke}"`, `stroke-width="${o.sw || 1}"`)
    if (o.dash) a.push(`stroke-dasharray="${o.dash}"`)
    return this.add(`<rect ${a.join(' ')}/>`)
  }
  circle(cx, cy, r, fill, o = {}) { return this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.op != null ? ` fill-opacity="${o.op}"` : ''}/>`) }
  line(x1, y1, x2, y2, stroke, sw = 1, dash) { return this.add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`) }
  poly(pts, fill, o = {}) { return this.add(`<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}/>`) }
  // texto: o = { f: família, s: tamanho, w: peso, c: cor, a: 'start'|'middle'|'end', ls: letter-spacing, op }
  text(x, y, str, o = {}) {
    const lines = Array.isArray(str) ? str : [str]
    const lh = o.lh || (o.s || 16) * 1.45
    const a = [`x="${x}"`, `y="${y}"`, `font-family="'${o.f || FONT.copy}'"`, `font-size="${o.s || 16}"`, `fill="${o.c || T.text}"`]
    if (o.w) a.push(`font-weight="${o.w}"`)
    if (o.a && o.a !== 'start') a.push(`text-anchor="${o.a}"`)
    if (o.ls) a.push(`letter-spacing="${o.ls}"`)
    if (o.op != null) a.push(`fill-opacity="${o.op}"`)
    if (o.i) a.push('font-style="italic"')
    if (lines.length === 1) return this.add(`<text ${a.join(' ')}>${esc(lines[0])}</text>`)
    return this.add(`<text ${a.join(' ')}>${lines.map((l, i) => `<tspan x="${x}" y="${+(y + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text>`)
  }
  image(x, y, w, h, file, o = {}) {
    const p = path.isAbsolute(file) ? file : path.join(SITE, file)
    if (!fs.existsSync(p)) return this
    const b64 = fs.readFileSync(p).toString('base64')
    return this.add(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" image-rendering="pixelated"${o.op != null ? ` opacity="${o.op}"` : ''} href="data:image/png;base64,${b64}"/>`)
  }
  svg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}">\n<rect id="fundo" width="${this.w}" height="${this.h}" fill="${this.bg}"/>\n${this.parts.join('\n')}\n</svg>\n`
  }
  save(dir) { fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, this.name + '.svg'); fs.writeFileSync(p, this.svg(), 'utf8'); return p }
}

// ---------------------------------------------------------------- peças do design system (réplicas das regras do CSS)
// moldura de RPG: --frame = 0 0 0 3px ink, 0 0 0 6px rim, 0 0 0 9px ink, 6px 8px 0 9px rgba(10,6,24,.45)
function frame(b, x, y, w, h, fill = T.panel) {
  b.rect(x + 6 - 9, y + 8 - 9, w + 18, h + 18, '#0a0618', { op: 0.45 })
  b.rect(x - 9, y - 9, w + 18, h + 18, T.ink)
  b.rect(x - 6, y - 6, w + 12, h + 12, T.rim)
  b.rect(x - 3, y - 3, w + 6, h + 6, T.ink)
  b.rect(x, y, w, h, fill)
}
// botão "cartucho" (v5.css .btn): anel de tinta 3px, brilho em cima, base escura embaixo e sombra dura
function button(b, x, y, label, o = {}) {
  const kind = o.kind || 'primary'
  const sm = o.sm
  const W = o.w || Math.round(label.length * (sm ? 8.4 : 9.4) + (sm ? 28 : 44))
  const H = sm ? 38 : 50
  const base = { primary: T.primary, mint: T.secondary, ghost: 'none', swamp: T.swamp.pack }[kind]
  const bd = { primary: T.primaryLo, mint: T.secondaryLo, ghost: 'none', swamp: '#5a1fb8' }[kind]
  const fg = kind === 'mint' ? T.ink : '#ffffff'
  const dim = o.state === 'disabled'
  const dx = o.state === 'hover' ? -2 : o.state === 'active' ? 2 : 0
  const dy = o.state === 'hover' ? -2 : o.state === 'active' ? 3 : 0
  x += dx; y += dy
  b.rect(x + 4 - 3, y + 6 - 3, W + 6, H + 6, '#0a0618', { op: dim ? 0.25 : 0.55 })
  b.rect(x - 3, y - 3, W + 6, H + 6, T.ink)
  if (kind === 'ghost') {
    b.rect(x, y, W, H, 'rgba(26,18,48,.7)'.replace(/.*/, '#1a1230'), { op: 0.7 })
    b.rect(x + 1, y + 1, W - 2, H - 2, 'none', { stroke: o.state === 'hover' ? T.secondary : T.muted, sw: 2 })
  } else {
    const hover = o.state === 'hover'
    b.rect(x, y, W, H, hover ? { primary: T.primaryHi, mint: T.secondaryHi, swamp: '#1a1530' }[kind] : base, { op: dim ? 0.45 : 1 })
    b.rect(x, y, W, 3, '#ffffff', { op: 0.38 })
    b.rect(x, y + H - 5, W, 5, bd, { op: dim ? 0.45 : 1 })
    if (kind === 'swamp') b.rect(x + 1, y + 1, W - 2, H - 2, 'none', { stroke: T.swamp.purple, sw: 2 })
  }
  if (o.state === 'focus') b.rect(x - 8, y - 8, W + 16, H + 16, 'none', { stroke: T.secondary, sw: 3 })
  const ty = y + H / 2 + (sm ? 5 : 6) - 1
  const tf = kind === 'swamp' ? { f: FONT.serif, s: sm ? 15 : 17, w: 400 } : { f: FONT.display, s: sm ? 14 : 15, w: 700 }
  if (kind !== 'ghost') b.text(x + W / 2, ty + 2, label, { ...tf, c: T.ink, a: 'middle', op: kind === 'mint' ? 0.0 : 0.35 })
  b.text(x + W / 2, ty, kind === 'swamp' ? label.toUpperCase() : label, { ...tf, c: dim ? '#ffffff' : fg, a: 'middle', op: dim ? 0.6 : 1 })
  return { w: W, h: H }
}
// placa (.plaque): fundo pergaminho, anel de tinta 3px e quadradinho colorido
function plaque(b, x, y, label, accent = T.island.apresentacao) {
  const W = label.length * 11 + 12 + 10 + 10 + 12 + 2
  const H = 27
  b.rect(x - 3, y - 3, W + 6, H + 6, T.ink)
  b.rect(x, y, W, H, T.parch)
  b.rect(x + 12, y + 8.5, 10, 10, accent)
  b.text(x + 32, y + 19, label, { f: FONT.pixel, s: 11, c: T.ink, ls: 0.44 })
  return { w: W + 6, h: H + 6 }
}
// etiqueta (.chips li / .tools)
function chip(b, x, y, label, o = {}) {
  const W = o.w || label.length * 7.4 + 28, H = 28
  if (o.tool) { b.rect(x, y, W, H, '#0a2a22', { op: 0.9, stroke: T.secondaryLo, sw: 1 }); b.text(x + 14, y + 19, label, { f: FONT.copy, s: 13, w: 500, c: T.secondary }) }
  else if (o.white) { b.rect(x - 2, y - 2, W + 4, H + 4, T.ink); b.rect(x + 3 - 2, y + 4 - 2, W + 4, H + 4, '#0a0618', { op: 0 }); b.rect(x, y, W, H, T.parch); b.text(x + 20, y + 19, label, { f: FONT.display, s: 13, w: 600, c: T.ink }); b.text(x + 7, y + 19, '✦', { f: FONT.pixel, s: 9, c: T.quest.rust }) }
  else { b.rect(x, y, W, H, T.panel2, { op: 0.8, stroke: o.accent || T.line, sw: 1 }); b.rect(x + 10, y + 11, 6, 6, o.accent || T.primaryHi); b.text(x + 22, y + 19, label, { f: FONT.copy, s: 13, w: 500, c: T.soft }) }
  return { w: W, h: H }
}
// barra de HP/MP/XP da ficha
function bar(b, x, y, w, pct, c1, c2, label) {
  b.rect(x - 2, y - 2, w + 4, 18, T.ink)
  b.rect(x, y, w, 14, T.deep)
  const fw = Math.round(w * pct)
  b.rect(x, y, fw, 14, c1)
  for (let i = 6; i < fw; i += 8) b.rect(x + i, y, 2, 14, c2)
  b.rect(x, y, fw, 3, '#ffffff', { op: 0.4 })
  if (label) b.text(x - 12, y + 12, label, { f: FONT.pixel, s: 9, c: c1, a: 'end' })
}
// cabeçalho padrão das pranchas
function header(b, n, title, sub, accent = T.primary) {
  b.rect(0, 0, b.w, 168, T.deep)
  b.rect(0, 168, b.w, 6, T.ink); b.rect(0, 174, b.w, 3, T.line)
  b.rect(80, 52, 14, 14, accent); b.rect(80 - 3, 52 - 3, 20, 20, 'none', { stroke: T.ink, sw: 0 })
  b.text(108, 66, `PRANCHA ${String(n).padStart(2, '0')}`, { f: FONT.pixel, s: 11, c: T.secondary, ls: 1.5 })
  b.text(80, 124, title, { f: FONT.display, s: 52, w: 700, c: '#ffffff' })
  b.text(b.w - 80, 66, 'ARQUIPÉLAGO · DESIGN SYSTEM', { f: FONT.pixel, s: 10, c: T.muted, a: 'end', ls: 1 })
  b.text(b.w - 80, 124, sub, { f: FONT.copy, s: 18, c: T.soft, a: 'end' })
}
// título de seção dentro da prancha
function section(b, x, y, title, note) {
  b.rect(x, y, 6, 30, T.secondary)
  b.text(x + 20, y + 25, title, { f: FONT.display, s: 28, w: 700, c: '#ffffff' })
  if (note) b.text(x + 20, y + 52, note, { f: FONT.copy, s: 15, c: T.muted })
}
// campo de especificação "rótulo → valor"
function spec(b, x, y, k, v, o = {}) {
  b.text(x, y, k, { f: FONT.pixel, s: 8, c: T.muted, ls: 0.5 })
  b.text(x, y + 20, v, { f: o.mono ? FONT.game : FONT.copy, s: o.mono ? 20 : 14, w: 500, c: o.c || T.text })
}
// estrelas do fundo (determinístico)
function stars(b, seed, n, x0, y0, w, h) {
  let a = seed >>> 0
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = 0; i < n; i++) { const s = rnd() < 0.15 ? 4 : 2; b.rect(x0 + Math.round(rnd() * w / 4) * 4, y0 + Math.round(rnd() * h / 4) * 4, s, s, '#ffffff', { op: 0.25 + rnd() * 0.6 }) }
}

// logo hexagrama (a do carregamento e da runa no mar): círculo, octógono, hexágonos, hexagrama, eixos e os seis círculos pequenos.
// Geometria no sistema da logo original (334 x 408), centrada em (cx, cy) com raio R.
function logoHex(b, cx, cy, R) {
  const U = ([x, y]) => [cx + ((x - 167) / 166.5) * R, cy + ((y - 204) / 166.5) * R]
  const pts = a => a.map(U).map(p => p.map(n => +n.toFixed(1)).join(',')).join(' ')
  const sw = Math.max(1.5, R / 55)
  const poly = (a, c) => `<polygon points="${pts(a)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"/>`
  const seg = (a, c) => { const [p, q] = a.map(U); return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${c}" stroke-width="${sw}"/>` }
  const [ox, oy] = U([167, 204])
  let s = `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="${R}" fill="${T.ink}" fill-opacity=".62"/>`
  s += seg([[61, 98.3], [271.7, 309]], '#5641b8') + seg([[166.5, 37], [166.5, 371]], '#5641b8') + seg([[271.7, 99], [61, 309.7]], '#5641b8')
  s += `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="${R}" fill="none" stroke="#c7bcdc" stroke-width="${sw}"/>`
  s += poly([[166.5, 37], [284.2, 85.8], [333, 203.5], [284.2, 321.2], [166.5, 370], [48.8, 321.2], [0, 203.5], [48.8, 85.8]], '#a99cff')
  s += poly([[166.5, 37], [310.7, 120.25], [310.7, 286.75], [166.5, 370], [22.3, 286.75], [22.3, 120.25]], '#c7bcdc')
  s += poly([[166.5, 114], [244, 248.3], [89, 248.3]], '#fffaf2') + poly([[166.5, 293], [244, 158.8], [89, 158.8]], '#fffaf2')
  s += poly([[218.75, 113], [271, 203.5], [218.75, 294], [114.25, 294], [62, 203.5], [114.25, 113]], '#ffc640')
  for (const c of [[167, 37], [296.5, 126], [296.5, 282], [167, 371], [37, 282], [37, 126]]) { const [x, y] = U(c); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((36.5 / 166.5) * R).toFixed(1)}" fill="none" stroke="#ffc640" stroke-width="${sw}"/>` }
  b.add(s)
}
module.exports = { logoHex, T, FONT, ROOT, SITE, Board, frame, button, plaque, chip, bar, header, section, spec, stars, contrast, mix, onColor, hex2rgb, lum, esc }
