'use strict'
// Farol: entrada em cenas (LinkedIn → IA → sincronização → formatos) + fila, rotinas e ajustes.
// Fala com app/server.js (toda chamada leva o token desta sessão). Sem o servidor, roda em demonstração.
const TOKEN = document.querySelector('meta[name=engine-token]').content
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const store = { get: (k, d) => { try { return localStorage.getItem('farol.' + k) ?? d } catch { return d } }, set: (k, v) => { try { localStorage.setItem('farol.' + k, v) } catch {} } }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const espera = ms => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- marcas (desenhos simples, só para reconhecer o serviço)
const GLIFO = {
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.6 4.77 6v5.46h-4v-4.84c0-1.16-.02-2.64-1.6-2.64-1.62 0-1.86 1.25-1.86 2.55v4.93h-4z"/></svg>',
  claude: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#D97757" stroke-width="2.3" stroke-linecap="round">' + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => { const r = a * Math.PI / 180, l = i % 2 ? 6.5 : 9; return `<line x1="${(12 + Math.cos(r) * 2.2).toFixed(2)}" y1="${(12 + Math.sin(r) * 2.2).toFixed(2)}" x2="${(12 + Math.cos(r) * l).toFixed(2)}" y2="${(12 + Math.sin(r) * l).toFixed(2)}"/>` }).join('') + '</g></svg>',
  codex: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8">' + [0, 60, 120].map(a => `<ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
}
// cada Gemini tem o seu degradê (um id repetido some quando o primeiro desenho está escondido)
let gid = 0
const gemini = () => { const g = 'gg' + (++gid); return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8ef7"/><stop offset=".55" stop-color="#9b72f2"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs><path fill="url(#${g})" d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10Z"/></svg>` }
const glifo = (id, cor) => id === 'gemini' ? gemini() : GLIFO[id] ||`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${cor || 'var(--violet)'}" opacity=".22"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="${cor || 'var(--violet)'}" font-family="Segoe UI, sans-serif">${esc((id || '?')[0].toUpperCase())}</text></svg>`

// ---------------------------------------------------------------- wireframes dos formatos (nenhum post real nos exemplos)
const BADGE = { imagem: 'PNG', gif: 'GIF', carrossel: 'PDF', documento: 'PDF', video: 'MP4', multi: 'IMAGENS', texto: 'TEXTO', artigo: 'LINK' }
function wire(f, o = {}) {
  if (f === 'documento') f = 'carrossel'
  if (f === 'texto') return `<div class="wf wf-txt"><span class="wf-badge">${BADGE.texto}</span>${o.texto ? `<p>${esc(o.texto)}</p>` : '<svg viewBox="0 0 80 100"><rect class="c" x="10" y="22" width="52" height="5" rx="2.5"/><rect class="b" x="10" y="34" width="60" height="4" rx="2"/><rect class="b" x="10" y="42" width="56" height="4" rx="2"/><rect class="b" x="10" y="50" width="60" height="4" rx="2"/><rect class="b" x="10" y="58" width="38" height="4" rx="2"/><rect class="a" x="10" y="72" width="30" height="4" rx="2"/></svg>'}</div>`
  if (f === 'multi') return `<div class="wf wf-multi"><span class="wf-badge">${o.n || 4} ${BADGE.multi}</span>${[0, 1, 2, 3].map(i => `<i class="t${i}"><svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice"><rect class="a" width="40" height="40"/><circle class="c" cx="13" cy="13" r="4"/><path class="b" d="M0 34 14 22l9 8 6-5 11 9v6H0z"/></svg></i>`).join('')}</div>`
  if (f === 'artigo') return `<div class="wf wf-art"><span class="wf-badge">${BADGE.artigo}</span><div class="art-card"><svg viewBox="0 0 80 42" preserveAspectRatio="xMidYMid slice"><rect class="a" width="80" height="42"/><circle class="c" cx="16" cy="13" r="5"/><path class="b" d="M0 38 22 22l12 10 9-6 37 16z"/></svg><span><b></b><i></i><i class="s"></i></span></div></div>`
  const badge = `<span class="wf-badge">${f === 'gif' ? '<svg viewBox="0 0 12 12"><path d="M2 6a4 4 0 0 1 7-2.6M10 6a4 4 0 0 1-7 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9.6 1.2v2.6H7M2.4 10.8V8.2H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}${BADGE[f]}${f === 'carrossel' ? ` · ${o.paginas || 7}` : ''}</span>`
  const k = o.cor ? ` style="--k:${o.cor}"` : ''
  if (f === 'carrossel') return `<div class="wf wf-car"${k}>${badge}<div class="paginas">${[0, 1, 2].map(() => '<div class="pg"><i></i><i></i><i></i><i class="blk"></i></div>').join('')}</div><div class="pontos"><i></i><i></i><i></i></div></div>`
  if (f === 'video') return `<div class="wf wf-vid"${k}>${badge}<svg class="cena" viewBox="0 0 80 100" preserveAspectRatio="xMidYMid slice"><rect class="a" x="0" y="62" width="80" height="38"/><g class="mov"><rect class="b" x="10" y="40" width="14" height="22" rx="2"/><rect class="b" x="30" y="30" width="18" height="32" rx="2"/><rect class="a" x="54" y="44" width="16" height="18" rx="2"/></g><circle class="b" cx="64" cy="20" r="7"/></svg><span class="play"></span><span class="tempo">0:42</span><span class="trilha"></span></div>`
  const gif = f === 'gif'
  return `<div class="wf ${gif ? 'wf-gif' : 'wf-img'}"${k}>${badge}<svg viewBox="0 0 80 100" preserveAspectRatio="xMidYMid meet">
    <rect class="a" x="8" y="8" width="64" height="52" rx="5"/>
    <circle class="${gif ? 'acc brilho' : 'c'}" cx="22" cy="22" r="6"/>
    <path class="b" d="M8 54 26 36l12 11 9-7 25 18v2a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z"/>
    ${gif ? '<circle class="acc bola" cx="52" cy="40" r="5"/>' : ''}
    <rect class="c" x="8" y="68" width="46" height="5" rx="2.5"/><rect class="b" x="8" y="78" width="60" height="4" rx="2"/><rect class="b" x="8" y="86" width="40" height="4" rx="2"/>
  </svg></div>`
}

// ---------------------------------------------------------------- demonstração (site estático, sem o servidor local)
const DEMO = TOKEN === '__' + 'TOKEN__'
const arquivo = p => DEMO ? p : `/files/${encodeURI(String(p).replace(/\\/g, '/'))}`
const D = DEMO && (() => {
  const ja = store.get('onboarded') === '1' || ['fila', 'rotinas', 'ajustes'].includes(new URLSearchParams(location.search).get('tela'))
  return {
    linkedin: { proprio: false, connected: ja, name: ja ? 'Seu Nome' : null, expiresAt: Date.now() + 59 * 864e5, via: 'farol', redirectUri: 'http://localhost:8765/callback' },
    agentes: { claude: { instalado: true, conectado: false }, codex: { instalado: false, conectado: false }, gemini: { instalado: false, conectado: false }, copilot: {}, qwen: {}, opencode: {} },
    escolhido: ja ? 'claude' : null, sincronizado: ja,
    lista: [['claude', 'Claude', 'Claude Code', '#D97757'], ['codex', 'ChatGPT', 'Codex', '#10A37F'], ['gemini', 'Gemini', 'Gemini CLI', '#4285F4'], ['copilot', 'GitHub Copilot', 'Copilot CLI', '#8957E5', 1], ['qwen', 'Qwen Code', 'Qwen Code', '#615CED', 1], ['opencode', 'OpenCode', 'OpenCode', '#9BA7BF', 1]].map(([id, nome, via, cor, beta]) => ({ id, nome, via, cor, beta: !!beta })),
    jobs: {}, sync: null,
    fila: [
      { kind: 'dailyui', id: '003', title: 'Daily UI 003 · Tela de entrada', formato: 'gif', hasFile: true, approved: false, published: null, caption: 'Daily UI 003 · Tela de entrada\n\nUm campo por vez, erro que explica o que fazer e foco sempre visível.\n\n- Rótulo fora do campo, para não sumir ao digitar\n- Mensagem de erro perto do erro\n- Botão com o verbo da ação\n\n#dailyui #uidesign #ux' },
      { kind: 'noticias', id: 'hoje-a', title: 'Carrossel A · notícias do dia', formato: 'carrossel', paginas: 7, hasFile: true, approved: false, published: null, caption: 'O assunto do dia em 7 slides: o que aconteceu, o outro lado e o que muda para quem desenha.\n\nFontes checadas no último slide.\n\n#design #ia #tecnologia' },
      { kind: 'avulsos', id: 'processo', title: 'Vídeo · bastidores de um projeto', formato: 'video', hasFile: true, approved: false, published: null, caption: 'Quarenta segundos de processo: do rascunho à tela final.\n\nO que você mudaria?\n\n#processo #design' },
      { kind: 'avulsos', id: 'antes-depois', title: 'Antes e depois · 4 telas', formato: 'multi', arquivos: [], hasFile: true, approved: false, published: null, caption: 'Quatro telas, antes e depois do redesenho.\n\nArraste para o lado e diga qual mudança você notou primeiro.\n\n#uxdesign #redesign' },
      { kind: 'avulsos', id: 'reflexao', title: 'Só texto · uma lição da semana', formato: 'texto', hasFile: true, approved: true, published: null, caption: 'Uma lição desta semana: mostrar o rascunho cedo economiza três rodadas de ajuste.\n\nO que você aprendeu esta semana?' },
      { kind: 'series', id: '04', title: 'Série 04 · ferramentas', formato: 'imagem', hasFile: true, approved: true, published: null, caption: 'As ferramentas que eu abro todo dia, e por quê.\n\n#design #ferramentas' },
      { kind: 'series', id: '03', title: 'Série 03 · apresentação', formato: 'imagem', hasFile: true, approved: true, published: { link: 'https://github.com/AbapaOnSwamp/farol', quando: new Date(Date.now() - 864e5).toISOString() }, caption: 'Quem sou eu, em uma imagem.\n\n#portfolio' },
    ],
  }
})()
const ag = id => D.lista.find(a => a.id === id)
async function apiDemo(path, data) {
  await espera(160)
  const q = new URL(path, 'http://x'), id = q.searchParams.get('id') || (data && data.id)
  const it = data && D.fila.find(i => i.kind === data.kind && i.id === data.id)
  const status = () => ({ agente: D.escolhido ? { id: D.escolhido, nome: ag(D.escolhido).nome, via: ag(D.escolhido).via, instalado: true, conectado: true, conta: 'voce@exemplo.com', sincronizado: D.sincronizado ? new Date().toISOString() : null } : null, linkedin: { ...D.linkedin, dias: Math.floor((D.linkedin.expiresAt - Date.now()) / 864e5), contas: D.linkedin.connected ? [{ id: 'demo', nome: D.linkedin.name, expiresAt: D.linkedin.expiresAt, dias: Math.floor((D.linkedin.expiresAt - Date.now()) / 864e5), valida: true, ativa: true }] : [] }, desigma: { mcpOk: true, exeOk: true, registered: D.sincronizado, workspace: 'C:\\Users\\voce\\Documents\\desigma', exe: 'C:\\Programas\\desigma\\desigma.exe', mcpExe: 'C:\\Programas\\desigma\\desigma-mcp.exe', project: '' }, config: { assetsDir: 'examples/assets', dailyUiStart: '2026-11-03' } })
  switch (q.pathname) {
    case '/api/status': return status()
    case '/api/agentes': return { escolhido: D.escolhido, agentes: D.lista.map(a => ({ ...a, ...D.agentes[a.id] })) }
    case '/api/agente/login': {
      const a = D.agentes[id], j = D.jobs[id] = { id, fase: 'conferindo', msg: '' }
      ;(async () => {
        if (!a.instalado) { Object.assign(j, { fase: 'instalando', msg: `Instalando o ${ag(id).via}` }); await espera(2200); a.instalado = true }
        if (!a.conectado) { Object.assign(j, { fase: 'abrindo', msg: 'Abrindo o login no navegador' }); await espera(900); Object.assign(j, { fase: 'esperando', msg: 'Esperando você entrar na sua conta' }); await espera(2000) }
        a.conectado = true; Object.assign(j, { fase: 'ok', msg: 'Conectado', conta: 'voce@exemplo.com' })
      })()
      return j
    }
    case '/api/agente/job': return D.jobs[id] || {}
    case '/api/agente/cancelar': delete D.jobs[id]; return { ok: true }
    case '/api/agente/escolher': D.escolhido = id; return { ok: true }
    case '/api/sync': {
      if (!data) return D.sync || {}
      const a = ag(id || D.escolhido); D.escolhido = a.id
      const rot = [['conta', `Conferindo a sua conta do ${a.nome}`, 'voce@exemplo.com'], ['instrucoes', 'Ensinando as regras do Farol', a.id === 'claude' ? 'CLAUDE.md' : a.id === 'gemini' ? 'GEMINI.md' : 'AGENTS.md'], ['skills', 'Instalando 4 skills', 'farol-daily-ui, farol-legendas, farol-marca, farol-pauta-noticias'], ['prompts', 'Copiando 2 prompts das rotinas', '/farol-daily-ui, /farol-pauta-noticias'], ['plugins', 'Ligando o Desigma (plugin MCP)', 'desigma'], ['trava', 'Travando a publicação para o agente', `O ${a.nome} não pode rodar o script de publicação.`], ['teste', `Testando uma resposta do ${a.nome}`, 'respondeu "ok"']]
      const S = D.sync = { agente: a.id, nome: a.nome, passos: rot.map(([pid, rotulo]) => ({ id: pid, rotulo, estado: 'espera', detalhe: '' })), fim: null, ok: false, resumo: { skills: 4, prompts: 2, plugins: 1 } }
      ;(async () => { for (let i = 0; i < rot.length; i++) { S.passos[i].estado = 'rodando'; await espera(i === 6 ? 1400 : 650); Object.assign(S.passos[i], { estado: 'ok', detalhe: rot[i][2] }) } S.ok = true; S.fim = Date.now(); D.sincronizado = true })()
      return S
    }
    case '/api/linkedin/connect': D.liTimer = setTimeout(() => Object.assign(D.linkedin, { connected: true, name: 'Seu Nome', expiresAt: Date.now() + 60 * 864e5 }), 2400); return { ok: true, modo: 'ponte', msg: 'Demonstração: o login é simulado.' }
    case '/api/linkedin/cancelar': clearTimeout(D.liTimer); return { ok: true }
    case '/api/linkedin/disconnect': Object.assign(D.linkedin, { connected: false, name: null }); return { ok: true }
    case '/api/queue': return D.fila
    case '/api/runs': return { agente: D.escolhido ? ag(D.escolhido).nome : null, rotinas: [{ id: 'daily-ui', titulo: 'Gerar o Daily UI de hoje', agendar: 'schtasks /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:00 /TN "Farol - Gerar o Daily UI de hoje" /TR "..."' }, { id: 'pauta-noticias', titulo: 'Montar os carrosséis de notícias', agendar: 'schtasks /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:00 /TN "Farol - Montar os carrosséis de notícias" /TR "..."' }], runs: [] }
    case '/api/approve': it.approved = true; return { ok: true }
    case '/api/unapprove': it.approved = false; return { ok: true }
    case '/api/publish': it.published = { link: 'https://github.com/AbapaOnSwamp/farol', quando: new Date().toISOString() }; return { ok: true }
    case '/api/run': throw new Error('Na demonstração as rotinas não rodam. Baixe o Farol para usar de verdade.')
    default: return { ok: true, msg: 'Demonstração: nada foi alterado de verdade.' }
  }
}
async function api(path, data) {
  if (DEMO) return apiDemo(path, data)
  const r = await fetch(path, { method: data ? 'POST' : 'GET', headers: { 'X-Engine-Token': TOKEN, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.erro || `erro ${r.status}`), { status: r.status })
  return j
}

// ---------------------------------------------------------------- som (WebAudio, tudo em Ré maior)
const Som = (() => {
  let ctx = null
  const pref = () => store.get('sound', 'tom')
  const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A() } if (ctx.state === 'suspended') ctx.resume(); return ctx }
  function tom(f, t0, atk, dur, vol, tipo = 'sine') {
    const c = ac(); if (!c) return
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0
    o.type = tipo; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dur)
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + atk + dur + .05)
  }
  const sino = (f, t0, vol = .06, dur = .32) => { tom(f, t0, .008, dur, vol); tom(f * 2, t0, .005, dur * .45, vol * .25) }
  const ACORDES = [[164.81, 277.18, 329.63, 440], [146.83, 220, 369.99, 587.33], [123.47, 185, 293.66, 493.88]]
  let passo = 0
  return {
    acordar: ac,
    pad() { if (pref() !== 'tom') return; const a = ACORDES[passo++ % ACORDES.length]; a.forEach((f, i) => tom(f, i * .02, .65, 1.0, i ? .018 : .028, i === 3 ? 'triangle' : 'sine')) },
    tique() { const p = pref(); if (p === 'off') return; tom(1174.66, 0, .004, .045, p === 'clique' ? .05 : .025) },
    liga() { const p = pref(); if (p === 'off') return; if (p === 'bipe') { tom(880, 0, .005, .08, .05, 'square'); tom(880, .12, .005, .08, .05, 'square'); return } if (p === 'clique') return this.tique(); sino(587.33, 0); sino(880, .14) },
    desliga() { const p = pref(); if (p === 'off') return; if (p === 'bipe') { tom(440, 0, .005, .1, .05, 'square'); return } if (p === 'clique') return this.tique(); sino(880, 0); sino(587.33, .14) },
    publica() { const p = pref(); if (p === 'off') return; if (p !== 'tom') return this.liga(); [587.33, 739.99, 880, 1174.66].forEach((f, i) => sino(f, i * .09, .05, .5)); tom(146.83, 0, .3, 1.1, .03) },
    erro() { if (pref() === 'off') return; tom(246.94, 0, .01, .12, .05, 'triangle'); tom(207.65, .15, .01, .18, .05, 'triangle') },
  }
})()
addEventListener('pointerdown', () => Som.acordar(), { once: true })
addEventListener('keydown', () => Som.acordar(), { once: true })

