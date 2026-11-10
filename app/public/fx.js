'use strict'
// Vynco · efeitos de fundo e de movimento. Tudo é enfeite: o app funciona igual sem este arquivo.
//  - partículas (canvas) que seguem a cor do estado (--mood) e reagem ao mouse, com parallax em 3 camadas;
//  - luz que acompanha o cursor nos cartões de vidro, ondinha no clique dos botões, indicador que desliza no menu;
//  - números que contam ao aparecer e confete para os momentos bons (fx.confete).
// Quem pede menos movimento no sistema vê só um fundo parado. Com a janela escondida, nada roda.
;(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches
  const captura = document.documentElement.classList.contains('static') || /[?&]captura/.test(location.search)
  const fx = window.fx = { confete() {}, contar() {} }
  const amb = document.querySelector('.ambient'); if (!amb) return

  // ---------------------------------------------------------------- camadas do fundo (aurora, grade e grão ficam no CSS)
  amb.insertAdjacentHTML('beforeend', '<i class="glow g3"></i><i class="fx-grade"></i><canvas class="fx-ceu" aria-hidden="true"></canvas><i class="fx-vinheta"></i>')
  const cv = amb.querySelector('.fx-ceu'), ctx = cv.getContext('2d')
  let W = 0, H = 0, dpr = 1, pts = [], estrelas = [], cor = [108, 99, 255], claro = false
  const lerCor = () => {
    const cs = getComputedStyle(document.documentElement), c = cs.getPropertyValue('--mood').trim()
    claro = document.documentElement.dataset.theme === 'light' || (document.documentElement.dataset.theme !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches && !document.documentElement.dataset.theme)
    const m = c.match(/^#([0-9a-f]{6})$/i); if (m) { const n = parseInt(m[1], 16); cor = [n >> 16, (n >> 8) & 255, n & 255] }
  }
  function medir() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const n = Math.round(Math.min(55, (W * H) / 30000))
    pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: [0.35, 0.6, 1][Math.floor(Math.random() * 3)], r: 0.5 + Math.random() * 0.9, vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.18, f: Math.random() * Math.PI * 2 }))
    estrelas = []
  }
  let mx = 0.5, my = 0.5, smx = 0.5, smy = 0.5, t0 = performance.now(), vivo = true
  addEventListener('pointermove', e => { mx = e.clientX / W; my = e.clientY / H }, { passive: true })
  function quadro(t) {
    if (!vivo) return
    // 30 quadros por segundo bastam para um fundo lento (e poupam o desfoque dos vidros por cima)
    if (t - t0 < 31 && !CONF.length) { requestAnimationFrame(quadro); return }
    const dt = Math.min(48, t - t0); t0 = t
    smx += (mx - smx) * 0.04; smy += (my - smy) * 0.04
    ctx.clearRect(0, 0, W, H)
    const [r, g, b] = cor, base = claro ? [40, 46, 90] : [r, g, b]
    for (const p of pts) {
      p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z; p.f += dt * 0.0016
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W } if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10
      const px = p.x + (smx - 0.5) * 40 * p.z, py = p.y + (smy - 0.5) * 28 * p.z
      // perto do mouse, a partícula acende um pouco (sem empurrar: é ambiente, não brinquedo)
      const dx = px - mx * W, dy = py - my * H, perto = Math.max(0, 1 - Math.hypot(dx, dy) / 160) * 0.35
      const a = (claro ? 0.12 : 0.16) * (0.55 + 0.45 * Math.sin(p.f)) * (0.5 + p.z * 0.5) + perto * 0.25
      ctx.beginPath(); ctx.arc(px, py, p.r * (0.7 + p.z * 0.4), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${base.join(',')},${a.toFixed(3)})`; ctx.fill()
    }
    // uma estrela cadente de vez em quando (só no tema escuro)
    if (!claro && Math.random() < 0.0004 * dt / 16 && estrelas.length < 1) estrelas.push({ x: Math.random() * W * 0.8 + W * 0.2, y: Math.random() * H * 0.35, v: 0.9 + Math.random() * 0.6, vida: 1 })
    for (const s of estrelas) {
      s.x -= s.v * dt * 0.9; s.y += s.v * dt * 0.38; s.vida -= dt / 900
      const gr = ctx.createLinearGradient(s.x, s.y, s.x + 90, s.y - 38)
      gr.addColorStop(0, `rgba(244,245,250,${Math.max(0, s.vida) * 0.35})`); gr.addColorStop(1, 'rgba(244,245,250,0)')
      ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 90, s.y - 38); ctx.stroke()
    }
    estrelas = estrelas.filter(s => s.vida > 0)
    // confete por cima de tudo
    if (CONF.length) desenharConfete(dt)
    requestAnimationFrame(quadro)
  }
  lerCor(); medir(); addEventListener('resize', () => { medir(); lerConf() })
  new MutationObserver(lerCor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mood', 'data-theme'] })
  document.addEventListener('visibilitychange', () => { vivo = !document.hidden; if (vivo && !reduzido) { t0 = performance.now(); requestAnimationFrame(quadro) } })
  if (reduzido || captura) { quadro(performance.now()); vivo = false } else requestAnimationFrame(quadro)

  // ---------------------------------------------------------------- confete (aprovar, publicar, terminar o tour)
  const fc = document.createElement('canvas'); fc.className = 'fx-confete'; fc.setAttribute('aria-hidden', 'true'); document.body.appendChild(fc)
  const fctx = fc.getContext('2d'); let CONF = []
  function lerConf() { fc.width = W * dpr; fc.height = H * dpr; fc.style.width = W + 'px'; fc.style.height = H + 'px'; fctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
  lerConf()
  function desenharConfete(dt) {
    fctx.clearRect(0, 0, W, H)
    for (const c of CONF) {
      c.vy += 0.0009 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.vida -= dt / 1700
      fctx.save(); fctx.translate(c.x, c.y); fctx.rotate(c.rot); fctx.globalAlpha = Math.max(0, Math.min(1, c.vida * 1.6))
      fctx.fillStyle = c.cor; fctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); fctx.restore()
    }
    CONF = CONF.filter(c => c.vida > 0 && c.y < H + 40)
    if (!CONF.length) fctx.clearRect(0, 0, W, H)
  }
  fx.confete = (x = W / 2, y = H / 2, n = 90) => {
    if (reduzido) return
    const cores = ['#8C85FF', '#7FFFD4', '#ffb547', '#F4F5FA', '#6C63FF', '#ff7aa8']
    for (let i = 0; i < n; i++) { const ang = Math.random() * Math.PI * 2, v = 0.25 + Math.random() * 0.55; CONF.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 0.45, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, cor: cores[i % cores.length], vida: 1 }) }
    if (!vivo) { vivo = true; t0 = performance.now(); requestAnimationFrame(quadro); setTimeout(() => { if (document.hidden) vivo = false }, 3000) }
  }

  if (reduzido) return

  // ---------------------------------------------------------------- luz que acompanha o cursor nos cartões
  const ALVOS = '.glass, .post, .ini-chip, .rot, .cr-acao, .midia, .btn, .tour-pop'
  let ultimo = null
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest(ALVOS)
    if (ultimo && ultimo !== el) ultimo.classList.remove('fx-luz')
    ultimo = el; if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%')
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
    el.classList.add('fx-luz')
  }, { passive: true })

  // ---------------------------------------------------------------- ondinha no clique dos botões
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn, .lado button, .chips button, .subnav button, .ini-chip, .cr-acao')
    if (!b || b.disabled) return
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, o = document.createElement('span')
    o.className = 'fx-onda'; Object.assign(o.style, { width: s + 'px', height: s + 'px', left: e.clientX - r.left - s / 2 + 'px', top: e.clientY - r.top - s / 2 + 'px' })
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative'
    b.classList.add('fx-tem-onda'); b.appendChild(o); setTimeout(() => o.remove(), 650)
  }, { passive: true })

  // ---------------------------------------------------------------- indicador que desliza no menu lateral
  const nav = document.getElementById('nav')
  if (nav) {
    const ind = document.createElement('span'); ind.className = 'lado-ind'; ind.setAttribute('aria-hidden', 'true'); nav.prepend(ind)
    const mover = () => {
      const b = nav.querySelector('button[aria-current]')
      if (!b || !b.offsetParent) { ind.style.opacity = 0; return }
      ind.style.opacity = 1; ind.style.transform = `translateY(${b.offsetTop}px)`; ind.style.height = b.offsetHeight + 'px'
    }
    new MutationObserver(mover).observe(nav, { attributes: true, subtree: true, attributeFilter: ['aria-current'] })
    addEventListener('resize', mover); setTimeout(mover, 300)
  }

  // ---------------------------------------------------------------- números que contam ao aparecer (Início)
  fx.contar = raiz => {
    for (const b of (raiz || document).querySelectorAll('.ini-chip b')) {
      const fim = parseInt(b.textContent, 10); if (!(fim > 0) || b.dataset.contou === String(fim)) continue
      b.dataset.contou = String(fim); const t1 = performance.now(), dur = 700
      const passo = t => { const k = Math.min(1, (t - t1) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(fim * e); if (k < 1) requestAnimationFrame(passo) }
      requestAnimationFrame(passo)
    }
  }
  const res = document.querySelector('[data-ini-resumo]')
  if (res) new MutationObserver(() => fx.contar(res)).observe(res, { childList: true })

})()
