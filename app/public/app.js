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
    jobs: {}, sync: null, posts: {}, tarefas: [], ops: 0, gasto: 0, analise: null,
    perfil: { id: 'principal', nome: 'Seu Nome', area: '', publico: '', objetivo: '', tom: '', temas: [], evitar: [], links: { site: '', portfolio: '' }, sobre: '', pilares: [], marca: { cores: { principal: '', secundaria: '', acento: '', fundo: '', texto: '' }, fontes: { titulo: '', texto: '' }, estilo: '', referencias: [], aplicarNoMotor: false, usarNoEstudio: true }, analise: null, atualizado: null },
    // biblioteca de exemplo: imagens desenhadas aqui mesmo (wireframes), nenhuma peça real
    midia: [['#4cc2ff', 'tela-de-login.png', 'envio', 'Tela de login com campos de e-mail e senha.'], ['#8b7cff', 'antes.png', 'envio', ''], ['#3ddc84', 'depois.png', 'envio', ''], ['#ffb547', 'daily-ui-003.png', 'dailyui', '']].map(([cor, nome, origem, alt], k) => ({
      arquivo: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#16203a"/><rect x="40" y="40" width="320" height="260" rx="18" fill="${cor}" opacity=".22"/><circle cx="112" cy="112" r="30" fill="${cor}"/><path d="M40 280 150 175l70 60 50-40 90 80v5H40z" fill="${cor}" opacity=".6"/><rect x="40" y="340" width="230" height="22" rx="11" fill="#fff" opacity=".35"/><rect x="40" y="380" width="300" height="16" rx="8" fill="#fff" opacity=".18"/><rect x="40" y="410" width="200" height="16" rx="8" fill="#fff" opacity=".18"/></svg>`),
      nome, tipo: 'imagem', bytes: 180000 + k * 41000, largura: 1080, altura: 1350, criado: Date.now() - k * 36e5, origem, alt, avisos: [], apagavel: origem === 'envio' })).concat([
      { arquivo: 'demo:processo.mp4', nome: 'processo.mp4', tipo: 'video', bytes: 8.4 * 1048576, criado: Date.now() - 9e6, origem: 'envio', alt: '', avisos: [], apagavel: true },
      { arquivo: 'demo:guia.pdf', nome: 'guia-de-estilo.pdf', tipo: 'documento', bytes: 2.1 * 1048576, criado: Date.now() - 2e7, origem: 'envio', alt: '', avisos: [], apagavel: true }]),
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
// imagem de exemplo desenhada na hora (wireframe colorido), para a demonstração
const svgDemo = cor => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><radialGradient id="c" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="${cor}" stop-opacity=".55"/><stop offset="1" stop-color="#0e1524"/></radialGradient></defs><rect width="400" height="500" fill="url(#c)"/><path d="M0 380 120 300l80 50 90-70 110 90v130H0z" fill="${cor}" opacity=".45"/><path d="M186 170h28l10 120h-48z" fill="#eef1f8"/><circle cx="200" cy="155" r="14" fill="#ffb547"/><path d="M200 155 400 110v90z" fill="#ffb547" opacity=".22"/></svg>`)
const usoDemo = () => ({ mes: new Date().toISOString().slice(0, 7), operacoes: D.ops, gasto: D.gasto, semPreco: D.tarefas.filter(t => t.op !== 'melhorar').reduce((s, t) => s + t.itens.length, 0), limiteMensal: 30, orcamentoMensal: 10 })
const RECURSOS_DEMO = {
  gerar: { proporcoes: [['social_post_4_5', '4:5 · feed'], ['square_1_1', '1:1'], ['widescreen_16_9', '16:9'], ['social_story_9_16', '9:16 · story']], resolucoes: [['1k', '1K'], ['2k', '2K'], ['4k', '4K']], modelos: [['realism', 'Realismo'], ['fluid', 'Fluido'], ['zen', 'Zen'], ['flexible', 'Flexível'], ['super_real', 'Super real'], ['editorial_portraits', 'Retratos editoriais']], maxVersoes: 4 },
  melhorar: { fatores: ['2x', '4x', '8x', '16x'], maxPixels: 25.3e6, otimizado: [['standard', 'Padrão'], ['art_n_illustration', 'Arte e ilustração'], ['films_n_photography', 'Cinema e fotografia'], ['3d_renders', 'Renders 3D']] },
  refinar: {},
}
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
    case '/api/midia': return { itens: D.midia, limites: {} }
    case '/api/midia/alt': { const m = D.midia.find(x => x.arquivo === data.arquivo); if (m) m.alt = String(data.alt || '').trim(); return { ok: true } }
    case '/api/midia/excluir': D.midia = D.midia.filter(x => x.arquivo !== data.arquivo); return { ok: true }
    case '/api/post': { const p = D.posts[id]; if (!p) throw new Error('post não encontrado'); return p }
    case '/api/post/salvar': {
      const pid = data.id || (String(data.titulo || data.legenda || 'post').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'post') + '-' + Date.now().toString(36).slice(-4)
      const midias = data.midias.map(m => ({ ...m, tipo: tipoM(m), nome: (D.midia.find(x => x.arquivo === m.arquivo) || {}).nome || 'mídia' }))
      const p = D.posts[pid] = { id: pid, titulo: data.titulo || (data.legenda || '').split('\n')[0].slice(0, 60) || pid, legenda: data.legenda, midias, artigo: data.artigo, aprovado: false, atualizado: new Date().toISOString() }
      const imgs = midias.filter(m => ['imagem', 'gif'].includes(m.tipo)), t = midias.map(m => m.tipo)
      const formato = data.artigo ? 'artigo' : t.includes('video') ? 'video' : t.includes('documento') ? 'documento' : imgs.length > 1 ? 'multi' : imgs.length ? 'imagem' : 'texto'
      const item = { kind: 'avulsos', id: pid, title: p.titulo, formato, pasta: true, editor: true, rascunho: !data.enviar, hasFile: true, approved: false, published: null, caption: data.legenda, caracteres: data.legenda.trim().length, cover: imgs[0]?.arquivo, arquivos: formato === 'multi' ? imgs.map(m => m.arquivo) : undefined, artigo: data.artigo || undefined }
      const k = D.fila.findIndex(x => x.kind === 'avulsos' && x.id === pid); k >= 0 ? (D.fila[k] = item) : D.fila.unshift(item)
      return p
    }
    case '/api/post/enviar': { const it = D.fila.find(x => x.id === id); if (it) it.rascunho = false; return { ok: true } }
    // estúdio de imagens simulado: as "imagens geradas" são desenhos feitos aqui mesmo
    case '/api/imagem': return { provedores: [{ id: 'magnific', nome: 'Magnific', chaveUrl: 'https://www.magnific.com/user/organization/api-keys', nota: 'Demonstração: nada é pedido ao Magnific de verdade.', recursos: RECURSOS_DEMO, temChave: true }], uso: usoDemo(), tarefas: D.tarefas }
    case '/api/imagem/tarefas': return { tarefas: D.tarefas, uso: usoDemo() }
    case '/api/imagem/estimar': { const n = data.op === 'gerar' ? data.versoes || 1 : 1, v = data.op === 'melhorar' ? ({ '2x': 0.2, '4x': 0.5 }[data.params.scale_factor] ?? 0.5) : null; return { valor: v, total: v == null ? null : v * n, versoes: n, aPartir: data.op === 'melhorar' && !['2x'].includes(data.params.scale_factor), nota: v == null ? 'demonstração: o preço real é o do painel do Magnific' : 'demonstração: estimativa pelos exemplos de preço', uso: usoDemo() } }
    case '/api/imagem/pedir': {
      const n = data.op === 'gerar' ? data.versoes || 1 : 1, cores = ['#8b7cff', '#4cc2ff', '#3ddc84', '#ffb547']
      const job = { id: 'j' + Date.now().toString(36), provedor: 'magnific', op: data.op, estado: 'rodando', criado: Date.now(), prompt: data.params.prompt || null, origem: data.origem || null, itens: Array.from({ length: n }, () => ({ estado: 'rodando' })) }
      D.tarefas.unshift(job); D.ops += n; if (data.op === 'melhorar') D.gasto += 0.2
      setTimeout(() => { job.itens.forEach((it, k) => { const m = { arquivo: svgDemo(cores[k % 4]), nome: `${(job.prompt || 'imagem').slice(0, 24)}-${k + 1}.png`, tipo: 'imagem', bytes: 900000, largura: 2048, altura: 2560, criado: Date.now(), origem: 'magnific', provedor: 'Magnific', prompt: job.prompt, mae: job.origem, alt: '', avisos: [], apagavel: true }; D.midia.unshift(m); Object.assign(it, { estado: 'pronto', arquivos: [m.arquivo] }) }); job.estado = 'pronto' }, 2600)
      return job
    }
    case '/api/imagem/chave': case '/api/imagem/config': return { ok: true }
    // perfil simulado (a análise devolve um exemplo genérico, sem chamar IA nenhuma)
    case '/api/perfil': return { perfil: D.perfil, ativo: 'principal', perfis: [{ id: 'principal', nome: D.perfil.nome || 'Perfil principal', conta: D.linkedin.connected ? D.linkedin.name : null }], analise: D.analise, agente: 'Claude' }
    case '/api/perfil/salvar': D.perfil = { ...JSON.parse(JSON.stringify(data.perfil)), atualizado: new Date().toISOString() }; return D.perfil
    case '/api/perfil/analise': return D.analise || {}
    case '/api/perfil/analisar': {
      D.analise = { id: 'principal', estado: 'rodando', agente: 'claude' }
      setTimeout(() => {
        const resultado = { resumo: 'Exemplo de análise: designer de produto que traduz problemas complexos em telas simples, com foco em acessibilidade.', area: 'Design de produto e UX', publico: 'Líderes de produto, recrutadores e outros designers', objetivo: 'Ser referência na área', tom: 'Direto, Simpático', temas: ['acessibilidade', 'processo de design', 'bastidores de projeto'], pilares: [{ tema: 'Processo de design', por_que: 'mostra como você pensa', ideias: ['Do rascunho à tela final em 4 passos', 'O que eu corto primeiro num redesenho'] }, { tema: 'Acessibilidade na prática', por_que: 'diferencial raro e útil', ideias: ['3 testes de contraste que levam 1 minuto'] }, { tema: 'Bastidores', por_que: 'aproxima o público', ideias: ['Minha mesa e minhas ferramentas'] }], cores: { principal: '#7c5cff', secundaria: '#2ee6a6', fundo: '#14102a', texto: '#f4f1ff' }, estilo_visual: 'ilustração limpa, fundo escuro e acentos neon', observacoes: ['Demonstração: nada foi lido de verdade.'] }
        Object.assign(D.analise, { estado: 'pronto', resultado }); D.perfil.analise = { ...resultado, agente: 'claude', quando: new Date().toISOString() }
      }, 2600)
      return { estado: 'rodando' }
    }
    case '/api/post/excluir': D.fila = D.fila.filter(x => x.id !== id); delete D.posts[id]; return { ok: true }
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
  if (atual?.dataset.scene === 'editor') guardarAoSair()
  if (atual?.dataset.scene === 'perfil' && pfSujo) salvarPerfil({ quieto: true }).then(() => pill('Perfil salvo', '', 'var(--green)'))
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
  fila: () => carregarFila(), rotinas: () => carregarRotinas(), ajustes: () => { status(); carregarImgAjustes() },
  biblioteca: () => carregarBiblioteca(), editor: () => entrarEditor(), perfil: () => carregarPerfil(),
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
const estado = i => i.published ? 'pub' : i.rascunho ? 'draft' : i.approved ? 'ok' : ''
const estadoTxt = i => i.published ? 'no ar' : i.rascunho ? 'rascunho' : i.approved ? 'aprovado' : 'esperando você'
const CONTA = { pendente: i => !i.published && !i.approved && !i.rascunho, pronto: i => !i.published && i.approved && !i.rascunho, publicado: i => !!i.published, rascunho: i => !i.published && !!i.rascunho, todos: () => true }
const visiveis = () => FILA.filter(CONTA[FILTRO])
async function carregarFila() {
  try { [FILA] = await Promise.all([api('/api/queue'), ST ? null : status()]) } catch (e) { return falha(e) }
  desenharFila(); atualizarHumor()
}
function atualizarHumor() {
  if (!['fila', 'rotinas', 'ajustes', 'biblioteca', 'editor', 'perfil'].includes(atual?.dataset.scene)) return
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
  return `<div class="fp-media">${media}${['carrossel', 'documento'].includes(i.formato) ? `<span class="fp-pages">${i.paginas ? i.paginas + ' páginas' : 'Documento'}</span>` : ''}</div>`
}
// o cartão do post como aparece no feed (usado na fila e no editor)
function cartaoFeed(i, { aberto = false, quandoTxt = 'agora' } = {}) {
  const l = ST?.linkedin || {}, nome = l.name || 'Você'
  const longa = (i.caption || '').length > 180 || (i.caption || '').split('\n').length > 3
  return `<article class="fp">
      <header class="fp-head"><span class="avatar" style="${l.foto ? `background-image:url('${esc(l.foto)}');color:transparent` : ''}">${inicial(nome)}</span><span><b>${esc(nome)}</b><small>${quandoTxt} · Público</small></span></header>
      <div class="fp-cap${longa && !aberto ? ' clamp' : ''}">${esc(i.caption || 'Sem legenda.')}</div>${longa ? `<div class="fp-more"><button class="link" data-q="mais">${aberto ? 'ver menos' : '…ver mais'}</button></div>` : ''}
      ${midiaFeed(i)}
      <div class="fp-foot"><span><svg viewBox="0 0 16 16"><path d="M5 7v6H3V7zm2 6V7l3-5c1 0 1.6.8 1.4 1.8L11 6h2.4c.9 0 1.5.8 1.3 1.7l-1 4.5c-.2.5-.6.8-1.2.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Gostei</span><span><svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Comentar</span><span><svg viewBox="0 0 16 16"><path d="M9.5 3 13 6.5 9.5 10M13 6.5H7a4 4 0 0 0-4 4V13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Compartilhar</span></div>
    </article>`
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
  const editar = i.kind === 'avulsos' && i.pasta && !i.published ? `<button class="btn" data-q="editar">Editar</button>` : ''
  const acoes = i.published ? `<a class="btn" href="${esc(i.published.link)}" target="_blank" rel="noopener">Ver no LinkedIn</a>`
    : i.rascunho ? `<button class="btn accent" data-q="enviar">Enviar para aprovação</button>${editar}<button class="link soft" data-q="excluir">Excluir</button>`
    : [editar, !i.hasFile ? `<button class="btn" data-q="export">Exportar</button>` : '',
       i.kind !== 'series' ? `<button class="btn${i.approved ? '' : ' accent'}" data-q="toggle">${i.approved ? 'Desfazer aprovação' : 'Aprovar'} <kbd>A</kbd></button>` : '',
       i.approved && i.hasFile ? `<button class="btn${i.kind === 'series' || i.approved ? ' good' : ''}" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora <kbd>P</kbd></button>` : ''].join('')
  d.innerHTML = `<div class="fp-label"><span>Prévia no feed</span><span>${TIPO[i.kind]} · ${FMT_TXT[i.formato] || ''}</span></div>
    ${cartaoFeed(i, { aberto: verMais, quandoTxt: i.published ? 'publicado ' + quando(Date.parse(i.published.quando)) : 'agora' })}
    <div class="fp-actions">${acoes}${i.file && (!i.pasta || ST?.desktop) ? `<a class="link" href="${arquivo(i.file)}" target="_blank" rel="noopener">${i.pasta ? 'Abrir a pasta' : 'Abrir o arquivo'}</a>` : ''}</div>
    <p class="fp-note${passou ? ' bad' : ''}">${passou ? `O texto tem ${chars.toLocaleString('pt-BR')} caracteres: o LinkedIn aceita até ${LIMITE.toLocaleString('pt-BR')}. Encurte a legenda para publicar.` : `${chars.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres`}${!i.published && !l.connected ? ' · Conecte o LinkedIn em Ajustes para publicar.' : l.connected && !i.published ? ` · sai como ${esc(l.name || '')}` : ''}</p>`
}
async function acao(q) {
  const i = visiveis()[foco]; if (!i) return
  if (q === 'mais') { verMais = !verMais; return detalhe() }
  if (q === 'editar') return abrirEditor({ id: i.id })
  const item = { kind: i.kind, id: i.id }
  try {
    if (q === 'enviar') { await api('/api/post/enviar', { id: i.id }); Som.liga(); pill('Enviado para aprovação', i.title, 'var(--amber)'); FILTRO = 'pendente' }
    if (q === 'excluir') { if (!(await confirmar('Excluir este rascunho?', `"${i.title}" vai para a lixeira do workspace (dá para recuperar).`, 'Excluir'))) return; await api('/api/post/excluir', { id: i.id }); Som.desliga(); pill('Rascunho excluído', i.title, 'var(--amber)') }
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

// ---------------------------------------------------------------- biblioteca de mídia
let BIB = [], BIB_F = 'todas', BIB_SEL = null
const ORIGEM = { envio: 'Enviado por você', dailyui: 'Daily UI', serie: 'Série', noticias: 'Carrossel de notícias' }
const TIPO_M = { imagem: 'Imagem', gif: 'GIF', video: 'Vídeo', documento: 'Documento' }
const tamanho = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'
const filtroBib = (m, f) => f === 'todas' || (f === 'rotinas' ? ['dailyui', 'serie', 'noticias'].includes(m.origem) : f === 'gerada' ? !!m.provedor : m.tipo === f)
const origemTxt = m => m.provedor ? `Gerada com ${m.provedor}` : ORIGEM[m.origem] || m.origem
const euro = v => '€' + Number(v).toFixed(2).replace('.', ',')
function miniatura(m, { controles = false } = {}) {
  if (m.tipo === 'imagem' || m.tipo === 'gif') return `<img src="${arquivo(m.arquivo)}" alt="${esc(m.alt || '')}" loading="lazy">`
  if (m.tipo === 'video' && !DEMO && !String(m.arquivo).startsWith('blob:')) return `<video src="${arquivo(m.arquivo)}" muted preload="metadata"${controles ? ' controls' : ''}></video>`
  return wire(m.tipo === 'video' ? 'video' : 'documento')
}
async function carregarBiblioteca() {
  try { BIB = (await api('/api/midia')).itens } catch (e) { return falha(e) }
  desenharBiblioteca()
}
function desenharBiblioteca() {
  const v = BIB.filter(m => filtroBib(m, BIB_F))
  $$('[data-bib-filtro] button').forEach(b => { b.classList.toggle('on', b.dataset.v === BIB_F); const n = BIB.filter(m => filtroBib(m, b.dataset.v)).length; b.innerHTML = `${b.textContent.replace(/\d+$/, '').trim()}<span class="n">${n}</span>` })
  $('[data-bib-sub]').textContent = BIB.length ? `${BIB.length} ${BIB.length === 1 ? 'mídia' : 'mídias'}. Arraste arquivos para cá para enviar; clique numa para ver detalhes e escrever o texto alternativo.` : 'Tudo o que pode ir num post: o que você envia e o que a sua IA gera.'
  if (!BIB.find(m => m.arquivo === BIB_SEL)) BIB_SEL = v[0]?.arquivo || null
  $('[data-midias]').innerHTML = v.length ? v.map(m => `<button class="midia${m.arquivo === BIB_SEL ? ' focus' : ''}" data-m="${esc(m.arquivo)}"><div class="shot">${miniatura(m)}<span class="wf-badge">${TIPO_M[m.tipo]}</span>${m.avisos?.length ? '<span class="m-aviso" title="Tem um aviso">!</span>' : ''}</div><footer><b>${esc(m.nome)}</b><small>${esc(origemTxt(m))}${m.alt ? ' · com texto alternativo' : ''}</small></footer></button>`).join('')
    : `<div class="empty"><div class="wf-row">${wire('imagem')}${wire('gif')}${wire('video')}</div><h3>${BIB.length ? 'Nada neste filtro.' : 'A biblioteca está vazia.'}</h3><p>Arraste fotos, GIFs, vídeos ou PDFs para cá, ou use "Enviar arquivos". O que as rotinas gerarem também aparece aqui.</p></div>`
  detalheMidia()
}
function detalheMidia() {
  const m = BIB.find(x => x.arquivo === BIB_SEL), d = $('[data-midia-det]')
  if (!m) { d.hidden = true; return } d.hidden = false
  const visual = m.tipo === 'imagem' || m.tipo === 'gif'
  d.innerHTML = `<div class="fp-label"><span>${TIPO_M[m.tipo]}</span><span>${esc(origemTxt(m))}</span></div>
    <div class="md-prev">${miniatura(m, { controles: true })}</div>
    <div class="md-info">
      <b>${esc(m.nome)}</b>
      <small>${[m.largura ? `${m.largura} × ${m.altura}` : '', m.quadros > 1 ? `${m.quadros} quadros` : '', tamanho(m.bytes), quando(m.criado)].filter(Boolean).join(' · ')}</small>
      ${(m.avisos || []).map(a => `<p class="md-aviso">${esc(a)}</p>`).join('')}
      ${m.prompt ? `<p class="soft"><b>Prompt:</b> ${esc(m.prompt)}</p>` : ''}
      ${m.mae ? `<p class="soft"><b>Feita a partir de:</b> ${esc(m.mae.split('/').pop())}</p>` : ''}
      ${m.custo && m.custo.valor != null ? `<p class="soft"><b>Custo estimado:</b> ${euro(m.custo.valor)}</p>` : ''}
    </div>
    ${visual ? `<label class="ed-campo md-alt"><span>Texto alternativo <small>descreve a imagem para quem usa leitor de tela</small></span><textarea data-alt rows="3" maxlength="4086" placeholder="Ex.: Tela de cadastro com campos de nome e e-mail e um botão roxo.">${esc(m.alt || '')}</textarea></label>` : ''}
    <div class="fp-actions">
      <button class="btn accent" data-mq="usar">Usar em novo post</button>
      ${visual ? `<button class="btn" data-mq="melhorar">Melhorar</button><button class="btn" data-mq="refinar">Refinar</button>` : ''}
      <a class="link" href="${arquivo(m.arquivo)}" target="_blank" rel="noopener">Abrir o arquivo</a>
      ${m.apagavel ? `<button class="link soft" data-mq="excluir">Excluir</button>` : ''}
    </div>`
}
async function acaoMidia(q) {
  const m = BIB.find(x => x.arquivo === BIB_SEL); if (!m) return
  try {
    if (q === 'usar') return abrirEditor({ midias: [{ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }] })
    if (q === 'melhorar' || q === 'refinar') return abrirEstudio({ op: q, origem: m })
    if (q === 'excluir') {
      if (!(await confirmar('Excluir da biblioteca?', `"${m.nome}" vai para a lixeira do workspace. Posts que já usam este arquivo continuam com a cópia deles.`, 'Excluir'))) return
      await api('/api/midia/excluir', { arquivo: m.arquivo }); Som.desliga(); pill('Excluído', m.nome, 'var(--amber)'); BIB_SEL = null; carregarBiblioteca()
    }
  } catch (e) { falha(e) }
}
async function salvarAlt(texto) {
  const m = BIB.find(x => x.arquivo === BIB_SEL); if (!m || (m.alt || '') === texto.trim()) return
  try { await api('/api/midia/alt', { arquivo: m.arquivo, alt: texto }); m.alt = texto.trim(); Som.tique(); pill('Texto alternativo salvo', m.nome, 'var(--green)'); desenharBiblioteca() } catch (e) { falha(e) }
}
$('[data-midias]').addEventListener('click', e => { const b = e.target.closest('.midia'); if (!b) return; BIB_SEL = b.dataset.m; Som.tique(); desenharBiblioteca() })
$('[data-midia-det]').addEventListener('click', e => { const q = e.target.closest('[data-mq]')?.dataset.mq; if (q) acaoMidia(q) })
$('[data-midia-det]').addEventListener('focusout', e => { if (e.target.matches('[data-alt]')) salvarAlt(e.target.value) })
$$('[data-bib-filtro] button').forEach(b => b.addEventListener('click', () => { BIB_F = b.dataset.v; Som.tique(); desenharBiblioteca() }))

// envio de arquivos (botão ou arrastar e soltar): vai para a biblioteca e, no editor, entra no post
async function enviarArquivos(lista) {
  const arqs = [...lista], feitos = []
  for (const [k, f] of arqs.entries()) {
    pill(`Enviando ${arqs.length > 1 ? `${k + 1} de ${arqs.length}` : 'arquivo'}…`, f.name, 'var(--violet)')
    try {
      if (DEMO) { const t = /\.gif$/i.test(f.name) ? 'gif' : /^image\//.test(f.type) ? 'imagem' : /^video\//.test(f.type) ? 'video' : 'documento'; const m = { arquivo: URL.createObjectURL(f), nome: f.name, tipo: t, bytes: f.size, criado: Date.now(), origem: 'envio', alt: '', avisos: [], apagavel: true }; D.midia.unshift(m); feitos.push(m); continue }
      const r = await fetch('/api/midia/upload?nome=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'X-Engine-Token': TOKEN }, body: f })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(`${f.name}: ${j.erro || 'erro ' + r.status}`)
      feitos.push(j)
    } catch (e) { falha(e) }
  }
  if (feitos.length) { Som.liga(); pill(feitos.length === 1 ? 'Arquivo na biblioteca' : `${feitos.length} arquivos na biblioteca`, feitos.map(m => m.nome).join(', ').slice(0, 80), 'var(--green)') }
  return feitos
}
$('[data-enviar]').addEventListener('change', async e => { const f = await enviarArquivos(e.target.files); e.target.value = ''; if (f.length) { BIB_SEL = f[0].arquivo; carregarBiblioteca() } })
// arrastar e soltar na biblioteca e nas mídias do editor
for (const alvo of $$('.solta-alvo')) {
  alvo.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); alvo.classList.add('solta') } })
  alvo.addEventListener('dragleave', e => { if (!alvo.contains(e.relatedTarget)) alvo.classList.remove('solta') })
  alvo.addEventListener('drop', async e => {
    e.preventDefault(); alvo.classList.remove('solta')
    const f = await enviarArquivos(e.dataTransfer.files); if (!f.length) return
    if (alvo.matches('[data-ed-midias]')) { ED.midias.push(...f.map(m => ({ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }))); edMudou() }
    else { BIB_SEL = f[0].arquivo; carregarBiblioteca() }
  })
}

// ---------------------------------------------------------------- editor de posts
let ED = null, ED_PEDIDO = null, edVerMais = false
const edNovo = () => ({ id: null, titulo: '', legenda: '', midias: [], artigo: null, sujo: false, salvoEm: null, aprovado: false, rascunho: true })
// abre o editor: { id } edita um post salvo; { midias } começa um post novo com essas mídias
function abrirEditor(pedido = {}) { ED_PEDIDO = pedido; voltarPara = ['fila', 'biblioteca', 'perfil', 'rotinas', 'ajustes'].includes(atual?.dataset.scene) ? atual.dataset.scene : 'fila'; if (atual?.dataset.scene === 'editor') entrarEditor(); else cena('editor') }
let ED_PERFIL = null
// lembrete do perfil acima do texto: para quem, em que tom (e a ideia do pilar, quando o post nasce de uma)
function desenharLembrete() {
  const el = $('[data-ed-perfil]'), p = ED_PERFIL, partes = []
  if (p?.publico) partes.push(`<b>Para:</b> ${esc(p.publico)}`)
  if (p?.tom) partes.push(`<b>Tom:</b> ${esc(p.tom)}`)
  if (ED?.dica) partes.push(esc(ED.dica))
  el.hidden = !partes.length; el.innerHTML = partes.join(' · ')
}
async function entrarEditor() {
  const p = ED_PEDIDO || {}; ED_PEDIDO = null
  api('/api/perfil').then(r => { ED_PERFIL = r.perfil; desenharLembrete() }).catch(() => {})
  if (!p.id && !p.midias && !p.titulo && ED && ED.sujo) { desenharEditor(); return }   // voltou para o editor com algo por salvar
  ED = edNovo()
  if (p.midias) ED.midias = p.midias
  if (p.titulo) ED.titulo = p.titulo
  if (p.legenda) ED.legenda = p.legenda
  if (p.dica) ED.dica = p.dica
  if (p.id) {
    try { const r = await api('/api/post?id=' + encodeURIComponent(p.id)); Object.assign(ED, { id: r.id, titulo: r.titulo === r.id ? '' : r.titulo, legenda: r.legenda, midias: r.midias, artigo: r.artigo, aprovado: r.aprovado, rascunho: r.rascunho, salvoEm: r.atualizado }) } catch (e) { falha(e) }
  }
  edVerMais = false
  $('[data-ed-titulo]').value = ED.titulo; $('[data-ed-texto]').value = ED.legenda
  $('[data-ed-artigo]').checked = !!ED.artigo
  $('[data-art-url]').value = ED.artigo?.url || ''; $('[data-art-titulo]').value = ED.artigo?.titulo || ''; $('[data-art-desc]').value = ED.artigo?.descricao || ''
  desenharEditor(); desenharLembrete()
  setTimeout(() => (ED.legenda ? null : $('[data-ed-texto]').focus()), 350)
}
const tipoM = m => m.tipo || (/\.gif$/i.test(m.arquivo) ? 'gif' : /\.(png|jpe?g)$/i.test(m.arquivo) ? 'imagem' : /\.mp4$/i.test(m.arquivo) ? 'video' : 'documento')
function formatoEd() {
  if (ED.artigo) return 'artigo'
  const t = ED.midias.map(tipoM), imgs = t.filter(x => x === 'imagem' || x === 'gif')
  if (t.includes('video')) return 'video'
  if (t.includes('documento')) return 'documento'
  return imgs.length > 1 ? 'multi' : imgs.length === 1 ? (t[0] === 'gif' ? 'gif' : 'imagem') : 'texto'
}
// as mesmas regras do servidor (engine/posts.js), para avisar antes de salvar
function errosEd() {
  const t = ED.midias.map(tipoM), imgs = t.filter(x => x === 'imagem' || x === 'gif').length, vd = t.filter(x => x === 'video' || x === 'documento').length, e = []
  if (ED.legenda.length > LIMITE) e.push(`O texto passou do limite: ${ED.legenda.length.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres.`)
  if (vd > 1 || (vd && imgs)) e.push('Vídeo e documento vão sozinhos no post: tire as outras mídias.')
  if (imgs > 20) e.push('Até 20 imagens por post.')
  if (ED.artigo && (vd || imgs > 1)) e.push('Um link leva só uma imagem, a miniatura do cartão.')
  if (ED.artigo && !/^https?:\/\/\S+$/i.test(ED.artigo.url || '')) e.push('O link precisa começar com http:// ou https://.')
  if (ED.artigo && !(ED.artigo.titulo || '').trim()) e.push('Dê um título ao cartão do link.')
  if (!ED.midias.length && !ED.artigo && !ED.legenda.trim()) e.push('Escreva um texto ou adicione uma mídia.')
  return e
}
function edMudou() { ED.sujo = true; desenharEditor() }
function desenharEditor() {
  if (!ED) return
  const f = formatoEd(), n = ED.legenda.length, erros = errosEd()
  $('[data-ed-t]').textContent = ED.id ? 'Editar post.' : 'Novo post.'
  $('[data-ed-s]').textContent = ED.aprovado ? 'Este post estava aprovado: salvar uma mudança pede a aprovação de novo.' : 'Escreva, junte as mídias e veja ao lado como fica no feed.'
  const conta = $('[data-ed-conta]'); conta.textContent = `${n.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')}`; conta.className = n > LIMITE ? 'bad' : n > LIMITE * 0.9 ? 'warn' : ''
  const tags = (ED.legenda.match(/#[\p{L}\p{N}_]+/gu) || []).length
  $('[data-ed-dica]').textContent = [n > 210 ? 'o feed corta depois da 3ª linha (“…ver mais”)' : '', tags ? `${tags} ${tags === 1 ? 'hashtag' : 'hashtags'}` : ''].filter(Boolean).join(' · ')
  $('[data-ed-fmt]').textContent = FMT_TXT[f]
  $('[data-ed-art]').hidden = !ED.artigo
  $('[data-ed-midias]').innerHTML = ED.midias.map((m, k) => `<div class="ed-m">
      <div class="shot">${miniatura({ ...m, tipo: tipoM(m) })}<span class="wf-badge">${k + 1}</span></div>
      <div class="ed-m-a"><button class="ic-btn" data-em="esq" data-k="${k}" title="Mover para a esquerda" ${k ? '' : 'disabled'}>‹</button><button class="ic-btn" data-em="dir" data-k="${k}" title="Mover para a direita" ${k < ED.midias.length - 1 ? '' : 'disabled'}>›</button><button class="ic-btn" data-em="tirar" data-k="${k}" title="Tirar do post">×</button></div>
      ${['imagem', 'gif'].includes(tipoM(m)) ? `<input class="ed-m-alt" data-em-alt="${k}" value="${esc(m.alt || '')}" maxlength="4086" placeholder="Texto alternativo" aria-label="Texto alternativo da mídia ${k + 1}">` : `<small class="soft">${TIPO_M[tipoM(m)]}</small>`}
    </div>`).join('') + `<div class="ed-add"><button class="ed-add-b" data-ed="gerar"><svg viewBox="0 0 16 16"><path d="M8 1.5c.4 3.4 2.6 5.6 6 6-3.4.4-5.6 2.6-6 6-.4-3.4-2.6-5.6-6-6 3.4-.4 5.6-2.6 6-6Z" fill="currentColor"/></svg>Gerar com IA</button><button class="ed-add-b" data-ed="biblioteca"><svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 11 6 7.5l3 3 2-2 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Da biblioteca</button><label class="ed-add-b"><svg viewBox="0 0 16 16"><path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Enviar arquivo<input type="file" multiple hidden data-ed-enviar accept=".png,.jpg,.jpeg,.gif,.mp4,.pdf,.ppt,.pptx,.doc,.docx"></label></div>`
  const erro = $('[data-ed-erro]'); erro.hidden = !erros.length; erro.innerHTML = erros.map(esc).join('<br>')
  $('[data-ed=enviar]').disabled = !!erros.length
  $('[data-ed=enviar]').textContent = ED.rascunho ? 'Enviar para aprovação' : 'Salvar e voltar para a fila'
  $('[data-ed=salvar]').innerHTML = `${ED.rascunho ? 'Salvar rascunho' : 'Salvar'} <kbd>Ctrl S</kbd>`
  $('[data-ed-salvo]').textContent = ED.sujo ? 'Mudanças não salvas' : ED.salvoEm ? `Salvo ${new Date(ED.salvoEm).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}` : ''
  // prévia ao vivo com o mesmo cartão da fila
  const imgs = ED.midias.filter(m => ['imagem', 'gif'].includes(tipoM(m)))
  const item = { kind: 'avulsos', title: ED.titulo, formato: f, caption: ED.legenda, cover: imgs[0]?.arquivo, arquivos: f === 'multi' ? imgs.map(m => m.arquivo) : undefined, file: f === 'video' ? ED.midias[0]?.arquivo : undefined, artigo: ED.artigo }
  $('[data-ed-previa]').innerHTML = `<div class="fp-label"><span>Prévia no feed</span><span>${FMT_TXT[f]}</span></div>${cartaoFeed(item, { aberto: edVerMais })}<p class="fp-note">${ST?.linkedin?.connected ? `Sai como ${esc(ST.linkedin.name)}, depois de você aprovar na fila.` : 'Conecte o LinkedIn em Ajustes para publicar.'}</p>`
}
async function salvarEd({ enviar = false, quieto = false } = {}) {
  if (!ED) return
  const erros = errosEd()
  if (enviar && erros.length) return pill('Falta ajustar', erros[0], 'var(--amber)')
  try {
    const dados = { id: ED.id, titulo: ED.titulo, legenda: ED.legenda, midias: ED.midias.map(m => ({ arquivo: m.arquivo, alt: m.alt || '' })), artigo: ED.artigo, enviar }
    const r = await api('/api/post/salvar', dados)
    Object.assign(ED, { id: r.id, sujo: false, salvoEm: r.atualizado || new Date().toISOString(), midias: r.midias || ED.midias, aprovado: false, rascunho: r.rascunho ?? !enviar })
    if (enviar) { Som.liga(); pill('Enviado para aprovação', r.titulo || '', 'var(--amber)'); FILTRO = 'pendente'; ED = null; voltarPara = null; return cena('fila') }
    if (!quieto) { Som.tique(); pill(ED.rascunho ? 'Rascunho salvo' : 'Salvo', ED.rascunho ? r.titulo || '' : 'Continua na fila, esperando a sua aprovação.', 'var(--green)') }
    desenharEditor()
  } catch (e) { falha(e) }
}
// sair do editor com algo escrito salva como rascunho, sem perguntar
function guardarAoSair() {
  if (atual?.dataset.scene !== 'editor' || !ED?.sujo || errosEd().some(x => /Escreva/.test(x))) return
  const era = ED.rascunho
  salvarEd({ quieto: true }).then(() => pill(era ? 'Rascunho salvo' : 'Mudanças salvas', era ? 'Está na fila, em Rascunhos.' : 'Continua na fila, esperando a sua aprovação.', 'var(--green)'))
}
$('[data-ed-texto]').addEventListener('input', e => { ED.legenda = e.target.value; edMudou() })
$('[data-ed-titulo]').addEventListener('input', e => { ED.titulo = e.target.value; ED.sujo = true; desenharEditor() })
$('[data-ed-artigo]').addEventListener('change', e => { ED.artigo = e.target.checked ? { url: $('[data-art-url]').value, titulo: $('[data-art-titulo]').value, descricao: $('[data-art-desc]').value } : null; edMudou(); if (e.target.checked) $('[data-art-url]').focus() })
for (const [sel, k] of [['[data-art-url]', 'url'], ['[data-art-titulo]', 'titulo'], ['[data-art-desc]', 'descricao']]) $(sel).addEventListener('input', e => { if (ED.artigo) { ED.artigo[k] = e.target.value; edMudou() } })
$('[data-ed-midias]').addEventListener('click', e => {
  const b = e.target.closest('[data-em]'); if (!b) return
  const k = +b.dataset.k, m = ED.midias
  if (b.dataset.em === 'tirar') m.splice(k, 1)
  if (b.dataset.em === 'esq' && k > 0) [m[k - 1], m[k]] = [m[k], m[k - 1]]
  if (b.dataset.em === 'dir' && k < m.length - 1) [m[k + 1], m[k]] = [m[k], m[k + 1]]
  Som.tique(); edMudou()
})
$('[data-ed-midias]').addEventListener('input', e => { if (e.target.matches('[data-em-alt]')) { ED.midias[+e.target.dataset.emAlt].alt = e.target.value; ED.sujo = true; $('[data-ed-salvo]').textContent = 'Mudanças não salvas' } })
$('[data-ed-midias]').addEventListener('change', async e => { if (!e.target.matches('[data-ed-enviar]')) return; const f = await enviarArquivos(e.target.files); ED.midias.push(...f.map(m => ({ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }))); edMudou() })
$('[data-ed-previa]').addEventListener('click', e => { if (e.target.closest('[data-q=mais]')) { edVerMais = !edVerMais; desenharEditor() } })

// escolher mídias da biblioteca (para o editor)
let PK = [], PK_F = 'todas', PK_SEL = []
async function abrirPicker() {
  try { PK = (await api('/api/midia')).itens } catch (e) { return falha(e) }
  PK_SEL = []; desenharPicker(); $('#picker').showModal()
}
function desenharPicker() {
  const v = PK.filter(m => PK_F === 'todas' || (PK_F === 'imagem' ? ['imagem', 'gif'].includes(m.tipo) : m.tipo === PK_F))
  $$('[data-pk-filtro] button').forEach(b => b.classList.toggle('on', b.dataset.v === PK_F))
  $('[data-pk-lista]').innerHTML = v.length ? v.map(m => { const i = PK_SEL.indexOf(m.arquivo); return `<button class="midia${i >= 0 ? ' focus' : ''}" data-pk="${esc(m.arquivo)}" aria-pressed="${i >= 0}"><div class="shot">${miniatura(m)}${i >= 0 ? `<span class="pk-n">${i + 1}</span>` : ''}</div><footer><b>${esc(m.nome)}</b><small>${TIPO_M[m.tipo]} · ${esc(origemTxt(m))}</small></footer></button>` }).join('') : '<p class="soft">Nada aqui ainda. Envie arquivos na Biblioteca ou arraste para o editor.</p>'
  $('[data-pk-n]').textContent = PK_SEL.length ? `${PK_SEL.length} ${PK_SEL.length === 1 ? 'escolhida' : 'escolhidas'} (na ordem do clique)` : 'Nada escolhido'
  $('[data-pk-ok]').disabled = !PK_SEL.length
}
$('[data-pk-lista]').addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (!b) return; const a = b.dataset.pk, i = PK_SEL.indexOf(a); i >= 0 ? PK_SEL.splice(i, 1) : PK_SEL.push(a); Som.tique(); desenharPicker() })
$$('[data-pk-filtro] button').forEach(b => b.addEventListener('click', () => { PK_F = b.dataset.v; desenharPicker() }))
$('[data-pk-ok]').addEventListener('click', () => { ED.midias.push(...PK_SEL.map(a => { const m = PK.find(x => x.arquivo === a); return { arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome } })); $('#picker').close(); Som.liga(); edMudou() })

// ---------------------------------------------------------------- estúdio de imagens (provedores em engine/imagem; hoje, Magnific)
let IMG = null, ES = null, esTimer = null, esEstimarT = null
const OP_TXT = { gerar: 'Gerar', melhorar: 'Melhorar', refinar: 'Refinar' }
// identidade do perfil no estúdio: cores e estilo entram no texto; a primeira referência vira a referência de estilo do Mystic
const coresMarca = m => Object.values(m?.cores || {}).filter(v => /^#[0-9a-f]{6}$/i.test(v || ''))
const refMarca = m => (m?.referencias || []).find(r => BIB.some(b => b.arquivo === r))
const temMarca = m => !!(coresMarca(m).length || m?.estilo || refMarca(m))
const prov = () => IMG?.provedores?.[0]
async function abrirEstudio(o = {}) {
  try { IMG = await api('/api/imagem') } catch (e) { return falha(e) }
  if (!BIB.length) { try { BIB = (await api('/api/midia')).itens } catch { } }
  let marca = null; try { marca = (await api('/api/perfil')).perfil.marca } catch { }
  ES = { op: o.op || 'gerar', origem: o.origem || null, contexto: o.contexto || (atual?.dataset.scene === 'editor' ? 'editor' : null), jobs: [], descartados: new Set(), marca,
    p: { prompt: o.prompt || '', aspect_ratio: 'social_post_4_5', resolution: '2k', model: 'realism', versoes: 2, scale_factor: '2x', optimized_for: 'standard', creativity: 0, resemblance: 0, hdr: 0, prompt_m: '', sharpen: 50, smart_grain: 7, ultra_detail: 30, usarMarca: !!(marca && marca.usarNoEstudio && temMarca(marca)) } }
  desenharEstudio(); $('#estudio').showModal(); estimarEs()
}
const imagensBib = () => BIB.filter(m => ['imagem', 'gif'].includes(m.tipo))
const deslize = (k, rot, min, max, dica) => `<label class="es-sl"><span>${rot} <b data-es-v="${k}">${ES.p[k]}</b></span><input type="range" min="${min}" max="${max}" step="1" value="${ES.p[k]}" data-es="${k}"><small>${dica}</small></label>`
function desenharEstudio() {
  const p = prov(), r = p.recursos, op = ES.op
  $$('[data-es-op] button').forEach(b => b.classList.toggle('on', b.dataset.v === op))
  $('[data-es-chave]').hidden = p.temChave; $('[data-es-prov]').textContent = p.nome
  const escolher = `<div class="es-orig">${ES.origem ? `<div class="es-orig-img"><img src="${arquivo(ES.origem.arquivo)}" alt=""><span><b>${esc(ES.origem.nome || ES.origem.arquivo.split('/').pop())}</b><small>${ES.origem.largura ? `${ES.origem.largura} × ${ES.origem.altura}` : ''}</small></span><button class="link" type="button" data-es-trocar>Trocar</button></div>`
    : `<p class="soft">Escolha a imagem que vai ser ${op === 'melhorar' ? 'melhorada' : 'refinada'}:</p><div class="es-mini">${imagensBib().slice(0, 18).map(m => `<button type="button" data-es-orig="${esc(m.arquivo)}" title="${esc(m.nome)}"><img src="${arquivo(m.arquivo)}" alt=""></button>`).join('') || '<span class="soft">Nenhuma imagem na biblioteca ainda.</span>'}</div>`}</div>`
  let f = ''
  if (op === 'gerar') {
    f = `<label class="ed-campo"><span>O que você quer ver <small>descreva cena, estilo, luz e cores</small></span><textarea data-es="prompt" rows="4" maxlength="4000" placeholder="Ex.: um farol pixel art num arquipélago ao entardecer, tons de roxo e menta, céu estrelado">${esc(ES.p.prompt)}</textarea></label>
      <div class="es-linha"><span>Proporção</span><div class="chips">${r.gerar.proporcoes.slice(0, 4).map(([v, t]) => `<button type="button" data-es-chip="aspect_ratio" data-v="${v}" class="${ES.p.aspect_ratio === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="fields two"><label><span>Resolução</span><select data-es="resolution">${r.gerar.resolucoes.map(([v, t]) => `<option value="${v}"${ES.p.resolution === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label><span>Estilo do modelo</span><select data-es="model">${r.gerar.modelos.map(([v, t]) => `<option value="${v}"${ES.p.model === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="es-linha"><span>Versões para escolher</span><div class="chips">${[1, 2, 3, 4].slice(0, r.gerar.maxVersoes).map(n => `<button type="button" data-es-chip="versoes" data-v="${n}" class="${ES.p.versoes === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${temMarca(ES.marca) ? `<label class="ed-switch es-marca"><input type="checkbox" data-es-marca${ES.p.usarMarca ? ' checked' : ''}><span><b>Usar a identidade do perfil</b><small><span class="pf-sw">${coresMarca(ES.marca).map(c => `<i style="background:${c}"></i>`).join('')}</span>${ES.marca.estilo ? esc(ES.marca.estilo.slice(0, 90)) : ''}${refMarca(ES.marca) ? ` · referência: ${esc(refMarca(ES.marca).split('/').pop())}` : ''}</small></span></label>` : '<p class="fine">Dica: defina cores, estilo e imagens de referência na tela Perfil para as imagens saírem com a sua cara.</p>'}`
  } else if (op === 'melhorar') {
    const o = ES.origem, max = r.melhorar.maxPixels
    f = escolher + `<div class="es-linha"><span>Aumentar</span><div class="chips">${r.melhorar.fatores.map(v => { const k = parseInt(v), px = o?.largura ? o.largura * k * o.altura * k : 0, passa = px > max; return `<button type="button" data-es-chip="scale_factor" data-v="${v}" class="${ES.p.scale_factor === v ? 'on' : ''}" ${passa ? 'disabled title="passaria do máximo de 25,3 milhões de pixels"' : ''}>${v}${o?.largura ? `<small>${o.largura * k} × ${o.altura * k}</small>` : ''}</button>` }).join('')}</div></div>
      <label class="ed-campo"><span>Tipo de imagem</span><select data-es="optimized_for">${r.melhorar.otimizado.map(([v, t]) => `<option value="${v}"${ES.p.optimized_for === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${deslize('creativity', 'Criatividade', -10, 10, 'mais alto inventa mais detalhes')}${deslize('resemblance', 'Semelhança', -10, 10, 'mais alto fica mais fiel ao original')}${deslize('hdr', 'Definição (HDR)', -10, 10, 'contraste e nitidez')}
      <label class="ed-campo"><span>Orientação <small>opcional: o que realçar</small></span><input data-es="prompt_m" maxlength="1000" value="${esc(ES.p.prompt_m)}" placeholder="Ex.: texturas de pixel art nítidas"></label>`
  } else {
    f = escolher + `${deslize('sharpen', 'Nitidez', 0, 100, 'bordas mais definidas')}${deslize('ultra_detail', 'Ultra detalhe', 0, 100, 'acrescenta detalhes finos')}${deslize('smart_grain', 'Granulação', 0, 100, 'textura de foto')}`
  }
  $('[data-es-form]').innerHTML = f
  const ok = p.temChave && (op === 'gerar' ? ES.p.prompt.trim().length > 2 : !!ES.origem)
  const ir = $('[data-es-ir]'); ir.disabled = !ok
  ir.textContent = op === 'gerar' ? `Gerar ${ES.p.versoes} ${ES.p.versoes === 1 ? 'versão' : 'versões'}` : op === 'melhorar' ? `Melhorar ${ES.p.scale_factor}` : 'Refinar'
  desenharResultados()
}
function paramsEs() {
  const p = ES.p
  if (ES.op === 'gerar') {
    const m = p.usarMarca && temMarca(ES.marca) ? ES.marca : null, cores = coresMarca(m), ref = refMarca(m)
    const prompt = [p.prompt.trim(), cores.length ? `Paleta de cores: ${cores.join(', ')}` : '', m?.estilo ? `Estilo: ${m.estilo}` : ''].filter(Boolean).join('. ')
    return { prompt, aspect_ratio: p.aspect_ratio, resolution: p.resolution, model: p.model, ...(ref ? { estiloArquivo: ref } : {}) }
  }
  if (ES.op === 'melhorar') return { scale_factor: p.scale_factor, optimized_for: p.optimized_for, creativity: +p.creativity, resemblance: +p.resemblance, hdr: +p.hdr, ...(p.prompt_m ? { prompt: p.prompt_m } : {}) }
  return { sharpen: +p.sharpen, smart_grain: +p.smart_grain, ultra_detail: +p.ultra_detail }
}
const pedidoEs = () => ({ provedor: prov().id, op: ES.op, params: paramsEs(), origem: ES.op === 'gerar' ? undefined : ES.origem?.arquivo, versoes: ES.op === 'gerar' ? ES.p.versoes : 1 })
function estimarEs() {
  clearTimeout(esEstimarT)
  esEstimarT = setTimeout(async () => {
    if (ES.op !== 'gerar' && !ES.origem) { $('[data-es-custo]').innerHTML = ''; return }
    try {
      const e = await api('/api/imagem/estimar', pedidoEs()); ES.est = e
      const u = e.uso
      $('[data-es-custo]').innerHTML = `<b>${e.total != null ? `Custo estimado: ${e.aPartir ? 'a partir de ' : ''}${euro(e.total)}` : 'Custo: não informado'}</b><small>${esc(e.nota)}</small>
        <span class="es-uso"><span><i style="width:${Math.min(100, (u.operacoes / Math.max(1, u.limiteMensal)) * 100)}%"></i></span>Este mês: ${u.operacoes} de ${u.limiteMensal} operações · ~${euro(u.gasto)} de ${euro(u.orcamentoMensal)}${u.semPreco ? ` (+${u.semPreco} sem preço publicado)` : ''}</span>`
    } catch (err) { $('[data-es-custo]').innerHTML = `<small class="bad">${esc(err.message)}</small>` }
  }, 250)
}
async function irEs() {
  const p = prov(), e = ES.est, n = ES.op === 'gerar' ? ES.p.versoes : 1
  const custo = e && e.total != null ? `Custo estimado: ${e.aPartir ? 'a partir de ' : ''}${euro(e.total)}.` : 'O preço desta operação não é publicado pelo Magnific: confira no painel dele.'
  if (!(await confirmar(`Usar créditos do ${p.nome}?`, `${OP_TXT[ES.op]}: ${n} ${n === 1 ? 'operação' : 'operações'}. ${custo} O resultado fica na sua biblioteca.`, OP_TXT[ES.op]))) return
  try {
    const job = await api('/api/imagem/pedir', pedidoEs())
    ES.jobs.unshift(job.id); IMG.tarefas = [job, ...(IMG.tarefas || []).filter(j => j.id !== job.id)]
    Som.tique(); pill(ES.op === 'gerar' ? `Gerando ${n} ${n === 1 ? 'versão' : 'versões'}…` : `${OP_TXT[ES.op]}…`, 'Leva de alguns segundos a um minuto.', 'var(--violet)')
    desenharResultados(); estimarEs(); acompanharEs()
  } catch (err) { falha(err) }
}
function acompanharEs() {
  clearTimeout(esTimer)
  esTimer = setTimeout(async () => {
    try {
      const antes = Object.fromEntries((IMG.tarefas || []).map(j => [j.id, j.estado]))
      const r = await api('/api/imagem/tarefas'); IMG.tarefas = r.tarefas
      for (const j of r.tarefas.filter(j => ES?.jobs.includes(j.id) && antes[j.id] === 'rodando' && j.estado !== 'rodando')) {
        if (j.estado === 'pronto') { Som.liga(); pill('Pronto', 'As imagens já estão na biblioteca.', 'var(--green)') } else { Som.erro(); pill('Não deu certo', (j.itens.find(i => i.erro) || {}).erro || '', 'var(--red)') }
        if (atual?.dataset.scene === 'biblioteca') carregarBiblioteca(); else api('/api/midia').then(x => (BIB = x.itens)).catch(() => {})
      }
      if ($('#estudio').open) desenharResultados()
      if (r.tarefas.some(j => j.estado === 'rodando')) acompanharEs()
    } catch { acompanharEs() }
  }, DEMO ? 700 : 2000)
}
function desenharResultados() {
  const jobs = (IMG?.tarefas || []).filter(j => ES?.jobs.includes(j.id))
  $('[data-es-res]').innerHTML = jobs.length ? jobs.map(j => `<div class="es-job"><header><span class="${j.estado === 'rodando' ? 'run' : j.estado === 'pronto' ? 'ok' : 'bad'}"><span class="ic"></span></span><b>${OP_TXT[j.op]}${j.prompt ? ` · ${esc(j.prompt.slice(0, 50))}${j.prompt.length > 50 ? '…' : ''}` : ''}</b></header>
      <div class="es-tiles">${j.itens.map(i => i.estado === 'rodando' ? '<div class="es-tile carregando"><span class="spin"></span></div>'
        : i.estado === 'falhou' ? `<div class="es-tile erro"><small>${esc(i.erro || 'falhou')}</small></div>`
        : (i.arquivos || []).filter(a => !ES.descartados.has(a)).map(a => `<div class="es-tile"><img src="${arquivo(a)}" alt=""><div class="es-tile-a"><button class="btn sm accent" data-es-usar="${esc(a)}">${ES.contexto === 'editor' ? 'Usar no post' : 'Usar em post'}</button><button class="ic-btn" data-es-mais="${esc(a)}" title="Melhorar esta imagem">↑</button><button class="ic-btn" data-es-fora="${esc(a)}" title="Descartar (vai para a lixeira)">×</button></div></div>`).join('')).join('')}</div></div>`).join('')
    : `<div class="es-vazio">${wire(ES?.op === 'gerar' ? 'imagem' : 'gif')}<p>${ES?.op === 'gerar' ? 'As versões aparecem aqui. Cada uma vai direto para a biblioteca, com o prompt guardado.' : 'O resultado aparece aqui e vai para a biblioteca, ligado à imagem original.'}</p></div>`
}
const atualizaEs = () => { desenharEstudio(); estimarEs() }
$('[data-es-op]').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; ES.op = b.dataset.v; Som.tique(); atualizaEs() })
$('[data-es-form]').addEventListener('click', e => {
  const c = e.target.closest('[data-es-chip]'); if (c) { ES.p[c.dataset.esChip] = c.dataset.esChip === 'versoes' ? +c.dataset.v : c.dataset.v; Som.tique(); return atualizaEs() }
  const o = e.target.closest('[data-es-orig]'); if (o) { ES.origem = BIB.find(m => m.arquivo === o.dataset.esOrig); return atualizaEs() }
  if (e.target.closest('[data-es-trocar]')) { ES.origem = null; return atualizaEs() }
})
$('[data-es-form]').addEventListener('input', e => {
  const k = e.target.dataset.es; if (!k) return
  ES.p[k] = e.target.value
  const v = $(`[data-es-v="${k}"]`); if (v) v.textContent = e.target.value
  if (k === 'prompt') { const ir = $('[data-es-ir]'); ir.disabled = !(prov().temChave && ES.p.prompt.trim().length > 2) }
  estimarEs()
})
$('[data-es-form]').addEventListener('change', e => { if (e.target.matches('select')) { ES.p[e.target.dataset.es] = e.target.value; estimarEs() } if (e.target.matches('[data-es-marca]')) { ES.p.usarMarca = e.target.checked; Som.tique() } })
$('[data-es-ir]').addEventListener('click', irEs)
$('[data-es-res]').addEventListener('click', async e => {
  const usar = e.target.closest('[data-es-usar]'), mais = e.target.closest('[data-es-mais]'), fora = e.target.closest('[data-es-fora]')
  if (usar) {
    const m = { arquivo: usar.dataset.esUsar, alt: '', tipo: 'imagem', nome: usar.dataset.esUsar.split('/').pop() }
    if (ES.contexto === 'editor' && ED) { ED.midias.push(m); edMudou(); Som.liga(); return pill('Imagem no post', 'Escreva o texto alternativo no editor.', 'var(--green)') }
    $('#estudio').close(); return abrirEditor({ midias: [m] })
  }
  if (mais) { try { BIB = (await api('/api/midia')).itens } catch { } ES.origem = BIB.find(m => m.arquivo === mais.dataset.esMais) || { arquivo: mais.dataset.esMais }; ES.op = 'melhorar'; Som.tique(); return atualizaEs() }
  if (fora) { try { await api('/api/midia/excluir', { arquivo: fora.dataset.esFora }); ES.descartados.add(fora.dataset.esFora); Som.desliga(); desenharResultados(); if (atual?.dataset.scene === 'biblioteca') carregarBiblioteca() } catch (err) { falha(err) } }
})

// Ajustes → Imagens com IA
async function carregarImgAjustes() {
  try { IMG = await api('/api/imagem') } catch { return }
  const p = prov(), u = IMG.uso
  $('[data-img-ic]').style.setProperty('--c', p.temChave ? 'var(--green)' : 'var(--faint)')
  $('[data-img-st]').textContent = p.temChave ? 'Chave conferida e guardada no cofre.' : 'Sem chave: crie uma no site do Magnific e cole abaixo.'
  $('[data-img-a]').innerHTML = p.temChave ? '<button class="link soft" type="button" data-img-remover>Remover a chave</button>' : ''
  $('[data-img-criar]').href = p.chaveUrl
  $('[data-form=img-chave] input').placeholder = p.temChave ? 'salva (cole outra para trocar)' : 'cole a chave aqui'
  const f = $('[data-form=img-config]'); if (document.activeElement !== f.limiteMensal) f.limiteMensal.value = u.limiteMensal; if (document.activeElement !== f.orcamentoMensal) f.orcamentoMensal.value = u.orcamentoMensal
  $('[data-img-uso]').textContent = `Este mês: ${u.operacoes} ${u.operacoes === 1 ? 'operação' : 'operações'}, ~${euro(u.gasto)} estimados${u.semPreco ? ` (+${u.semPreco} sem preço publicado)` : ''}.`
  $('[data-img-nota]').textContent = p.nota
}
$('[data-img-ajustes]').addEventListener('click', async e => {
  if (!e.target.closest('[data-img-remover]')) return
  if (!(await confirmar('Remover a chave do Magnific?', 'O Farol para de conseguir gerar e melhorar imagens até você salvar outra.', 'Remover'))) return
  try { await api('/api/imagem/chave', { provedor: prov().id, chave: '' }); Som.desliga(); pill('Chave removida', '', 'var(--amber)'); carregarImgAjustes() } catch (err) { falha(err) }
})

// ---------------------------------------------------------------- perfil (quem publica, público, tom, pilares, marca)
let PF = null, PF_INFO = null, pfSujo = false, pfAnT = null
const OBJETIVOS = ['Conseguir clientes', 'Conseguir uma vaga', 'Ser referência na área', 'Fazer rede', 'Divulgar um produto']
const TONS = ['Simpático', 'Direto', 'Técnico', 'Inspirador', 'Bem-humorado']
const COR_ROT = { principal: 'Principal', secundaria: 'Secundária', acento: 'Acento', fundo: 'Fundo', texto: 'Texto' }
const COR_PADRAO = { principal: '#9246f9', secundaria: '#26eda0', acento: '#ffb547', fundo: '#1a1230', texto: '#f6f2ff' }
const caminhoPf = (o, k) => k.split('.').reduce((a, x) => a?.[x], o)
const definePf = (o, k, v) => { const ps = k.split('.'), u = ps.pop(); ps.reduce((a, x) => (a[x] ??= {}), o)[u] = v }
// contraste (WCAG): 4,5 para texto comum, 3 para títulos grandes e elementos gráficos
const lumH = h => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contraste = (a, b) => { const [x, y] = [lumH(a), lumH(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const corOk = h => /^#[0-9a-f]{6}$/i.test(h || '')
async function carregarPerfil(id) {
  try { PF_INFO = await api('/api/perfil' + (id ? '?id=' + encodeURIComponent(id) : '')) } catch (e) { return falha(e) }
  PF = JSON.parse(JSON.stringify(PF_INFO.perfil)); pfSujo = false
  if (!BIB.length) { try { BIB = (await api('/api/midia')).itens } catch { } }
  desenharPerfil()
  if (PF_INFO.analise?.estado === 'rodando' && PF_INFO.analise.id === PF.id) acompanharAnalise()
}
function desenharPerfil() {
  if (!PF) return
  $('[data-pf-sel]').innerHTML = PF_INFO.perfis.map(p => `<option value="${esc(p.id)}"${p.id === PF.id ? ' selected' : ''}>${esc(p.nome)}${p.id === PF_INFO.ativo ? ' (em uso)' : ''}</option>`).join('')
  $('[data-pf-sel]').hidden = PF_INFO.perfis.length < 2
  const conta = PF_INFO.perfis.find(p => p.id === PF.id)?.conta
  $('[data-pf-conta]').textContent = conta ? `LinkedIn: ${conta}` : PF.id === 'principal' ? 'sem conta ligada' : ''
  for (const el of $$('[data-pf]')) { if (document.activeElement === el) continue; const v = caminhoPf(PF, el.dataset.pf); el.value = Array.isArray(v) ? v.join(', ') : v || '' }
  for (const [k, ops] of [['objetivo', OBJETIVOS], ['tom', TONS]]) $(`[data-pf-chips="${k}"]`).innerHTML = ops.map(o => `<button type="button" data-v="${esc(o)}" class="${(PF[k] || '').split(/,\s*/).includes(o) ? 'on' : ''}">${o}</button>`).join('')
  const c = PF.marca.cores
  $('[data-pf-cores]').innerHTML = Object.keys(COR_ROT).map(k => `<label class="pf-cor"><input type="color" data-pf-cor="${k}" value="${corOk(c[k]) ? c[k] : COR_PADRAO[k]}"${corOk(c[k]) ? '' : ' class="vazia"'}><span><b>${COR_ROT[k]}</b><input data-pf-hex="${k}" value="${esc(c[k] || '')}" maxlength="7" placeholder="—" spellcheck="false"></span></label>`).join('')
  const imgs = BIB.filter(m => ['imagem', 'gif'].includes(m.tipo)).slice(0, 24)
  $('[data-pf-refs]').innerHTML = imgs.length ? imgs.map(m => { const i = PF.marca.referencias.indexOf(m.arquivo); return `<button type="button" data-pf-ref="${esc(m.arquivo)}" class="${i >= 0 ? 'on' : ''}" title="${esc(m.nome)}"><img src="${arquivo(m.arquivo)}" alt="">${i >= 0 ? `<span class="pk-n">${i + 1}</span>` : ''}</button>` }).join('') : '<span class="soft">Envie imagens na Biblioteca para usar como referência.</span>'
  for (const el of $$('[data-pf-chk]')) el.checked = !!PF.marca[el.dataset.pfChk]
  desenharPilares(); desenharAnalise(); desenharPrevia()
  $('[data-pf-salvo]').textContent = pfSujo ? 'Mudanças não salvas' : PF.atualizado ? `Salvo ${new Date(PF.atualizado).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''
}
function pfMudou() { pfSujo = true; $('[data-pf-salvo]').textContent = 'Mudanças não salvas'; desenharPrevia() }
function desenharPrevia() {
  const c = { ...COR_PADRAO, ...Object.fromEntries(Object.entries(PF.marca.cores).filter(([, v]) => corOk(v))) }, f = PF.marca.fontes
  const checks = [['Texto sobre o fundo', contraste(c.texto, c.fundo), 4.5], ['Principal sobre o fundo', contraste(c.principal, c.fundo), 3], ['Secundária sobre o fundo', contraste(c.secundaria, c.fundo), 3]]
  const definidas = Object.values(PF.marca.cores).filter(corOk).length
  $('[data-pf-prev]').innerHTML = `<div class="fp-label"><span>Prévia da marca</span><span>${definidas ? `${definidas} de 5 cores` : 'cores padrão'}</span></div>
    <div class="pf-peca" style="--f:${c.fundo};--t:${c.texto};--p:${c.principal};--s:${c.secundaria};--a:${c.acento};--ft:'${esc(f.titulo || 'Space Grotesk')}';--fx:'${esc(f.texto || 'IBM Plex Sans')}'">
      <small>${esc((PF.area || 'sua área').toUpperCase().slice(0, 40))}</small>
      <b>${esc(PF.pilares[0]?.tema || 'Um título de post com a sua cara')}</b>
      <p>${esc(PF.publico ? `Para ${PF.publico}` : 'Texto de apoio no tom que você escolheu.').slice(0, 110)}</p>
      <span class="pf-chips"><i>${esc(PF.temas[0] || 'tema')}</i><i>${esc(PF.temas[1] || 'outro tema')}</i></span>
      <span class="pf-btn">Saiba mais</span>
    </div>
    <ul class="pf-checks">${checks.map(([t, r, min]) => `<li class="${r >= min ? 'ok' : 'warn'}"><span class="ic"></span>${t}: ${r.toFixed(1).replace('.', ',')}:1 ${r >= min ? '' : `<small>(o mínimo é ${String(min).replace('.', ',')}:1)</small>`}</li>`).join('')}</ul>
    <div class="pf-usa"><b>Como o Farol usa isto</b><ul>
      <li>A sua IA lê o perfil antes de escrever cada post (tom, público, temas e pilares).</li>
      <li>${PF.marca.usarNoEstudio ? 'O Estúdio de imagens usa as cores, o estilo e a primeira referência.' : 'O Estúdio de imagens não usa a marca (desligado).'}</li>
      <li>${PF.marca.aplicarNoMotor ? 'As peças das rotinas saem com as suas cores e fontes.' : 'As peças das rotinas continuam com o design system atual.'}</li></ul></div>`
}
function desenharPilares() {
  $('[data-pf-pilares]').innerHTML = PF.pilares.length ? PF.pilares.map((p, k) => `<div class="pf-pilar" data-k="${k}">
      <div class="fields two"><label><span>Tema</span><input data-pl="tema" value="${esc(p.tema)}" maxlength="80"></label><label><span>Por que importa</span><input data-pl="por_que" value="${esc(p.por_que || '')}" maxlength="300"></label>
      <label class="full"><span>Ideias de post <small>uma por linha</small></span><textarea data-pl="ideias" rows="3">${esc((p.ideias || []).join('\n'))}</textarea></label></div>
      <div class="pf-ideias">${(p.ideias || []).map((i, n) => `<button class="pf-ideia" type="button" data-ideia="${k}:${n}" aria-label="Abrir no editor: ${esc(i)}">${esc(i)} <span aria-hidden="true">→</span></button>`).join('')}</div>
      <button class="link soft" type="button" data-pl-tirar="${k}">Tirar este pilar</button></div>`).join('')
    : '<p class="soft">Ainda sem pilares. Peça a análise com a IA ou adicione um à mão: 3 a 5 assuntos em que você quer ser lembrado.</p>'
}
function desenharAnalise() {
  const a = PF_INFO.analise?.id === PF.id && PF_INFO.analise.estado === 'rodando' ? null : PF.analise, rodando = PF_INFO.analise?.estado === 'rodando' && PF_INFO.analise.id === PF.id
  $('[data-pf-analisar]').disabled = rodando
  $('[data-pf-an-nota]').hidden = !!a || rodando
  if (rodando) { $('[data-pf-analise]').innerHTML = `<div class="steps glass"><li class="run"><span class="ic"></span><span><b>A ${esc(PF_INFO.agente || 'sua IA')} está lendo o seu perfil e os seus links</b><small>Leva de 30 segundos a alguns minutos.</small></span></li></div>`; return }
  if (PF_INFO.analise?.estado === 'falhou' && PF_INFO.analise.id === PF.id) { $('[data-pf-analise]').innerHTML = `<p class="ed-erro">${esc(PF_INFO.analise.erro || 'A análise não deu certo.')}</p>`; return }
  if (!a) { $('[data-pf-analise]').innerHTML = ''; return }
  const linha = (k, rot, v) => v && (!Array.isArray(v) || v.length) ? `<div class="pf-sug"><span><small>${rot}</small><b>${esc(Array.isArray(v) ? v.join(', ') : v)}</b></span><button class="link" type="button" data-aplicar="${k}">Aplicar</button></div>` : ''
  const cores = Object.entries(a.cores || {}).filter(([, v]) => corOk(v))
  $('[data-pf-analise]').innerHTML = `${a.resumo ? `<p class="pf-resumo">${esc(a.resumo)}</p>` : ''}
    ${linha('area', 'Área de atuação', a.area)}${linha('publico', 'Público', a.publico)}${linha('objetivo', 'Objetivo', a.objetivo)}${linha('tom', 'Tom de voz', a.tom)}${linha('temas', 'Temas', a.temas)}${linha('estilo', 'Estilo visual', a.estilo_visual)}
    ${cores.length ? `<div class="pf-sug"><span><small>Cores do site</small><b class="pf-sw">${cores.map(([k, v]) => `<i style="background:${v}" title="${COR_ROT[k] || k} ${v}"></i>`).join('')}</b></span><button class="link" type="button" data-aplicar="cores">Aplicar</button></div>` : ''}
    ${(a.pilares || []).length ? `<div class="pf-sug"><span><small>Pilares sugeridos</small><b>${a.pilares.map(p => esc(p.tema)).join(' · ')}</b></span><button class="link" type="button" data-aplicar="pilares">Adicionar</button></div>` : ''}
    ${(a.observacoes || []).filter(Boolean).length ? `<ul class="pf-obs">${a.observacoes.filter(Boolean).map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
    <div class="cta small"><button class="btn sm" type="button" data-aplicar="tudo">Aplicar tudo</button><small class="soft">análise do ${esc(a.agente ? (({ claude: 'Claude', codex: 'ChatGPT', gemini: 'Gemini' })[a.agente] || a.agente) : 'agente')} em ${a.quando ? new Date(a.quando).toLocaleDateString('pt-BR') : ''}</small></div>`
}
function aplicarSugestao(k) {
  const a = PF.analise; if (!a) return
  const um = k => {
    if (['area', 'publico', 'objetivo', 'tom'].includes(k) && a[k]) PF[k] = a[k]
    if (k === 'temas' && a.temas?.length) PF.temas = a.temas.filter(Boolean)
    if (k === 'estilo' && a.estilo_visual) PF.marca.estilo = a.estilo_visual
    if (k === 'cores') for (const [c, v] of Object.entries(a.cores || {})) if (corOk(v) && c in PF.marca.cores) PF.marca.cores[c] = v
    if (k === 'cores' && a.fontes) { if (a.fontes.titulo) PF.marca.fontes.titulo = a.fontes.titulo; if (a.fontes.texto) PF.marca.fontes.texto = a.fontes.texto }
    if (k === 'pilares') for (const p of a.pilares || []) if (p.tema && !PF.pilares.some(x => x.tema.toLowerCase() === p.tema.toLowerCase())) PF.pilares.push({ tema: p.tema, por_que: p.por_que || '', ideias: (p.ideias || []).filter(Boolean) })
  }
  k === 'tudo' ? ['area', 'publico', 'objetivo', 'tom', 'temas', 'estilo', 'cores', 'pilares'].forEach(um) : um(k)
  pfSujo = true; Som.tique(); desenharPerfil(); pill('Aplicado', 'Confira e salve o perfil.', 'var(--green)')
}
async function salvarPerfil({ quieto = false } = {}) {
  if (!PF) return
  try { const r = await api('/api/perfil/salvar', { id: PF.id, perfil: PF }); PF = r; PF_INFO.perfil = r; pfSujo = false; if (!quieto) { Som.liga(); pill('Perfil salvo', 'A sua IA já usa no próximo post.', 'var(--green)') } desenharPerfil() } catch (e) { falha(e) }
}
async function analisarPerfil() {
  if (pfSujo) await salvarPerfil({ quieto: true })
  try { await api('/api/perfil/analisar', { id: PF.id, sobre: PF.sobre }); PF_INFO.analise = { id: PF.id, estado: 'rodando' }; humor('work'); Som.tique(); desenharAnalise(); acompanharAnalise() } catch (e) { falha(e) }
}
function acompanharAnalise() {
  clearTimeout(pfAnT)
  pfAnT = setTimeout(async () => {
    let a; try { a = await api('/api/perfil/analise') } catch { return acompanharAnalise() }
    PF_INFO.analise = a
    if (a.estado === 'rodando') { if (atual?.dataset.scene === 'perfil') desenharAnalise(); return acompanharAnalise() }
    if (a.estado === 'pronto') { Som.liga(); pill('Análise pronta', 'Veja as sugestões e aplique o que fizer sentido.', 'var(--green)'); if (PF && a.id === PF.id) { PF.analise = { ...a.resultado, agente: a.agente, quando: new Date().toISOString() } } }
    else { Som.erro(); pill('A análise não deu certo', a.erro || '', 'var(--red)') }
    atualizarHumor(); if (atual?.dataset.scene === 'perfil') desenharPerfil()
  }, DEMO ? 800 : 3000)
}
// eventos da tela
$('[data-scene=perfil]').addEventListener('input', e => {
  const t = e.target
  if (t.dataset.pf) { const k = t.dataset.pf; definePf(PF, k, ['temas', 'evitar'].includes(k) ? t.value.split(',').map(s => s.trim()).filter(Boolean) : t.value); return pfMudou() }
  if (t.dataset.pfCor) { PF.marca.cores[t.dataset.pfCor] = t.value; const h = $(`[data-pf-hex="${t.dataset.pfCor}"]`); h.value = t.value; t.classList.remove('vazia'); return pfMudou() }
  if (t.dataset.pfHex) { const v = t.value.trim().toLowerCase(); if (corOk(v) || v === '') { PF.marca.cores[t.dataset.pfHex] = v; if (v) $(`[data-pf-cor="${t.dataset.pfHex}"]`).value = v; pfMudou() } return }
  const pl = t.closest('.pf-pilar'); if (pl && t.dataset.pl) { const p = PF.pilares[+pl.dataset.k]; p[t.dataset.pl] = t.dataset.pl === 'ideias' ? t.value.split('\n').map(s => s.trim()).filter(Boolean) : t.value; pfMudou() }
})
$('[data-scene=perfil]').addEventListener('change', e => {
  const t = e.target
  if (t.dataset.pfChk) { PF.marca[t.dataset.pfChk] = t.checked; pfMudou() }
  if (t.matches('[data-pf-sel]')) { (pfSujo ? salvarPerfil({ quieto: true }) : Promise.resolve()).then(() => carregarPerfil(t.value)) }
  if (t.closest('.pf-pilar') && t.dataset.pl === 'ideias') desenharPilares()
})
$('[data-scene=perfil]').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return
  if (t.closest('[data-pf-chips]')) { const k = t.closest('[data-pf-chips]').dataset.pfChips, v = t.dataset.v, atual_ = (PF[k] || '').split(/,\s*/).filter(Boolean); PF[k] = (atual_.includes(v) ? atual_.filter(x => x !== v) : [...atual_, v]).join(', '); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.dataset.pfRef) { const r = PF.marca.referencias, i = r.indexOf(t.dataset.pfRef); i >= 0 ? r.splice(i, 1) : r.length < 3 ? r.push(t.dataset.pfRef) : pill('Até 3 referências', 'Tire uma antes de escolher outra.', 'var(--amber)'); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.matches('[data-pf-pilar-add]')) { PF.pilares.push({ tema: '', por_que: '', ideias: [] }); pfMudou(); desenharPilares(); return $$('.pf-pilar [data-pl=tema]').pop()?.focus() }
  if (t.dataset.plTirar != null) { PF.pilares.splice(+t.dataset.plTirar, 1); pfMudou(); return desenharPilares() }
  if (t.dataset.ideia) { const [k, n] = t.dataset.ideia.split(':').map(Number), ideia = PF.pilares[k].ideias[n]; return abrirEditor({ titulo: ideia.slice(0, 80), legenda: '' , dica: `Ideia do pilar "${PF.pilares[k].tema}": ${ideia}` }) }
  if (t.dataset.aplicar) return aplicarSugestao(t.dataset.aplicar)
  if (t.matches('[data-pf-analisar]')) return analisarPerfil()
  if (t.matches('[data-pf-salvar]')) return salvarPerfil()
})

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
  if (t.matches('[data-novo-post]')) return abrirEditor({})
  if (t.matches('[data-gerar-img]')) return abrirEstudio({ op: 'gerar' })
  if (t.matches('[data-es-ajustes]')) { $('#estudio').close(); voltarPara = null; return cena('ajustes') }
  if (t.matches('[data-ed]')) {
    const q = t.dataset.ed
    if (q === 'salvar') return salvarEd()
    if (q === 'enviar') return salvarEd({ enviar: true })
    if (q === 'biblioteca') return abrirPicker()
    if (q === 'gerar') return abrirEstudio({ op: 'gerar', contexto: 'editor', prompt: (ED?.legenda || '').split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).slice(0, 2).join(' ').slice(0, 300) })
    if (q === 'descartar') {
      if (ED?.sujo && !(await confirmar('Descartar as mudanças?', ED.id ? 'O post volta a ser como estava da última vez que foi salvo.' : 'O que você escreveu aqui não será salvo.', 'Descartar'))) return
      ED = null; const v = voltarPara || 'fila'; voltarPara = null; return cena(v)
    }
    return
  }
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
// a chave é conferida com o Magnific (sem gastar créditos) antes de ir para o cofre; o campo é limpo em seguida
form('[data-form=img-chave]', async f => { if (!f.chave.value.trim()) return pill('Cole a chave antes', '', 'var(--amber)'); pill('Conferindo a chave…', '', 'var(--violet)'); try { await api('/api/imagem/chave', { provedor: 'magnific', chave: f.chave.value }) } finally { f.chave.value = '' } pill('Chave conferida e salva', 'Fica só no cofre deste computador.', 'var(--green)'); carregarImgAjustes() })
form('[data-form=img-config]', async f => { await api('/api/imagem/config', { limiteMensal: f.limiteMensal.value, orcamentoMensal: f.orcamentoMensal.value }); pill('Limites salvos', '', 'var(--green)'); carregarImgAjustes() })

// ---------------------------------------------------------------- teclado (Enter avança; Esc volta; A, P, ← e → na fila)
const lit = (k, on) => $$(`kbd[data-k="${k}"]`).forEach(x => x.classList.toggle('lit', on))
// Ctrl+S salva o rascunho no editor (vale também com o cursor no texto)
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ['editor', 'perfil'].includes(atual?.dataset.scene)) { e.preventDefault(); atual.dataset.scene === 'editor' ? salvarEd() : salvarPerfil() } })
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