// ---------------------------------------------------------------- pílula de aviso, humor do fundo, diálogo
let pillT
function pill(titulo, sub = '', cor = 'var(--accent)') {
  const p = $('#pill'), modo = store.get('toast', 'padrao')
  $('#pill-t').textContent = titulo; $('#pill-s').textContent = modo === 'compacto' ? '' : sub
  p.style.setProperty('--c', cor); p.hidden = false; p.classList.remove('out'); void p.offsetWidth
  clearTimeout(pillT); pillT = setTimeout(() => { p.classList.add('out'); setTimeout(() => (p.hidden = true), 300) }, modo === 'detalhado' ? 4200 : 2800)
}
const humor = m => (document.documentElement.dataset.mood = m)
function falha(e) { Som.erro(); humor('error'); pill('Algo deu errado', e.message, 'var(--red)'); setTimeout(atualizarHumor, 2800) }
function confirmar(t, p, ok = 'Confirmar') { const d = $('#dlg'); $('#dlg-t').textContent = t; $('#dlg-p').textContent = p; $('#dlg-ok').textContent = ok; d.showModal(); return new Promise(r => d.addEventListener('close', () => r(d.returnValue === 'sim'), { once: true })) }
const ring = el => { if (reduced || !el) return; const r = document.createElement('span'); r.className = 'ring'; el.appendChild(r); setTimeout(() => r.remove(), 750) }
const quando = ms => ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
const inicial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase())

