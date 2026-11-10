'use strict'
// Vynco · controles com a cara do app (e não do navegador nem do Windows):
//  - sem o menu do navegador no botão direito; nos campos de texto, um menu próprio com Recortar, Copiar, Colar e Selecionar tudo;
//  - sem atalhos de navegador (recarregar, voltar, imprimir, procurar, zoom, ferramentas de desenvolvedor);
//  - listas de escolha (<select>) desenhadas pelo app, com teclado e leitor de tela;
//  - na versão desktop, a barra da janela é do Vynco: arrastar, minimizar, maximizar e fechar (fechar esconde na bandeja).
;(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const CAMPO = 'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable=""], [contenteditable=true]'

  // ---------------------------------------------------------------- botão direito
  let menu = null
  const fecharMenu = () => { menu?.remove(); menu = null }
  document.addEventListener('contextmenu', e => {
    e.preventDefault()
    fecharMenu()
    const campo = e.target.closest && e.target.closest(CAMPO)
    if (!campo || campo.disabled) return
    const sel = (campo.selectionEnd ?? 0) > (campo.selectionStart ?? 0) || String(getSelection() || '').length > 0
    const ro = campo.readOnly
    const itens = [['Recortar', 'cut', !sel || ro], ['Copiar', 'copy', !sel], ['Colar', 'paste', ro], null, ['Selecionar tudo', 'all', false]]
    menu = document.createElement('div'); menu.className = 'ctx-menu'; menu.setAttribute('role', 'menu')
    menu.innerHTML = itens.map(i => i ? `<button type="button" role="menuitem" data-ctx="${i[1]}"${i[2] ? ' disabled' : ''}>${i[0]}</button>` : '<hr>').join('')
    document.body.appendChild(menu)
    const r = menu.getBoundingClientRect()
    menu.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px'; menu.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px'
    menu.addEventListener('mousedown', ev => ev.preventDefault())   // não tira o foco do campo
    menu.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-ctx]'); if (!b) return
      campo.focus()
      const acao = b.dataset.ctx
      try {
        if (acao === 'all') campo.select ? campo.select() : document.execCommand('selectAll')
        else if (acao === 'paste') { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t) }
        else document.execCommand(acao)
      } catch { }
      fecharMenu()
    })
  }, true)
  addEventListener('mousedown', e => { if (menu && !menu.contains(e.target)) fecharMenu() }, true)
  addEventListener('blur', fecharMenu); addEventListener('resize', fecharMenu)

  // ---------------------------------------------------------------- atalhos de navegador
  document.addEventListener('keydown', e => {
    const k = e.key, ctrl = e.ctrlKey || e.metaKey
    const bloquear = k === 'F5' || k === 'F12' || k === 'F3' || k === 'F7' || k === 'BrowserBack' || k === 'BrowserForward'
      || (ctrl && /^[rpfguoj]$/i.test(k)) || (ctrl && e.shiftKey && /^[ijcr]$/i.test(k))
      || (ctrl && ['+', '-', '=', '0'].includes(k)) || (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home'))
    if (k === 'Escape') fecharMenu()
    if (bloquear) e.preventDefault()
  }, true)
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false })   // sem zoom no Ctrl + rodinha
  addEventListener('dragover', e => { if (!e.target.closest || !e.target.closest('[data-solta], .ed-midias, .midias, .drop')) e.preventDefault() })
  addEventListener('drop', e => { if (!e.target.closest || !e.target.closest('[data-solta], .ed-midias, .midias, .drop')) e.preventDefault() })

  // ---------------------------------------------------------------- listas de escolha do app
  function melhorar(sel) {
    if (sel.dataset.vsel || sel.multiple || sel.size > 1) return
    sel.dataset.vsel = '1'
    const caixa = document.createElement('span'); caixa.className = 'vsel'
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'vsel-b'; bt.setAttribute('aria-haspopup', 'listbox'); bt.setAttribute('aria-expanded', 'false')
    if (sel.getAttribute('aria-label')) bt.setAttribute('aria-label', sel.getAttribute('aria-label'))
    sel.parentNode.insertBefore(caixa, sel); caixa.appendChild(sel); caixa.appendChild(bt)
    sel.classList.add('vsel-nativo'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true')
    const rotulo = () => { const o = sel.options[sel.selectedIndex]; bt.innerHTML = `<span>${o ? o.textContent : ''}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`; bt.disabled = sel.disabled }
    rotulo()
    sel.addEventListener('change', rotulo)
    new MutationObserver(rotulo).observe(sel, { childList: true, subtree: true, attributes: true })
    let lista = null, foco = 0
    const fechar = () => { lista?.remove(); lista = null; bt.setAttribute('aria-expanded', 'false'); caixa.classList.remove('aberto') }
    const escolher = i => { if (i < 0) return; sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); sel.dispatchEvent(new Event('input', { bubbles: true })); fechar(); bt.focus() }
    const marcar = () => lista && [...lista.children].forEach((li, i) => { li.classList.toggle('foco', i === foco); if (i === foco) li.scrollIntoView({ block: 'nearest' }) })
    const abrir = () => {
      if (lista || sel.disabled) return
      lista = document.createElement('ul'); lista.className = 'vsel-lista'; lista.setAttribute('role', 'listbox')
      lista.innerHTML = [...sel.options].map((o, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ''}>${o.textContent}</li>`).join('')
      document.body.appendChild(lista)
      const r = bt.getBoundingClientRect(), h = Math.min(lista.scrollHeight, 280), cabe = innerHeight - r.bottom > h + 12
      Object.assign(lista.style, { left: r.left + 'px', minWidth: r.width + 'px', top: (cabe ? r.bottom + 6 : r.top - h - 6) + 'px', maxHeight: '280px' })
      foco = Math.max(0, sel.selectedIndex); marcar()
      bt.setAttribute('aria-expanded', 'true'); caixa.classList.add('aberto')
      lista.addEventListener('mousedown', e => e.preventDefault())
      lista.addEventListener('click', e => { const li = e.target.closest('li'); if (li && li.getAttribute('aria-disabled') !== 'true') escolher(+li.dataset.i) })
      lista.addEventListener('mousemove', e => { const li = e.target.closest('li'); if (li) { foco = +li.dataset.i; marcar() } })
    }
    bt.addEventListener('click', () => lista ? fechar() : abrir())
    bt.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== bt) fechar() }, 120))
    bt.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!lista) return abrir(); foco = Math.max(0, Math.min(sel.options.length - 1, foco + (e.key === 'ArrowDown' ? 1 : -1))); marcar() }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lista ? escolher(foco) : abrir() }
      else if (e.key === 'Escape' && lista) { e.preventDefault(); e.stopPropagation(); fechar() }
      else if (e.key === 'Tab') fechar()
    })
    addEventListener('scroll', e => { if (lista && !lista.contains(e.target)) fechar() }, true)
  }
  const varrer = r => (r.querySelectorAll ? r.querySelectorAll('select') : []).forEach(melhorar)
  varrer(document)
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'SELECT') melhorar(n); else varrer(n) } }).observe(document.body, { childList: true, subtree: true })

  // ---------------------------------------------------------------- barra da janela (só na versão desktop)
  const T = window.__TAURI__
  if (T && T.window) {
    const jan = T.window.getCurrentWindow()
    const bar = $('.bar'); if (!bar) return
    document.documentElement.classList.add('desktop')
    bar.setAttribute('data-tauri-drag-region', '')
    bar.querySelectorAll('.pill-zone, .bar-l, .bar-r').forEach(el => el.setAttribute('data-tauri-drag-region', ''))
    const ic = d => `<svg viewBox="0 0 12 12" aria-hidden="true">${d}</svg>`
    const box = document.createElement('div'); box.className = 'jan-ctrl'
    box.innerHTML = `<button type="button" data-jan="min" aria-label="Minimizar">${ic('<path d="M2 6.5h8" stroke="currentColor" stroke-width="1.2"/>')}</button>`
      + `<button type="button" data-jan="max" aria-label="Maximizar">${ic('<rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/>')}</button>`
      + `<button type="button" data-jan="fechar" class="x" aria-label="Fechar (o Vynco continua na bandeja)" title="O Vynco continua na bandeja, perto do relógio">${ic('<path d="m3 3 6 6M9 3 3 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>')}</button>`
    bar.appendChild(box)
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-jan]'); if (!b) return
      const a = b.dataset.jan
      ;(a === 'min' ? jan.minimize() : a === 'max' ? jan.toggleMaximize() : jan.close()).catch(() => {})
    })
    bar.addEventListener('dblclick', e => { if (e.target.hasAttribute('data-tauri-drag-region')) jan.toggleMaximize().catch(() => {}) })
  }
})()
