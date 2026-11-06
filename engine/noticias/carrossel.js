'use strict'
// Carrossel de notícias (LinkedIn: PDF com páginas 1080 × 1350), na identidade do Arquipélago.
//   node carrossel.js <pautas/AAAA-MM-DD-x.js>
// Gera svg/<id>/NN.svg (um por slide), svg/<id>.svg (todos lado a lado, para o Desigma) e legendas/<id>.txt.
require('../caixa.js')(__filename)   // a pauta é escrita pela IA: roda sem processos, sem rede e sem acesso ao cofre
const fs = require('fs')
const path = require('path')
const L = require('../brand/lib.js')
const { W, H, M, kit, wrap } = require('../brand/kit.js')
const { Board, T, FONT } = L

const ROOT = require('../config.js').ws('noticias')
const text0 = Board.prototype.text
Board.prototype.text = function (x, y, str, o = {}) {
  if (o.f === FONT.pixel) { const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); str = Array.isArray(str) ? str.map(strip) : strip(str) }
  return text0.call(this, x, y, str, o)
}

// seta desenhada (o desigma troca símbolos como → por emoji)
function arrow(b, x, y, c, s = 1) {
  b.rect(x, y - 3 * s, 34 * s, 6 * s, c)
  b.poly([[x + 30 * s, y - 14 * s], [x + 46 * s, y], [x + 30 * s, y + 14 * s]], c)
}

function slideKit(b, i, total, pauta) {
  const k = kit(b), A = pauta.accent || T.secondary
  return Object.assign(k, {
    A,
    chrome() {
      b.rect(0, 0, W, H, T.ink)
      k.stars(900 + i * 41, 50, 0, 110, W - 8, H - 240)
      b.rect(0, 0, W, 100, T.deep); b.rect(0, 100, W, 4, T.ink); b.rect(0, 104, W, 4, T.deep)
      b.rect(0, 104, Math.round(W * i / total), 4, A)
      b.rect(M, 42, 18, 18, A)
      b.text(M + 32, 60, 'BOLETIM DO ARQUIPELAGO', { f: FONT.pixel, s: 14, c: T.secondary, ls: 1.5 })
      b.text(W - M, 60, `${i}/${total}`, { f: FONT.pixel, s: 14, c: T.muted, a: 'end' })
      b.rect(0, H - 124, W, 4, T.line); b.rect(0, H - 120, W, 120, T.deep)
      k.og(M, H - 94, 64)
      b.text(M + 88, H - 62, 'Otavio Guerra', { f: FONT.display, s: 26, w: 700, c: '#ffffff' })
      b.text(M + 88, H - 30, pauta.tema || 'IA · Tecnologia · Design', { f: FONT.copy, s: 18, c: T.soft })
      if (i < total) { b.text(W - M - 64, H - 50, 'ARRASTA', { f: FONT.pixel, s: 12, c: A, a: 'end' }); arrow(b, W - M - 50, H - 56, A) }
      else b.text(W - M, H - 50, 'FIM', { f: FONT.pixel, s: 12, c: A, a: 'end' })
    },
    // número grande + rótulo (dado de destaque)
    stat(x, y, num, label, c = A) {
      k.title(x, y, num, { s: 120, c, sc: T.primaryInk })
      return k.para(x, y + 64, label, { s: 26, c: T.soft, maxw: W - 2 * M - (x - M) })
    },
    // lista numerada em cartões
    cards(y, items, o = {}) {
      const h = o.h || 150, gap = o.gap || 26
      items.forEach(([t, d], j) => {
        const cy = y + j * (h + gap)
        k.card(M + 9, cy, W - 2 * M - 18, h, { fill: T.panel, accent: A })
        k.text(M + 40, cy + 66, o.labels ? o.labels[j] : String(j + 1).padStart(2, '0'), { f: FONT.pixel, s: o.labels ? 16 : 26, c: A })
        k.text(M + (o.labels ? 190 : 130), cy + 62, t, { f: FONT.display, s: 30, w: 700, c: '#ffffff' })
        k.para(M + (o.labels ? 190 : 130), cy + 102, d, { s: 22, c: T.soft, maxw: W - 2 * M - (o.labels ? 230 : 170), lh: 30 })
      })
      return y + items.length * (h + gap)
    },
    fonte(y, s) { b.text(M, y, 'FONTE', { f: FONT.pixel, s: 11, c: T.muted }); k.para(M + 80, y, s, { s: 18, c: T.muted, maxw: W - 2 * M - 80, lh: 24 }) },
    arrow: (x, y, c = A, s = 1) => arrow(b, x, y, c, s),
  })
}

const arq = path.resolve(process.cwd(), process.argv[2])
const pauta = require(arq)
const id = path.basename(arq, '.js')
const total = pauta.slides.length
const dir = path.join(ROOT, 'svg', id)
fs.mkdirSync(dir, { recursive: true })
const GAP = 120
const all = new Board(id, total * W + (total - 1) * GAP, H, T.deep)
pauta.slides.forEach((fn, j) => {
  const i = j + 1, nn = String(i).padStart(2, '0')
  const one = new Board(nn, W, H, T.ink)
  const k1 = slideKit(one, i, total, pauta); k1.chrome(); fn(k1)
  one.save(dir)
  all.add(`<g id="Slide ${nn}" data-name="Slide ${nn}" transform="translate(${j * (W + GAP)} 0)">`)
  const k2 = slideKit(all, i, total, pauta); k2.chrome(); fn(k2)
  all.add('</g>')
})
all.save(path.join(ROOT, 'svg'))
fs.mkdirSync(path.join(ROOT, 'legendas'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'legendas', id + '.txt'), pauta.caption.trim() + '\n', 'utf8')
console.log(JSON.stringify({ id, titulo: pauta.titulo, slides: total, svg: `svg/${id}.svg`, legenda: `legendas/${id}.txt` }))
