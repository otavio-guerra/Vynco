'use strict'
// Daily UI: gera o SVG e a legenda de um dia a partir de dias/NNN.js.
//   node dia.js hoje        → mostra o número e o tema de hoje (conta só dias úteis desde temas.json.inicio)
//   node dia.js 1           → gera ../svg/001-<tema>.svg e ../legendas/001.txt
require('../caixa.js')(__filename)   // dias/NNN.js é escrito pela IA: roda sem processos, sem rede e sem acesso ao cofre
const fs = require('fs')
const path = require('path')
const { Board, T, FONT } = require('../brand/lib.js')
const { ui, W, H } = require('./ui.js')

const C = require('../config.js'), ROOT = C.ws('dailyui'), SRC = __dirname
const { temas } = JSON.parse(fs.readFileSync(path.join(SRC, 'temas.json'), 'utf8')), inicio = C.cfg.dailyUiStart

// a Press Start 2P não tem acentos
const text0 = Board.prototype.text
Board.prototype.text = function (x, y, str, o = {}) {
  if (o.f === FONT.pixel) { const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); str = Array.isArray(str) ? str.map(strip) : strip(str) }
  return text0.call(this, x, y, str, o)
}

function diaDeHoje(hoje = new Date()) {
  const d = new Date(inicio + 'T12:00:00'), fim = new Date(hoje.toISOString().slice(0, 10) + 'T12:00:00')
  if (fim < d) return 0
  let n = 0
  for (; d <= fim; d.setDate(d.getDate() + 1)) if (d.getDay() % 6 !== 0) n++
  return n
}
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const arg = process.argv[2]
if (!arg || arg === 'hoje') {
  const n = diaDeHoje(), fimDeSemana = [0, 6].includes(new Date().getDay())
  console.log(JSON.stringify({ dia: n, tema: temas[n - 1] || null, fimDeSemana, modulo: `dias/${String(n).padStart(3, '0')}.js` }))
  process.exit(0)
}

const n = +arg, nn = String(n).padStart(3, '0')
const mod = require(path.join(SRC, 'dias', nn + '.js'))
const tema = mod.tema || temas[n - 1]
const nome = `${nn}-${slug(tema)}`
const b = new Board(nome, W, H, T.ink)
const k = ui(b)
k.chromeDaily(n, tema, mod.accent)
mod.draw(k, { n, tema })
b.save(path.join(ROOT, 'svg'))
fs.mkdirSync(path.join(ROOT, 'legendas'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'legendas', nn + '.txt'), mod.caption.trim() + '\n', 'utf8')
console.log(JSON.stringify({ dia: n, tema, svg: `svg/${nome}.svg`, legenda: `legendas/${nn}.txt`, quadro: `Daily UI ${nn} · ${tema}` }))
