'use strict'
// Vynco · GIF feito no próprio computador, sem créditos e sem instalar nada.
//  - GIF.deVideo(url, opções): lê os quadros de um vídeo da biblioteca (num <video> escondido) e monta o GIF;
//  - GIF.deImagens(urls, opções): monta um GIF com as imagens em sequência (corte seco ou passagem suave).
// Paleta única de até 256 cores (corte pela mediana a partir de amostras de todos os quadros), pontilhado
// ordenado opcional e compressão LZW, como manda a especificação GIF89a. Tudo roda aqui, nada sai do computador.
;(() => {
  // ------------------------------------------------------------------ bytes
  function Bytes() { let b = new Uint8Array(1 << 20), n = 0
    const cabe = k => { if (n + k <= b.length) return; let c = b.length * 2; while (c < n + k) c *= 2; const nb = new Uint8Array(c); nb.set(b.subarray(0, n)); b = nb }
    return { byte(v) { cabe(1); b[n++] = v & 255 }, bytes(a) { cabe(a.length); b.set(a, n); n += a.length }, u16(v) { this.byte(v); this.byte(v >> 8) }, texto(t) { for (const c of t) this.byte(c.charCodeAt(0)) }, fim: () => b.slice(0, n) }
  }

  // ------------------------------------------------------------------ paleta: corte pela mediana sobre cores de 15 bits
  function paleta(hist, max) {
    const cores = []; for (let i = 0; i < 32768; i++) if (hist[i]) cores.push(i)
    if (!cores.length) cores.push(0)
    const caixas = [cores]
    const faixa = c => { let a = [31, 31, 31], z = [0, 0, 0]; for (const k of c) { const v = [k >> 10, (k >> 5) & 31, k & 31]; for (let j = 0; j < 3; j++) { if (v[j] < a[j]) a[j] = v[j]; if (v[j] > z[j]) z[j] = v[j] } } return [z[0] - a[0], z[1] - a[1], z[2] - a[2]] }
    while (caixas.length < max) {
      let melhor = -1, qual = -1, eixo = 0
      caixas.forEach((c, i) => { if (c.length < 2) return; const f = faixa(c), e = f.indexOf(Math.max(...f)); let peso = 0; for (const k of c) peso += hist[k]; const nota = f[e] * Math.sqrt(peso); if (nota > melhor) { melhor = nota; qual = i; eixo = e } })
      if (qual < 0) break
      const c = caixas[qual], sh = [10, 5, 0][eixo]
      c.sort((x, y) => ((x >> sh) & 31) - ((y >> sh) & 31))
      let tot = 0; for (const k of c) tot += hist[k]
      let acc = 0, m = 0; for (; m < c.length - 2; m++) { acc += hist[c[m]]; if (acc >= tot / 2) break }
      caixas.splice(qual, 1, c.slice(0, m + 1), c.slice(m + 1))
    }
    return caixas.map(c => { let r = 0, g = 0, b = 0, t = 0; for (const k of c) { const w = hist[k] || 1; r += ((k >> 10) * 8 + 4) * w; g += (((k >> 5) & 31) * 8 + 4) * w; b += ((k & 31) * 8 + 4) * w; t += w } return [Math.round(r / t), Math.round(g / t), Math.round(b / t)] })
  }
  function mapa(pal) {
    const tab = new Int16Array(32768).fill(-1)
    return k => {
      let v = tab[k]; if (v >= 0) return v
      const r = (k >> 10) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4
      let d = 1e9; for (let i = 0; i < pal.length; i++) { const p = pal[i], e = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (e < d) { d = e; v = i } }
      tab[k] = v; return v
    }
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.47) * 10)

  // ------------------------------------------------------------------ LZW (código de tamanho variável, até 12 bits)
  function lzw(px, min, out) {
    out.byte(min)
    const LIMPA = 1 << min, FIM = LIMPA + 1
    let tam = min + 1, prox = FIM + 1, dic = new Map(), acc = 0, nb = 0, bloco = []
    const sai = c => { acc |= c << nb; nb += tam; while (nb >= 8) { bloco.push(acc & 255); acc >>>= 8; nb -= 8; if (bloco.length === 255) { out.byte(255); out.bytes(bloco); bloco = [] } } }
    sai(LIMPA)
    let p = px[0]
    for (let i = 1; i < px.length; i++) {
      const k = px[i], ch = p * 256 + k, v = dic.get(ch)
      if (v !== undefined) { p = v; continue }
      sai(p)
      if (prox === 4096) { sai(LIMPA); dic = new Map(); tam = min + 1; prox = FIM + 1 }
      else { if (prox >= (1 << tam)) tam++; dic.set(ch, prox++) }
      p = k
    }
    sai(p); sai(FIM)
    if (nb > 0) bloco.push(acc & 255)
    if (bloco.length) { out.byte(bloco.length); out.bytes(bloco) }
    out.byte(0)
  }

  // ------------------------------------------------------------------ monta o arquivo a partir de quadros RGBA
  async function montar(quadros, w, h, { cores = 256, pontilhar = true, repetir = true, progresso } = {}) {
    // amostras de todos os quadros para a paleta
    const hist = new Uint32Array(32768), passo = Math.max(1, Math.floor((w * h) / 40000))
    for (const q of quadros) for (let i = 0; i < w * h; i += passo) { const o = i * 4; hist[((q.dados[o] >> 3) << 10) | ((q.dados[o + 1] >> 3) << 5) | (q.dados[o + 2] >> 3)]++ }
    const pal = paleta(hist, cores), achar = mapa(pal)
    let bits = 1; while ((1 << bits) < pal.length) bits++
    const tamTab = 1 << Math.max(1, bits)
    const out = Bytes()
    out.texto('GIF89a'); out.u16(w); out.u16(h); out.byte(0x80 | ((Math.max(1, bits) - 1) << 4) | (Math.max(1, bits) - 1)); out.byte(0); out.byte(0)
    for (let i = 0; i < tamTab; i++) { const c = pal[i] || [0, 0, 0]; out.byte(c[0]); out.byte(c[1]); out.byte(c[2]) }
    if (repetir) { out.byte(0x21); out.byte(0xff); out.byte(11); out.texto('NETSCAPE2.0'); out.byte(3); out.byte(1); out.u16(0); out.byte(0) }
    const idx = new Uint8Array(w * h)
    for (let f = 0; f < quadros.length; f++) {
      const d = quadros[f].dados
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
        const o = i * 4, s = pontilhar ? BAYER[((y & 3) << 2) | (x & 3)] : 0
        const r = Math.max(0, Math.min(255, d[o] + s)), g = Math.max(0, Math.min(255, d[o + 1] + s)), b = Math.max(0, Math.min(255, d[o + 2] + s))
        idx[i] = achar(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3))
      }
      out.byte(0x21); out.byte(0xf9); out.byte(4); out.byte(0x04); out.u16(Math.max(2, Math.round(quadros[f].atraso / 10))); out.byte(0); out.byte(0)
      out.byte(0x2c); out.u16(0); out.u16(0); out.u16(w); out.u16(h); out.byte(0)
      lzw(idx, Math.max(2, bits), out)
      if (progresso) progresso(0.5 + 0.5 * (f + 1) / quadros.length, `Montando o GIF: quadro ${f + 1} de ${quadros.length}`)
      if (f % 3 === 2) await new Promise(r => setTimeout(r))
    }
    out.byte(0x3b)
    return new Blob([out.fim()], { type: 'image/gif' })
  }

  // ------------------------------------------------------------------ fontes
  const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })] }
  // corte "cobrir": preenche o quadro sem distorcer
  function cobrir(ctx, src, sw, sh, w, h) { const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k; ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh) }
  const PROP = { original: null, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 }

  async function deVideo(url, o = {}) {
    const { inicio = 0, duracao = 3, fps = 10, largura = 640, proporcao = 'original', velocidade = 1, progresso } = o
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = url
    await new Promise((ok, erro) => { v.onloadeddata = ok; v.onerror = () => erro(new Error('Não consegui abrir este vídeo.')) })
    const prop = PROP[proporcao] || v.videoWidth / v.videoHeight
    const w = Math.round(Math.min(largura, 1080) / 2) * 2, h = Math.round(w / prop / 2) * 2
    const [, ctx] = tela(w, h)
    const fim = Math.min(v.duration, inicio + duracao), n = Math.max(1, Math.floor((fim - inicio) * fps))
    const quadros = []
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(fim - 0.001, inicio + i / fps)
      await new Promise(ok => { v.onseeked = ok })
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); cobrir(ctx, v, v.videoWidth, v.videoHeight, w, h)
      quadros.push({ dados: ctx.getImageData(0, 0, w, h).data, atraso: 1000 / fps / velocidade })
      if (progresso) progresso(0.5 * (i + 1) / n, `Lendo o vídeo: quadro ${i + 1} de ${n}`)
    }
    v.removeAttribute('src'); v.load()
    return { blob: await montar(quadros, w, h, o), w, h, quadros: quadros.length }
  }

  async function deImagens(urls, o = {}) {
    const { segundos = 1.5, largura = 800, proporcao = '1:1', transicao = 'suave', progresso } = o
    const imgs = await Promise.all(urls.map(u => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não consegui abrir uma das imagens.')); i.src = u })))
    const prop = PROP[proporcao] || imgs[0].naturalWidth / imgs[0].naturalHeight
    const w = Math.round(Math.min(largura, 1080) / 2) * 2, h = Math.round(w / prop / 2) * 2
    const [, ctx] = tela(w, h), quadros = [], PASSOS = 6
    const pinta = (img, a = 1) => { ctx.globalAlpha = a; cobrir(ctx, img, img.naturalWidth, img.naturalHeight, w, h); ctx.globalAlpha = 1 }
    for (let i = 0; i < imgs.length; i++) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); pinta(imgs[i])
      quadros.push({ dados: ctx.getImageData(0, 0, w, h).data, atraso: segundos * 1000 })
      if (transicao === 'suave' && imgs.length > 1) {
        const prox = imgs[(i + 1) % imgs.length]
        for (let k = 1; k <= PASSOS; k++) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); pinta(imgs[i]); pinta(prox, k / (PASSOS + 1)); quadros.push({ dados: ctx.getImageData(0, 0, w, h).data, atraso: 60 }) }
      }
      if (progresso) progresso(0.5 * (i + 1) / imgs.length, `Preparando a imagem ${i + 1} de ${imgs.length}`)
    }
    return { blob: await montar(quadros, w, h, o), w, h, quadros: quadros.length }
  }

  // quantos quadros sairiam (para avisar do limite do LinkedIn antes de começar)
  const contar = { video: o => Math.max(1, Math.floor((o.duracao || 3) * (o.fps || 10))), imagens: (n, o) => n + (o.transicao === 'suave' && n > 1 ? n * 6 : 0) }
  window.GIF = { deVideo, deImagens, contar }
})()