// ---------------------------------------------------------------- tema
function aplicarTema() { const t = store.get('theme', 'auto'); document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t }
matchMedia('(prefers-color-scheme: light)').addEventListener('change', aplicarTema)
aplicarTema()

// ---------------------------------------------------------------- cenas
const ONB = ['ola', 'linkedin', 'agente', 'sync', 'formatos']
let atual = null, voltarPara = null
function cena(nome, { som = true } = {}) {
  const prox = $(`.scene[data-scene="${nome}"]`); if (!prox || atual === prox) return
  const ant = atual; atual = prox
  const mostrar = () => {
    if (ant) { ant.hidden = true; ant.classList.remove('on', 'leaving') }
    $$('[data-in]', prox).forEach((el, i) => el.style.setProperty('--d', (i * 80) + 'ms'))
    prox.hidden = false; void prox.offsetWidth; prox.classList.add('on'); scrollTo({ top: 0 })
    const ob = ONB.indexOf(nome), naEntrada = ob >= 0 && !voltarPara
    $('#stepper').hidden = !(ob > 0 && naEntrada)
    $$('#stepper li').forEach(li => { const i = ONB.indexOf(li.dataset.s); li.classList.toggle('on', i === ob); li.classList.toggle('done', i < ob) })
    $('#nav').hidden = naEntrada; $('#conns').hidden = naEntrada
    $('#back').hidden = !(ob > 0 || voltarPara)
    $$('#nav [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === nome))
    if (som) Som.pad()
    ENTRAR[nome]?.()
  }
  if (ant && !reduced) { ant.classList.add('leaving'); setTimeout(mostrar, 200) } else mostrar()
}
function proximaCena() {
  const n = atual?.dataset.scene
  if (voltarPara && n !== 'agente') { const v = voltarPara; voltarPara = null; return cena(v) }   // vindo de Ajustes, volta para lá
  const i = ONB.indexOf(n); if (i >= 0 && i < ONB.length - 1) cena(ONB[i + 1]); else if (i === ONB.length - 1) terminar()
}
function voltar() {
  const n = atual?.dataset.scene
  if (n === 'sync' && SYNC_ON) return
  if (voltarPara) { const v = voltarPara; voltarPara = null; return cena(v) }
  const i = ONB.indexOf(n); if (i > 0) cena(ONB[i - 1])
}
function terminar() { store.set('onboarded', '1'); voltarPara = null; cena('fila') }
const ENTRAR = {
  linkedin: () => entrarLinkedin(), agente: () => entrarAgente(), sync: () => entrarSync(), formatos: () => desenharFormatos(),
  fila: () => carregarFila(), rotinas: () => carregarRotinas(), ajustes: () => status(),
}

// ---------------------------------------------------------------- estado geral
let ST = null, avisouVence = false
// o token do LinkedIn dura ~60 dias e não renova sozinho (renovação automática é só para parceiros aprovados)
const venceLogo = l => !!(l && l.connected && l.dias != null && l.dias <= 7)
const prazo = d => d <= 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`
async function status() {
  try { ST = await api('/api/status') } catch (e) { return falha(e) }
  desenharConns(); desenharAjustes()
  const l = ST.linkedin
  if (!avisouVence && store.get('onboarded') === '1') {
    if (venceLogo(l)) { avisouVence = true; setTimeout(() => pill(`O acesso ao LinkedIn vence ${prazo(l.dias)}`, 'Reconecte em Ajustes: leva um clique.', 'var(--amber)'), 1500) }
    else if (!l.connected && (l.contas || []).length) { avisouVence = true; setTimeout(() => pill('O acesso ao LinkedIn venceu', 'Reconecte em Ajustes para voltar a publicar.', 'var(--red)'), 1500) }
  }
  return ST
}
function desenharConns() {
  if (!ST) return
  const l = ST.linkedin, a = ST.agente
  $('#conns').innerHTML = `<span style="--c:${l.connected && !venceLogo(l) ? 'var(--green)' : 'var(--amber)'};color:#fff;background:var(--li)" title="LinkedIn: ${l.connected ? esc(l.name) + (venceLogo(l) ? ' (vence ' + prazo(l.dias) + ')' : '') : 'não conectado'}">${GLIFO.linkedin}</span><span style="--c:${a && a.conectado ? 'var(--green)' : 'var(--amber)'}" title="IA: ${a ? esc(a.nome) : 'nenhuma'}">${glifo(a ? a.id : 'x')}</span>`
}

// ---------------------------------------------------------------- 1. LinkedIn
let LI_POLL = null
function liEstado(s) { $('[data-li]').dataset.li = s; $('[data-li-next]').hidden = s !== 'ok'; $('[data-li-skip]').parentElement.hidden = s === 'ok'; humor(s === 'ok' ? 'live' : s === 'wait' ? 'waiting' : 'neutral') }
function desenharContaLi(l) {
  const av = $('[data-li-av]'); av.textContent = l.foto ? '' : inicial(l.name); av.style.backgroundImage = l.foto ? `url("${l.foto}")` : ''
  $('[data-li-name]').textContent = l.name || 'Conta conectada'
  $('[data-li-exp]').textContent = l.expiresAt ? `Acesso válido até ${quando(l.expiresAt)} · o Farol avisa antes de vencer` : ''
}
async function entrarLinkedin() {
  const s = await status(); if (!s) return
  if (s.linkedin.connected) { desenharContaLi(s.linkedin); liEstado('ok') } else if (!LI_POLL) liEstado('idle')
  $('[data-redirect]').textContent = s.linkedin.redirectUri
}
async function conectarLinkedin(proprio = false) {
  try {
    const r = await api('/api/linkedin/connect', proprio ? { proprio: true } : {})
    if (r.precisaChaves) { pill('Login de um clique indisponível', 'Use o seu próprio app do LinkedIn por enquanto.', 'var(--amber)'); return $('#proprio').showModal() }
    liEstado('wait'); Som.tique()
    // ao reconectar ou entrar com outra conta, só vale quando o acesso muda de verdade (conta nova ou validade nova)
    const marca = s => JSON.stringify((s?.linkedin?.contas || []).map(c => [c.id, c.expiresAt]))
    const antes = marca(ST)
    clearInterval(LI_POLL); let n = 0
    LI_POLL = setInterval(async () => {
      if (++n > 200) { clearInterval(LI_POLL); LI_POLL = null; liEstado('idle'); return pill('O login demorou demais', 'Clique em Continuar com LinkedIn de novo.', 'var(--amber)') }
      const s = await api('/api/status').catch(() => null); if (!s) return
      ST = s
      if (s.linkedin.connected && marca(s) !== antes) {
        clearInterval(LI_POLL); LI_POLL = null; desenharContaLi(s.linkedin); liEstado('ok'); desenharConns(); Som.liga()
        pill('LinkedIn conectado', s.linkedin.name || '', 'var(--green)')
        if (atual?.dataset.scene === 'linkedin') setTimeout(() => atual?.dataset.scene === 'linkedin' && proximaCena(), 1600)
      }
    }, DEMO ? 400 : 2000)
  } catch (e) { falha(e) }
}
function cancelarLinkedin() { clearInterval(LI_POLL); LI_POLL = null; api('/api/linkedin/cancelar', {}).catch(() => {}); liEstado('idle') }

// ---------------------------------------------------------------- 2. agente de IA
let AGS = null, LOGIN = null
async function entrarAgente() {
  humor('neutral'); if (!LOGIN) { $('[data-login]').hidden = true; $('[data-agentes]').classList.remove('busy') }
  if (!AGS) $('[data-agentes]').innerHTML = [0, 1, 2].map(() => '<div class="sso" aria-busy="true"><span class="sso-ic"></span><span class="sso-t">&nbsp;</span></div>').join('')
  try { AGS = await api('/api/agentes') } catch (e) { return falha(e) }
  desenharAgentes()
}
function desenharAgentes() {
  const principais = AGS.agentes.filter(a => !a.beta), outros = AGS.agentes.filter(a => a.beta)
  const est = a => a.conectado ? '<span class="sso-st ok">conectado</span>' : a.instalado ? '<span class="sso-st">instalado</span>' : ''
  $('[data-agentes]').innerHTML = principais.map(a => `<button class="sso${AGS.escolhido === a.id ? ' chosen' : ''}" data-agent="${a.id}" style="--c:${a.cor}"><span class="sso-ic">${glifo(a.id, a.cor)}</span><span class="sso-t">Continuar com ${esc(a.nome)}<small>via ${esc(a.via)}</small></span>${est(a)}</button>`).join('')
    + `<div class="or"><span>ou</span></div><div class="dd"><button class="sso" data-act="outros" aria-haspopup="listbox" aria-expanded="false"><span class="sso-ic">${glifo('?', 'var(--soft)')}</span><span class="sso-t">Outra IA<small>${outros.map(a => esc(a.nome)).join(', ')}</small></span><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <ul class="menu" role="listbox" hidden>${outros.map(a => `<li><button role="option" data-agent="${a.id}"><span class="sso-ic">${glifo(a.id, a.cor)}</span><span>${esc(a.nome)}<small>via ${esc(a.via)}</small></span><span class="beta">beta</span></button></li>`).join('')}</ul></div>`
}
function menuOutros(abrir) {
  const dd = $('.dd'); if (!dd) return
  const on = abrir ?? !dd.hasAttribute('data-open')
  dd.toggleAttribute('data-open', on); $('.menu', dd).hidden = !on; $('[data-act=outros]').setAttribute('aria-expanded', on)
  if (on) $('.menu button', dd)?.focus()
}
const FASES = [['instalando', 'Instalar'], ['abrindo', 'Abrir o login no navegador'], ['esperando', 'Entrar na sua conta']]
function desenharLogin(a, j) {
  const card = $('[data-login]'); card.hidden = false
  const ordem = ['conferindo', 'instalando', 'abrindo', 'esperando', 'ok'], fi = ordem.indexOf(j.fase)
  const instalou = j.fase === 'instalando' || LOGIN?.instalou
  if (j.fase === 'instalando' && LOGIN) LOGIN.instalou = true
  const passos = FASES.filter(([f]) => f !== 'instalando' || instalou).map(([f, t]) => {
    const i = ordem.indexOf(f), cls = j.fase === 'erro' ? (i <= (LOGIN?.ultima ?? 0) ? 'bad' : '') : fi > i ? 'ok' : fi === i ? 'run' : ''
    return `<li class="${cls}"><span class="ic"></span>${f === 'instalando' ? `Instalar o ${esc(a.via)}` : t}</li>`
  })
  if (j.fase !== 'erro' && LOGIN) LOGIN.ultima = Math.max(LOGIN.ultima || 0, fi)
  card.innerHTML = `<header><span class="sso-ic">${glifo(a.id, a.cor)}</span><span><b>${j.fase === 'ok' ? `Conectado ao ${esc(a.nome)}` : j.fase === 'erro' ? 'Não deu certo' : `Entrando no ${esc(a.nome)}`}</b><small>${esc(j.fase === 'ok' ? (j.conta || '') : j.msg || '')}</small></span></header>
    <ol class="mini-steps">${passos.join('')}<li class="${j.fase === 'ok' ? 'ok' : ''}"><span class="ic"></span>Pronto</li></ol>
    ${j.fase === 'ok' ? '' : `<div class="lc-a">${j.fase === 'erro' ? `<button class="link" data-agent="${a.id}">Tentar de novo</button>` : `<button class="link" data-act="login-console">${a.beta ? 'Abrir o terminal de login' : 'Não abriu? Abrir numa janela'}</button>`}<button class="link soft" data-act="login-cancel">${j.fase === 'erro' ? 'Escolher outra' : 'Cancelar'}</button></div>`}`
}
async function entrarCom(id, { console: emConsole = false } = {}) {
  const a = AGS.agentes.find(x => x.id === id); if (!a) return
  menuOutros(false)
  $('[data-agentes]').classList.add('busy')
  LOGIN = { id, ultima: 0, instalou: false }
  humor('work'); Som.tique()
  try {
    let j = await api('/api/agente/login', { id, console: emConsole }); desenharLogin(a, j)
    while (LOGIN && LOGIN.id === id && !['ok', 'erro'].includes(j.fase)) {
      await espera(DEMO ? 300 : 1200)
      if (!LOGIN || LOGIN.id !== id) return
      j = await api('/api/agente/job?id=' + id); if (!j.fase) return
      desenharLogin(a, j)
    }
    if (j.fase === 'ok') {
      await api('/api/agente/escolher', { id }); AGS.escolhido = id; a.conectado = true
      Som.liga(); humor('live'); pill(`${a.nome} conectado`, j.conta || '', 'var(--green)')
      setTimeout(() => { if (atual?.dataset.scene === 'agente') cena('sync') }, 1100)
    } else if (j.fase === 'erro') { Som.erro(); humor('error') }
  } catch (e) { falha(e); cancelarLogin() }
}
function cancelarLogin() {
  if (LOGIN) api('/api/agente/cancelar', { id: LOGIN.id }).catch(() => {})
  LOGIN = null; $('[data-login]').hidden = true; $('[data-agentes]').classList.remove('busy'); humor('neutral')
}

// ---------------------------------------------------------------- 3. sincronização (tela de carregamento com cada passo)
let SYNC_ON = false
const EST = { espera: '', rodando: 'run', ok: 'ok', aviso: 'warn', falhou: 'bad', pulado: 'skip' }
async function entrarSync() {
  const aId = AGS?.escolhido || ST?.agente?.id || (DEMO ? 'claude' : null)
  if (!aId) return cena('agente')
  const NOMES = { claude: 'Claude', codex: 'ChatGPT', gemini: 'Gemini', copilot: 'GitHub Copilot', qwen: 'Qwen Code', opencode: 'OpenCode' }
  const a = AGS?.agentes.find(x => x.id === aId) || { id: aId, nome: ST?.agente?.nome || NOMES[aId] || 'agente', cor: null }
  $('[data-sync-glyph]').innerHTML = glifo(a.id, a.cor); $('[data-sync-orb]').style.setProperty('--c', a.cor || 'var(--accent)')
  $('[data-sync-t]').textContent = `Preparando o ${a.nome}…`
  $('[data-sync-s]').textContent = 'Instalando o que ele precisa para trabalhar no Farol. Leva menos de um minuto.'
  $('[data-sync-cta]').hidden = true; $('[data-steps]').classList.remove('done')
  SYNC_ON = true; $('#back').hidden = true; $('[data-sync-orb]').toggleAttribute('data-busy', true); humor('work')
  let s
  try { s = await api('/api/sync', { id: a.id }) } catch (e) { if (e.status !== 409) { SYNC_ON = false; return falha(e) } s = await api('/api/sync') }
  let feitos = 0
  while (true) {
    desenharSync(s, a)
    const n = s.passos.filter(p => !['espera', 'rodando'].includes(p.estado)).length
    if (n > feitos) { for (let i = feitos; i < n; i++) setTimeout(() => Som.tique(), (i - feitos) * 80); feitos = n }
    if (s.fim) break
    await espera(DEMO ? 220 : 400)
    s = await api('/api/sync')
  }
  SYNC_ON = false; $('[data-sync-orb]').removeAttribute('data-busy'); $('#back').hidden = false
  $('[data-steps]').classList.add('done')
  const falhou = s.passos.find(p => p.estado === 'falhou'), avisos = s.passos.filter(p => p.estado === 'aviso')
  if (falhou) {
    Som.erro(); humor('error')
    $('[data-sync-t]').textContent = 'Faltou um passo.'; $('[data-sync-s]').textContent = falhou.detalhe
    $('[data-sync-cta]').innerHTML = `<button class="btn accent lg" data-act="sync-again">Tentar de novo</button><button class="link" data-goscene="agente">Escolher outra IA</button>`
  } else {
    Som.publica(); humor('live'); ST = null; status()
    $('[data-sync-t]').innerHTML = `Pronto. <span class="soft">O ${esc(a.nome)} já conhece o Farol.</span>`
    $('[data-sync-s]').innerHTML = `<span class="summary"><span>${s.resumo.skills} skills</span><span>${s.resumo.prompts} prompts</span><span>${s.resumo.plugins ? '1 plugin' : 'sem plugins'}</span><span>publicação travada</span></span>${avisos.length ? `<br><small class="fine">${avisos.length === 1 ? 'Um aviso' : avisos.length + ' avisos'} acima: dá para resolver depois em Ajustes.</small>` : ''}`
    $('[data-sync-cta]').innerHTML = `<button class="btn accent lg" data-next>Continuar</button><span class="hint"><kbd class="sm">Enter</kbd></span>`
  }
  $('[data-sync-cta]').hidden = false; $('[data-sync-cta]').classList.add('pop')
}
function desenharSync(s, a) {
  const tot = s.passos.length, feitos = s.passos.filter(p => !['espera', 'rodando'].includes(p.estado)).length
  $('[data-ring]').style.strokeDashoffset = (339.3 * (1 - feitos / tot)).toFixed(1)
  $('[data-steps]').innerHTML = s.passos.map(p => `<li class="${EST[p.estado]}"><span class="ic"></span><span><b>${esc(p.rotulo)}</b>${p.detalhe ? `<small>${esc(p.detalhe)}</small>` : ''}</span></li>`).join('')
}

// ---------------------------------------------------------------- 4. formatos (wireframes, demonstração da aprovação)
const FORMATOS = [['imagem', 'Imagem', 'PNG ou JPG, 1080 × 1350'], ['gif', 'GIF animado', 'loop curto, sem som'], ['carrossel', 'Carrossel', 'PDF, um slide por página'], ['video', 'Vídeo', 'MP4, com ou sem som']]
let fmtOn = new Set(), fmtFoco = 0
function desenharFormatos() {
  $('[data-formats]').innerHTML = FORMATOS.map(([f, t, s], i) => `<button class="fmt${fmtOn.has(f) ? ' on' : ''}${i === fmtFoco ? ' focus' : ''}" data-fmt="${f}" data-i="${i}" aria-pressed="${fmtOn.has(f)}">${wire(f)}<footer><span class="state${fmtOn.has(f) ? ' ok' : ''}"></span><span><b>${t}</b><small>${fmtOn.has(f) ? 'aprovado' : s}</small></span></footer></button>`).join('')
  humor(fmtOn.size === FORMATOS.length ? 'live' : 'waiting')
}
function alternarFormato(i) {
  const f = FORMATOS[i][0]; fmtFoco = i
  fmtOn.has(f) ? fmtOn.delete(f) : fmtOn.add(f)
  const on = fmtOn.has(f); on ? Som.liga() : Som.desliga()
  desenharFormatos(); ring($(`[data-fmt="${f}"] .state`))
  const t = $('[data-ft]'), s = $('[data-fs]'), todos = fmtOn.size === FORMATOS.length
  if (todos) { t.innerHTML = 'Aprovados. <span class="soft">Agora é só publicar.</span>'; s.innerHTML = 'Na fila de verdade, <kbd class="sm">P</kbd> publica o que você aprovou. Aperte <kbd class="sm">A</kbd> de novo para desfazer.'; t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap') }
  pill(on ? 'Aprovado' : 'Aprovação desfeita', `${FORMATOS[i][1]} · demonstração`, on ? 'var(--green)' : 'var(--amber)')
}

// ---------------------------------------------------------------- fila
let FILA = [], FILTRO = 'pendente', foco = 0, verMais = false
const TIPO = { dailyui: 'Daily UI', noticias: 'Carrossel', series: 'Série', avulsos: 'Avulso' }
const FMT_TXT = { imagem: 'Imagem', gif: 'GIF', carrossel: 'Carrossel', documento: 'Documento', video: 'Vídeo', multi: 'Várias imagens', texto: 'Só texto', artigo: 'Artigo' }
const LIMITE = 3000   // caracteres do texto de um post no LinkedIn
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const estado = i => i.published ? 'pub' : i.approved ? 'ok' : ''
const estadoTxt = i => i.published ? 'no ar' : i.approved ? 'aprovado' : 'esperando você'
const CONTA = { pendente: i => !i.published && !i.approved, pronto: i => !i.published && i.approved, publicado: i => !!i.published, todos: () => true }
const visiveis = () => FILA.filter(CONTA[FILTRO])
async function carregarFila() {
  try { [FILA] = await Promise.all([api('/api/queue'), ST ? null : status()]) } catch (e) { return falha(e) }
  desenharFila(); atualizarHumor()
}
function atualizarHumor() {
  if (!['fila', 'rotinas', 'ajustes'].includes(atual?.dataset.scene)) return
  humor(FILA.some(CONTA.pendente) ? 'waiting' : FILA.some(CONTA.pronto) ? 'live' : 'neutral')
}
const capa = i => i.formato === 'texto' ? wire('texto', { texto: (i.caption || '').slice(0, 160) })
  : i.cover ? `<img src="${arquivo(i.cover)}" alt="" loading="lazy">${i.formato === 'multi' ? `<span class="wf-badge">${(i.arquivos || []).length} IMAGENS</span>` : i.formato === 'artigo' ? `<span class="wf-badge">LINK</span>` : ''}`
  : i.formato === 'video' && i.file && !DEMO ? `<video src="${arquivo(i.file)}" muted preload="metadata"></video>` : wire(i.formato || 'imagem', { paginas: i.paginas, n: (i.arquivos || []).length || undefined })
// mídia da prévia no feed: como o LinkedIn mostra cada formato
function midiaFeed(i) {
  if (i.formato === 'texto') return ''
  if (i.formato === 'multi') {
    const a = i.arquivos || [], mostra = a.slice(0, 4)
    if (!a.length) return `<div class="fp-media">${wire('multi')}</div>`
    return `<div class="fp-media fp-multi n${Math.min(mostra.length, 4)}">${mostra.map((f, k) => `<span><img src="${arquivo(f)}" alt="">${k === 3 && a.length > 4 ? `<b>+${a.length - 4}</b>` : ''}</span>`).join('')}</div>`
  }
  if (i.formato === 'artigo') {
    const art = i.artigo || {}
    return `<div class="fp-media fp-link">${i.cover ? `<img src="${arquivo(i.cover)}" alt="">` : wire('artigo')}<span><b>${esc(art.titulo || 'Título do artigo')}</b><small>${esc(dominio(art.url) || 'site.com')}</small></span></div>`
  }
  const media = i.formato === 'video' && i.file && !DEMO ? `<video src="${arquivo(i.file)}" controls preload="metadata"></video>` : i.cover ? `<img src="${arquivo(i.cover)}" alt="Prévia de ${esc(i.title)}">` : wire(i.formato || 'imagem', { paginas: i.paginas })
  return `<div class="fp-media">${media}${['carrossel', 'documento'].includes(i.formato) ? `<span class="fp-pages">${i.paginas || 7} páginas</span>` : ''}</div>`
}
function desenharFila() {
  const v = visiveis(), pend = FILA.filter(CONTA.pendente).length, prontos = FILA.filter(CONTA.pronto).length
  $$('[data-filter] button').forEach(b => { b.classList.toggle('on', b.dataset.v === FILTRO); const n = FILA.filter(CONTA[b.dataset.v]).length; b.innerHTML = `${b.textContent.replace(/\d+$/, '').trim()}<span class="n">${n}</span>` })
  $('[data-fila-title]').textContent = pend ? `${pend} ${pend === 1 ? 'post esperando' : 'posts esperando'} você.` : prontos ? 'Tudo aprovado.' : FILA.length ? 'Tudo no ar.' : 'Nada na fila ainda.'
  $('[data-fila-sub]').innerHTML = pend ? 'Olhe a prévia, aperte <kbd class="sm">A</kbd> para aprovar e <kbd class="sm">P</kbd> para publicar.' : prontos ? `${prontos} ${prontos === 1 ? 'pronto' : 'prontos'} para ir ao ar quando você quiser (<kbd class="sm">P</kbd>).` : 'Peça peças novas para a sua IA na aba Rotinas.'
  foco = Math.max(0, Math.min(foco, v.length - 1))
  $('[data-strip]').innerHTML = v.length ? v.map((i, n) => `<button class="post${n === foco ? ' focus' : ''}" data-n="${n}" aria-pressed="${n === foco}">
    <div class="shot">${capa(i)}</div>
    <footer><span class="state ${estado(i)}"></span><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || TIPO[i.kind]} · ${estadoTxt(i)}</small></span></footer></button>`).join('')
    : `<div class="empty"><div class="wf-row">${wire('imagem')}${wire('carrossel')}${wire('video')}</div><h3>${FILTRO === 'pendente' ? 'Nada esperando você.' : 'Nada por aqui.'}</h3><p>Quando a sua IA terminar uma peça, ela aparece aqui para você olhar antes de ir ao ar.</p><div class="cta small"><button class="btn sm" data-run="daily-ui">Gerar o Daily UI</button><button class="btn sm" data-run="pauta-noticias">Montar os carrosséis</button></div></div>`
  detalhe()
}
function detalhe() {
  const i = visiveis()[foco], d = $('[data-detail]')
  if (!i) { d.hidden = true; return } d.hidden = false
  const l = ST?.linkedin || {}, nome = l.name || 'Você'
  const chars = i.caracteres ?? (i.caption || '').trim().length, passou = chars > LIMITE
  const acoes = i.published ? `<a class="btn" href="${esc(i.published.link)}" target="_blank" rel="noopener">Ver no LinkedIn</a>`
    : [!i.hasFile ? `<button class="btn" data-q="export">Exportar</button>` : '',
       i.kind !== 'series' ? `<button class="btn${i.approved ? '' : ' accent'}" data-q="toggle">${i.approved ? 'Desfazer aprovação' : 'Aprovar'} <kbd>A</kbd></button>` : '',
       i.approved && i.hasFile ? `<button class="btn${i.kind === 'series' || i.approved ? ' good' : ''}" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora <kbd>P</kbd></button>` : ''].join('')
  const longa = (i.caption || '').length > 180 || (i.caption || '').split('\n').length > 3
  d.innerHTML = `<div class="fp-label"><span>Prévia no feed</span><span>${TIPO[i.kind]} · ${FMT_TXT[i.formato] || ''}</span></div>
    <article class="fp">
      <header class="fp-head"><span class="avatar" style="${l.foto ? `background-image:url('${esc(l.foto)}');color:transparent` : ''}">${inicial(nome)}</span><span><b>${esc(nome)}</b><small>${i.published ? 'publicado ' + quando(Date.parse(i.published.quando)) : 'agora'} · Público</small></span></header>
      <div class="fp-cap${longa && !verMais ? ' clamp' : ''}">${esc(i.caption || 'Sem legenda.')}</div>${longa ? `<div class="fp-more"><button class="link" data-q="mais">${verMais ? 'ver menos' : '…ver mais'}</button></div>` : ''}
      ${midiaFeed(i)}
      <div class="fp-foot"><span><svg viewBox="0 0 16 16"><path d="M5 7v6H3V7zm2 6V7l3-5c1 0 1.6.8 1.4 1.8L11 6h2.4c.9 0 1.5.8 1.3 1.7l-1 4.5c-.2.5-.6.8-1.2.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Gostei</span><span><svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Comentar</span><span><svg viewBox="0 0 16 16"><path d="M9.5 3 13 6.5 9.5 10M13 6.5H7a4 4 0 0 0-4 4V13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Compartilhar</span></div>
    </article>
    <div class="fp-actions">${acoes}${i.file ? `<a class="link" href="${arquivo(i.file)}" target="_blank" rel="noopener">Abrir o arquivo</a>` : ''}</div>
    <p class="fp-note${passou ? ' bad' : ''}">${passou ? `O texto tem ${chars.toLocaleString('pt-BR')} caracteres: o LinkedIn aceita até ${LIMITE.toLocaleString('pt-BR')}. Encurte a legenda para publicar.` : `${chars.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres`}${!i.published && !l.connected ? ' · Conecte o LinkedIn em Ajustes para publicar.' : l.connected && !i.published ? ` · sai como ${esc(l.name || '')}` : ''}</p>`
}
async function acao(q) {
  const i = visiveis()[foco]; if (!i) return
  if (q === 'mais') { verMais = !verMais; return detalhe() }
  const item = { kind: i.kind, id: i.id }
  try {
    if (q === 'toggle' && i.kind !== 'series' && !i.published) {
      const era = i.approved
      await api(era ? '/api/unapprove' : '/api/approve', item)
      era ? Som.desliga() : Som.liga()
      pill(era ? 'Aprovação desfeita' : 'Aprovado', i.title, era ? 'var(--amber)' : 'var(--green)')
      ring($(`[data-strip] .post[data-n="${foco}"] .state`))
    }
    if (q === 'export') { pill('Exportando…', i.title); await api('/api/export', item); Som.tique(); pill('Exportado', i.title, 'var(--green)') }
    if (q === 'publish') {
      if (!i.approved || i.published || !i.hasFile) return
      if ((i.caracteres ?? 0) > LIMITE) return pill('Texto longo demais', `O LinkedIn aceita até ${LIMITE} caracteres.`, 'var(--amber)')
      if (!ST?.linkedin?.connected) return pill('Conecte o LinkedIn antes', 'Ajustes → LinkedIn', 'var(--amber)')
      if (!(await confirmar('Publicar no LinkedIn agora?', `"${i.title}" vai para o seu perfil, visível para todo mundo.`, 'Publicar'))) return
      pill('Publicando…', i.formato === 'video' ? 'Vídeos levam um ou dois minutos.' : i.title, 'var(--violet)')
      const r = await api('/api/publish', item); Som.publica(); humor('live'); pill('No ar', i.title, 'var(--accent)')
      if (r.link && !DEMO) abrirFora(r.link)
    }
    await carregarFila()
  } catch (e) { falha(e) }
}
$('[data-strip]').addEventListener('click', e => { const p = e.target.closest('.post'); if (!p) return; foco = +p.dataset.n; verMais = false; Som.tique(); desenharFila() })
$('[data-detail]').addEventListener('click', e => { const q = e.target.closest('[data-q]')?.dataset.q; if (q) acao(q) })
$$('[data-filter] button').forEach(b => b.addEventListener('click', () => { FILTRO = b.dataset.v; foco = 0; Som.tique(); carregarFila() }))

// ---------------------------------------------------------------- rotinas
async function carregarRotinas() {
  let d; try { d = await api('/api/runs') } catch (e) { return falha(e) }
  const a = ST?.agente
  $('[data-rot-sub]').textContent = d.agente ? `O ${d.agente} gera as peças e para antes de publicar. O resto é com você.` : 'Escolha uma IA em Ajustes para rodar as rotinas.'
  const ART = { 'daily-ui': wire('gif'), 'pauta-noticias': wire('carrossel') }
  $('[data-rotinas]').innerHTML = d.rotinas.map(r => {
    const u = d.runs.find(x => x.id === r.id), rodando = u && u.status === 'rodando'
    return `<article class="glass rot"><header><span class="sso-ic">${a ? glifo(a.id) : glifo('?')}</span><span><h3>${esc(r.titulo)}</h3><small>${u ? `${esc(u.status)} · ${new Date(u.inicio).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}` : d.agente ? `roda no ${esc(d.agente)}` : 'sem IA escolhida'}</small></span></header>
      ${u ? `<pre class="log">${esc(u.tail || '…')}</pre>` : `<p>${r.id === 'daily-ui' ? 'A tela do desafio de hoje, com as decisões de UX e a legenda.' : 'Dois carrosséis com pauta checada em fonte primária.'}</p>`}
      <div class="row"><button class="btn${rodando ? '' : ' accent'} sm" data-run="${r.id}" ${rodando || !d.agente ? 'disabled' : ''}>${rodando ? '<span class="spin" style="width:14px;height:14px"></span> Rodando…' : 'Rodar agora'}</button></div>
      <details class="more"><summary>Agendar no Windows</summary><pre class="log">${esc(r.agendar || '')}</pre><button class="link" data-copy="${esc(r.agendar || '')}">Copiar o comando</button></details></article>`
  }).join('')
  if (d.runs.some(r => r.status === 'rodando')) setTimeout(() => atual?.dataset.scene === 'rotinas' && carregarRotinas(), 4000)
}
async function rodar(id) {
  if (!ST) await status()
  if (!ST?.agente?.conectado) return falha(new Error('Conecte uma IA primeiro (Ajustes).'))
  try { await api('/api/run', { id }); Som.liga(); pill('Rotina iniciada', 'As peças aparecem na fila quando ficarem prontas.', 'var(--violet)'); if (atual?.dataset.scene === 'rotinas') carregarRotinas() } catch (e) { falha(e) }
}

// ---------------------------------------------------------------- ajustes
function desenharAjustes() {
  if (!ST) return
  const { linkedin: l, agente: a, desigma: d, config } = ST
  const linha = (k, cor, txt, acoes) => { const r = $(`[data-conn="${k}"]`); $('.c-ic', r).style.setProperty('--c', cor); $('[data-conn-t]', r).textContent = txt; $('[data-conn-a]', r).innerHTML = acoes }
  $('[data-conn=linkedin] .c-ic').innerHTML = GLIFO.linkedin
  const contas = l.contas || [], vence = venceLogo(l)
  linha('linkedin', !l.connected ? (contas.length ? 'var(--red)' : 'var(--amber)') : vence ? 'var(--amber)' : 'var(--green)',
    l.connected ? `${l.name} · ${vence ? `vence ${prazo(l.dias)}: reconecte para continuar publicando` : 'válido até ' + quando(l.expiresAt)}` : contas.length ? `O acesso de ${contas.find(c => c.ativa)?.nome || contas[0].nome} venceu: reconecte para publicar.` : 'Não conectado: sem isso nada vai ao ar.',
    l.connected || contas.length ? `<button class="btn sm${vence || !l.connected ? ' accent' : ''}" data-act="li-again">Reconectar</button><button class="link" data-act="li-add">Outra conta</button><button class="link soft" data-act="li-off">Desconectar</button>` : '<button class="btn sm accent" data-act="li-again">Conectar</button>')
  // várias contas: lista com "Usar" (a conta em uso é a que publica)
  const box = $('[data-li-contas]')
  box.hidden = contas.length < 2
  box.innerHTML = contas.map(c => `<div class="acc${c.ativa ? ' on' : ''}"><span class="avatar sm" style="${c.foto ? `background-image:url('${esc(c.foto)}');color:transparent` : ''}">${inicial(c.nome)}</span><span class="c-t"><b>${esc(c.nome)}</b><small>${c.valida ? 'válido até ' + quando(c.expiresAt) : 'acesso vencido'}</small></span>${c.ativa ? '<span class="ok-badge">em uso</span>' : `<button class="link" data-usar="${esc(c.id)}">Usar esta</button>`}</div>`).join('')
  $('[data-conn=agente] [data-conn-ic]').innerHTML = glifo(a ? a.id : '?')
  $('[data-conn=agente] [data-conn-n]').textContent = a ? `${a.nome} · ${a.via}` : 'IA'
  linha('agente', a && a.conectado ? 'var(--green)' : 'var(--amber)', a ? (a.conectado ? `${a.conta || 'conectado'}${a.sincronizado ? ' · sincronizado em ' + quando(Date.parse(a.sincronizado)) : ' · falta sincronizar'}` : 'Falta entrar na conta') : 'Nenhuma IA escolhida.',
    `${a ? '<button class="btn sm" data-act="sync-again">Sincronizar de novo</button>' : ''}<button class="${a ? 'link' : 'btn sm accent'}" data-goscene="agente">${a ? 'Trocar' : 'Escolher'}</button>`)
  const dok = d.mcpOk
  linha('desigma', dok ? (d.registered ? 'var(--green)' : 'var(--amber)') : 'var(--faint)', dok ? (d.registered ? 'Ligado à sua IA: cada peça vira um quadro editável.' : 'Encontrado. Sincronize para ligar à sua IA.') : 'Não encontrado neste computador. É opcional.',
    dok ? '' : '<a class="link" href="https://github.com/deepfounder-ai/desigma/releases" target="_blank" rel="noopener">Baixar</a>')
  const f = $('[data-form=desigma]'); for (const k of ['exe', 'mcpExe', 'workspace', 'project']) if (document.activeElement !== f[k]) f[k].value = d[k] || ''
  const fc = $('[data-form=config]'); if (document.activeElement !== fc.assetsDir) fc.assetsDir.value = config.assetsDir || ''; if (document.activeElement !== fc.dailyUiStart) fc.dailyUiStart.value = config.dailyUiStart || ''
  marcarPrefs()
}
function marcarPrefs() { for (const g of $$('[data-pref]')) { const v = store.get(g.dataset.pref, { theme: 'auto', sound: 'tom', toast: 'padrao' }[g.dataset.pref]); $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === v)) } }
$$('[data-pref] button').forEach(b => b.addEventListener('click', () => {
  const k = b.closest('[data-pref]').dataset.pref; store.set(k, b.dataset.v); marcarPrefs()
  if (k === 'theme') aplicarTema()
  if (k === 'sound') Som.liga(); else Som.tique()
  if (k === 'toast') pill('Assim fica o aviso', 'Daily UI 003 · esperando você', 'var(--amber)')
}))

// ---------------------------------------------------------------- cliques e formulários
// na versão desktop (janela do Tauri), links externos e arquivos abrem fora do app: no navegador e no programa padrão
function abrirFora(url) {
  if (!ST?.desktop) return window.open(url, '_blank', 'noopener')
  api('/api/abrir', { url: new URL(url, location.href).origin === location.origin ? new URL(url, location.href).pathname : url }).catch(falha)
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[target=_blank]')
  if (a && ST?.desktop && !e.defaultPrevented) { e.preventDefault(); abrirFora(a.getAttribute('href')) }
}, true)
document.addEventListener('click', async e => {
  if (!e.target.closest('.dd')) menuOutros(false)
  const t = e.target.closest('button, a'); if (!t) return
  if (t.matches('[data-next]')) return proximaCena()
  if (t.matches('[data-finish]')) return terminar()
  if (t.matches('[data-view]')) { voltarPara = null; return cena(t.dataset.view) }
  if (t.matches('[data-goscene]')) { const de = atual.dataset.scene; voltarPara = ['fila', 'rotinas', 'ajustes'].includes(de) ? de : voltarPara; return cena(t.dataset.goscene) }
  if (t.matches('[data-restart]')) { voltarPara = null; fmtOn = new Set(); return cena('ola') }
  if (t.matches('[data-run]')) return rodar(t.dataset.run)
  if (t.matches('[data-agent]')) return entrarCom(t.dataset.agent)
  if (t.matches('[data-fmt]')) return alternarFormato(+t.dataset.i)
  if (t.matches('[data-usar]')) { try { await api('/api/linkedin/usar', { id: t.dataset.usar }); Som.liga(); await status(); pill('Conta em uso', `Os posts saem como ${ST.linkedin.name}`, 'var(--green)') } catch (err) { falha(err) } return }
  if (t.matches('[data-copy]')) { try { await navigator.clipboard.writeText(t.dataset.copy); Som.tique(); pill('Copiado') } catch { pill('Não consegui copiar', 'Selecione o texto e copie à mão.', 'var(--amber)') } return }
  if (t.matches('[data-close]')) return t.closest('dialog').close()
  if (t.id === 'back') return voltar()
  if (t.id === 'conns') { voltarPara = null; return cena('ajustes') }
  const act = t.dataset.act; if (!act) return
  try {
    if (act === 'li-connect' || act === 'li-reopen') return conectarLinkedin()
    if (act === 'li-cancel') return cancelarLinkedin()
    if (act === 'li-proprio') return $('#proprio').showModal()
    if (act === 'li-again') { voltarPara = atual.dataset.scene; cena('linkedin'); return setTimeout(conectarLinkedin, 450) }
    if (act === 'li-add') { if (await confirmar('Entrar com outra conta?', 'Antes, saia do LinkedIn no navegador (ou use outro perfil do navegador). Senão o LinkedIn entra direto com a conta que já está aberta.', 'Continuar')) { voltarPara = atual.dataset.scene; cena('linkedin'); setTimeout(conectarLinkedin, 450) } return }
    if (act === 'li-off') {
      const c = (ST?.linkedin?.contas || []).find(x => x.ativa), varias = (ST?.linkedin?.contas || []).length > 1
      if (await confirmar(`Desconectar ${c ? c.nome : 'o LinkedIn'}?`, varias ? 'A outra conta conectada passa a ser a usada para publicar.' : 'O Farol para de conseguir publicar até você conectar de novo.', 'Desconectar')) { await api('/api/linkedin/disconnect', c ? { id: c.id } : {}); Som.desliga(); status() }
      return
    }
    if (act === 'outros') return menuOutros()
    if (act === 'login-console') return LOGIN && entrarCom(LOGIN.id, { console: true })
    if (act === 'login-cancel') return cancelarLogin()
    if (act === 'sync-again') { if (atual.dataset.scene === 'sync') { $('[data-sync-cta]').hidden = true; return entrarSync() } voltarPara = atual.dataset.scene; return cena('sync') }
    if (act === 'copy-redirect') { await navigator.clipboard.writeText($('[data-redirect]').textContent); Som.tique(); pill('Copiado') }
  } catch (err) { falha(err) }
})
const form = (sel, fn) => $(sel).addEventListener('submit', async e => { e.preventDefault(); try { await fn(e.target); Som.liga(); status() } catch (err) { falha(err) } })
form('[data-form=linkedin-keys]', async f => {
  await api('/api/linkedin/keys', { client_id: f.client_id.value, client_secret: f.client_secret.value }); f.client_secret.value = ''
  $('#proprio').close(); pill('Chaves salvas', 'Só neste computador', 'var(--green)')
  if (atual?.dataset.scene !== 'linkedin') { voltarPara = atual.dataset.scene; cena('linkedin') }
  setTimeout(() => conectarLinkedin(true), 400)
})
form('[data-form=desigma]', async f => { await api('/api/desigma/config', { exe: f.exe.value, mcpExe: f.mcpExe.value, workspace: f.workspace.value, project: f.project.value }); pill('Caminhos salvos', 'Sincronizando com a sua IA…', 'var(--green)'); if (ST?.agente) { voltarPara = 'ajustes'; cena('sync') } })
form('[data-form=config]', async f => { const r = await api('/api/config', { assetsDir: f.assetsDir.value, dailyUiStart: f.dailyUiStart.value }); pill('Salvo', r.msg, 'var(--green)') })

// ---------------------------------------------------------------- teclado (Enter avança; Esc volta; A, P, ← e → na fila)
const lit = (k, on) => $$(`kbd[data-k="${k}"]`).forEach(x => x.classList.toggle('lit', on))
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || $('dialog[open]')) return
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const nome = atual?.dataset.scene
  lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, true)
  if (k === 'Escape') { if ($('.dd[data-open]')) return menuOutros(false); if (ONB.includes(nome) || voltarPara) return voltar() }
  if (k === 'Enter' && ONB.includes(nome) && !e.target.closest('button, a, summary')) {
    e.preventDefault()
    if (nome === 'ola') return proximaCena()
    if (nome === 'linkedin') return $('[data-li]').dataset.li === 'ok' ? proximaCena() : $('[data-li]').dataset.li === 'idle' ? conectarLinkedin() : null
    if (nome === 'sync') return !$('[data-sync-cta]').hidden && $('[data-sync-cta] [data-next]') ? proximaCena() : null
    if (nome === 'formatos') return terminar()
  }
  if (nome === 'formatos') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { fmtFoco = (fmtFoco + (k === 'ArrowRight' ? 1 : FORMATOS.length - 1)) % FORMATOS.length; Som.tique(); desenharFormatos() }
    if (k === 'a') alternarFormato(fmtFoco)
  }
  if (nome === 'fila') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); foco += k === 'ArrowRight' ? 1 : -1; verMais = false; Som.tique(); desenharFila(); $(`[data-strip] .post[data-n="${foco}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }) }
    if (k === 'a') acao('toggle')
    if (k === 'p') acao('publish')
  }
})
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, false) })

// ---------------------------------------------------------------- início
if (DEMO) setTimeout(() => pill('Demonstração', 'Logins simulados: nada é conectado nem publicado de verdade.', 'var(--violet)'), 1200)
if (new URLSearchParams(location.search).has('captura')) document.documentElement.classList.add('static')
const pedida = new URLSearchParams(location.search).get('tela')   // ?tela=fila abre direto numa cena (útil para capturas e atalhos)
if (pedida && $(`.scene[data-scene="${pedida}"]`)) cena(pedida, { som: false })
else if (store.get('onboarded') === '1') { cena('fila', { som: false }); setInterval(() => atual?.dataset.scene === 'fila' && carregarFila(), 60000) }
else { cena('ola', { som: false }); status() }
