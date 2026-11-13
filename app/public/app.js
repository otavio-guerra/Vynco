'use strict'
// Vynco: entrada em cenas (LinkedIn → você → IA → sincronização → estratégia) + fila, rotinas e ajustes.
// Fala com app/server.js (toda chamada leva o token desta sessão). Sem o servidor, roda em demonstração.
const TOKEN = document.querySelector('meta[name=engine-token]').content
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
// link de fora (IA, web, LinkedIn): só http(s); qualquer outra coisa vira um link vazio
const urlOk = u => /^https?:\/\/[^\s"<>]+$/i.test(String(u || '')) ? u : '#'
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const store = { get: (k, d) => { try { return localStorage.getItem('vynco.' + k) ?? d } catch { return d } }, set: (k, v) => { try { localStorage.setItem('vynco.' + k, v) } catch {} } }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const espera = ms => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- marcas (desenhos simples, só para reconhecer o serviço)
const GLIFO = {
  magnific: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="10" fill="#000"/><path d="M27.6 11 24 19.97 20.4 11h-7.2L6 37h9l9-11.66L33 37h9l-7.2-26h-7.2Z" fill="#fff"/></svg>',
  antigravity: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19 12 4l8 15" fill="none" stroke="#3B82F6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="15" r="2.2" fill="#7FFFD4"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.6 4.77 6v5.46h-4v-4.84c0-1.16-.02-2.64-1.6-2.64-1.62 0-1.86 1.25-1.86 2.55v4.93h-4z"/></svg>',
  claude: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#D97757" stroke-width="2.3" stroke-linecap="round">' + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => { const r = a * Math.PI / 180, l = i % 2 ? 6.5 : 9; return `<line x1="${(12 + Math.cos(r) * 2.2).toFixed(2)}" y1="${(12 + Math.sin(r) * 2.2).toFixed(2)}" x2="${(12 + Math.cos(r) * l).toFixed(2)}" y2="${(12 + Math.sin(r) * l).toFixed(2)}"/>` }).join('') + '</g></svg>',
  codex: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8">' + [0, 60, 120].map(a => `<ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
}
// cada Gemini tem o seu degradê (um id repetido some quando o primeiro desenho está escondido)
let gid = 0
const gemini = () => { const g = 'gg' + (++gid); return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8ef7"/><stop offset=".55" stop-color="#9b72f2"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs><path fill="url(#${g})" d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10Z"/></svg>` }
const glifo = (id, cor) => id === 'gemini' ? gemini() : GLIFO[id] ||`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${cor || 'var(--violet)'}" opacity=".22"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="${cor || 'var(--violet)'}" font-family="Segoe UI, sans-serif">${esc((id || '?')[0].toUpperCase())}</text></svg>`

// ---------------------------------------------------------------- wireframes dos formatos de post (nenhum post real nos exemplos)
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
const svgDemo = cor => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><radialGradient id="c" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="${cor}" stop-opacity=".55"/><stop offset="1" stop-color="#0e1524"/></radialGradient></defs><rect width="400" height="500" fill="url(#c)"/><path d="M0 380 120 300l80 50 90-70 110 90v130H0z" fill="${cor}" opacity=".45"/><path d="M186 170h28l10 120h-48z" fill="#eef1f8"/><circle cx="200" cy="155" r="14" fill="#ffb547"/><path d="M200 155 400 110v90z" fill="#ffb547" opacity=".22"/></svg>`)
const D = DEMO && (() => {
  const ja = store.get('onboarded') === '1' || ['inicio', 'fila', 'rotinas', 'ajustes', 'calendario', 'rede', 'conexoes', 'vagas', 'biblioteca', 'perfil'].includes(new URLSearchParams(location.search).get('tela'))
  return {
    linkedin: { proprio: false, connected: ja, name: ja ? 'Seu Nome' : null, expiresAt: Date.now() + 59 * 864e5, via: 'vynco', redirectUri: 'http://localhost:8765/callback' },
    agentes: { claude: { instalado: true, conectado: false }, codex: { instalado: false, conectado: false }, antigravity: { instalado: false, conectado: false }, gemini: { instalado: false, conectado: false }, copilot: {}, qwen: {}, opencode: {} },
    escolhido: ja ? 'claude' : null, sincronizado: ja,
    lista: [['claude', 'Claude', 'Claude Code', '#D97757'], ['codex', 'ChatGPT', 'Codex', '#10A37F'], ['antigravity', 'Antigravity', 'Antigravity CLI', '#3B82F6'], ['gemini', 'Gemini', 'Gemini CLI', '#4285F4'], ['copilot', 'GitHub Copilot', 'Copilot CLI', '#8957E5', 1], ['qwen', 'Qwen Code', 'Qwen Code', '#615CED', 1], ['opencode', 'OpenCode', 'OpenCode', '#9BA7BF', 1]].map(([id, nome, via, cor, beta]) => ({ id, nome, via, cor, beta: !!beta })),
    jobs: {}, sync: null, posts: {}, rotinas: { dicas: { ativo: true, dias: [2], hora: '08:00' }, pergunta: { ativo: true, dias: [5], hora: '09:00' } }, tarefas: [], ops: 0, gasto: 0, analise: null, rede: { conexoes: [], seguir: [], vagas: [], prefs: {} }, redeEstado: null,
    perfil: { id: 'principal', nome: 'Seu Nome', area: ja ? 'Design de produto' : '', publico: '', objetivo: '', tom: '', temas: [], evitar: [], links: { site: '', portfolio: '' }, sobre: '', pilares: [], marca: { cores: { principal: '', secundaria: '', acento: '', fundo: '', texto: '' }, fontes: { titulo: '', texto: '' }, estilo: '', referencias: [], aplicarNoMotor: false, usarNoEstudio: true }, analise: null, atualizado: null },
    // biblioteca de exemplo: imagens desenhadas aqui mesmo (wireframes), nenhuma peça real
    midia: [['#4cc2ff', 'tela-de-login.png', 'envio', 'Tela de login com campos de e-mail e senha.'], ['#8b7cff', 'antes.png', 'envio', ''], ['#3ddc84', 'depois.png', 'envio', ''], ['#ffb547', 'daily-ui-003.png', 'dailyui', '']].map(([cor, nome, origem, alt], k) => ({
      arquivo: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#16203a"/><rect x="40" y="40" width="320" height="260" rx="18" fill="${cor}" opacity=".22"/><circle cx="112" cy="112" r="30" fill="${cor}"/><path d="M40 280 150 175l70 60 50-40 90 80v5H40z" fill="${cor}" opacity=".6"/><rect x="40" y="340" width="230" height="22" rx="11" fill="#fff" opacity=".35"/><rect x="40" y="380" width="300" height="16" rx="8" fill="#fff" opacity=".18"/><rect x="40" y="410" width="200" height="16" rx="8" fill="#fff" opacity=".18"/></svg>`),
      nome, tipo: 'imagem', bytes: 180000 + k * 41000, largura: 1080, altura: 1350, criado: Date.now() - k * 36e5, origem, alt, avisos: [], apagavel: origem === 'envio' })).concat([
      { arquivo: 'demo:processo.mp4', nome: 'processo.mp4', tipo: 'video', bytes: 8.4 * 1048576, criado: Date.now() - 9e6, origem: 'envio', alt: '', avisos: [], apagavel: true },
      { arquivo: 'demo:guia.pdf', nome: 'guia-de-estilo.pdf', tipo: 'documento', bytes: 2.1 * 1048576, criado: Date.now() - 2e7, origem: 'envio', alt: '', avisos: [], apagavel: true }]),
    fila: [
      { kind: 'dailyui', id: '003', title: 'Daily UI 003 · Tela de entrada', formato: 'gif', cover: svgDemo('#8b7cff'), hasFile: true, approved: false, published: null, caption: 'Daily UI 003 · Tela de entrada\n\nUm campo por vez, erro que explica o que fazer e foco sempre visível.\n\n- Rótulo fora do campo, para não sumir ao digitar\n- Mensagem de erro perto do erro\n- Botão com o verbo da ação\n\n#dailyui #uidesign #ux' },
      { kind: 'noticias', id: 'hoje-a', title: 'Carrossel A · notícias do dia', formato: 'carrossel', paginas: 7, cover: svgDemo('#4cc2ff'), hasFile: true, approved: false, published: null, caption: 'O assunto do dia em 7 slides: o que aconteceu, o outro lado e o que muda para quem desenha.\n\nFontes checadas no último slide.\n\n#design #ia #tecnologia' },
      { kind: 'avulsos', id: 'processo', title: 'Vídeo · bastidores de um projeto', formato: 'video', hasFile: true, approved: false, published: null, caption: 'Quarenta segundos de processo: do rascunho à tela final.\n\nO que você mudaria?\n\n#processo #design' },
      { kind: 'avulsos', id: 'antes-depois', title: 'Antes e depois · 4 telas', formato: 'multi', arquivos: [svgDemo('#3ddc84'), svgDemo('#ffb547'), svgDemo('#ff7a85'), svgDemo('#4cc2ff')], cover: svgDemo('#3ddc84'), hasFile: true, approved: false, published: null, caption: 'Quatro telas, antes e depois do redesenho.\n\nArraste para o lado e diga qual mudança você notou primeiro.\n\n#uxdesign #redesign' },
      { kind: 'avulsos', id: 'reflexao', title: 'Só texto · uma lição da semana', formato: 'texto', hasFile: true, approved: true, published: null, agendado: new Date(new Date().setHours(33, 0, 0, 0)).toISOString(), caption: 'Uma lição desta semana: mostrar o rascunho cedo economiza três rodadas de ajuste.\n\nO que você aprendeu esta semana?' },
      { kind: 'series', id: '04', title: 'Série 04 · ferramentas', formato: 'imagem', cover: svgDemo('#ffb547'), hasFile: true, approved: true, published: null, agendado: new Date(new Date().setHours(42, 0, 0, 0)).toISOString(), caption: 'As ferramentas que eu abro todo dia, e por quê.\n\n#design #ferramentas' },
      { kind: 'series', id: '03', title: 'Série 03 · apresentação', formato: 'imagem', cover: svgDemo('#ff7a85'), hasFile: true, approved: true, published: { link: 'https://github.com/otavio-guerra/vynco', quando: new Date(Date.now() - 864e5).toISOString() }, caption: 'Quem sou eu, em uma imagem.\n\n#portfolio' },
    ],
  }
})()
const ag = id => D.lista.find(a => a.id === id)
// os mesmos modelos de engine/modelos.js (a demonstração não tem servidor)
const MODELOS_DEMO = [['noticias-da-area', 'Notícias da sua área', 'carrossel', 1, 'semanal', 'O assunto mais quente da semana na sua área, com o que aconteceu, o outro lado e a sua leitura. Fontes checadas.'], ['dicas', 'Dicas práticas', 'carrossel', 0, 'semanal', 'De 5 a 7 dicas curtas e acionáveis sobre um dos seus pilares, uma por slide.'], ['mito-verdade', 'Mito ou verdade', 'carrossel', 0, 'quinzenal', 'Crenças comuns da sua área desmontadas com argumentos simples.'], ['passo-a-passo', 'Passo a passo', 'carrossel', 0, 'quinzenal', 'Como fazer algo que o seu público precisa, em etapas claras.'], ['licao', 'Lição aprendida', 'texto', 0, 'semanal', 'Uma história curta: o que aconteceu, o que você aprendeu e o que faria diferente.'], ['bastidores', 'Bastidores do trabalho', 'texto', 0, 'quinzenal', 'Um processo, uma rotina ou uma ferramenta do seu dia a dia, contado com honestidade.'], ['opiniao', 'Opinião sobre uma tendência', 'texto', 1, 'quinzenal', 'Uma tendência recente da área e o seu ponto de vista, com os dois lados.'], ['pergunta', 'Pergunta para a rede', 'texto', 0, 'semanal', 'Um post curto que termina numa pergunta e puxa conversa nos comentários.'], ['recomendacao', 'Recomendação', 'texto', 0, 'mensal', 'Um livro, curso, ferramenta ou pessoa que ajudou você, e por quê.'], ['daily-ui', 'Daily UI', 'imagem', 0, 'diario', 'A tela do desafio Daily UI do dia, com as decisões de UX numeradas.', 1]]
  .map(([id, titulo, formato, web, freq, desc, design]) => ({ id, titulo, formato, web: !!web, freq, desc, design: !!design, freqTxt: { diario: 'todo dia útil', semanal: 'uma vez por semana', quinzenal: 'a cada 15 dias', mensal: 'uma vez por mês' }[freq] }))
// imagem de exemplo desenhada na hora (wireframe colorido), para a demonstração
const PLANO_DEMO = () => ({ nivel: 'normal', motivo: 'A sua semana está em 61%: carrossel (o mais pesado) cai para 1 por semana e a IA reserva divide o resto.', slots: [[1, 'dicas', 'Dicas práticas', 'carrossel', 'principal'], [3, 'licao', 'Lição aprendida', 'texto', 'reserva'], [5, 'pergunta', 'Pergunta para a rede', 'texto', 'principal']].map(([dia, modelo, titulo, formato, ia]) => ({ dia, modelo, titulo, formato, criar: '07:00', publicar: '12:00', ia })) })
const usoDemo = () => ({ mes: new Date().toISOString().slice(0, 7), operacoes: D.ops, gasto: D.gasto, semPreco: D.tarefas.filter(t => t.op !== 'melhorar').reduce((s, t) => s + t.itens.length, 0), limiteMensal: 30, orcamentoMensal: 10 })
const RECURSOS_DEMO = {
  gerar: { proporcoes: [['social_post_4_5', '4:5 · feed'], ['square_1_1', '1:1'], ['widescreen_16_9', '16:9'], ['social_story_9_16', '9:16 · story']], resolucoes: [['1k', '1K'], ['2k', '2K'], ['4k', '4K']], modelos: [['realism', 'Realismo'], ['fluid', 'Fluido'], ['zen', 'Zen'], ['flexible', 'Flexível'], ['super_real', 'Super real'], ['editorial_portraits', 'Retratos editoriais']], maxVersoes: 4 },
  melhorar: { fatores: ['2x', '4x', '8x', '16x'], maxPixels: 25.3e6, otimizado: [['standard', 'Padrão'], ['art_n_illustration', 'Arte e ilustração'], ['films_n_photography', 'Cinema e fotografia'], ['3d_renders', 'Renders 3D']] },
  refinar: {},
  video: { maxImagem: 10485760, modelos: [
    { id: 'kling', nome: 'Kling 2.6 Pro', dica: 'movimento natural e realista', duracoes: ['5', '10'], proporcoes: [['widescreen_16_9', '16:9'], ['social_story_9_16', '9:16 · story'], ['square_1_1', '1:1']], negativo: true, audio: true },
    { id: 'seedance', nome: 'Seedance 2.0 Pro', dica: 'cenas mais longas, câmera parada ou livre', duracoes: ['5', '10'], resolucoes: [['720p', '720p'], ['1080p', '1080p']], proporcoes: [['widescreen_16_9', '16:9'], ['social_story_9_16', '9:16 · story'], ['square_1_1', '1:1'], ['traditional_3_4', '3:4'], ['classic_4_3', '4:3']], camera: true, audio: true }] },
}
async function apiDemo(path, data) {
  await espera(160)
  const q = new URL(path, 'http://x'), id = q.searchParams.get('id') || (data && data.id)
  const it = data && D.fila.find(i => i.kind === data.kind && i.id === data.id)
  const status = () => ({ reserva: D.reserva || null, standby: D.standby || { disponivel: true, ligado: false }, agente: D.escolhido ? { id: D.escolhido, nome: ag(D.escolhido).nome, via: ag(D.escolhido).via, instalado: true, conectado: true, conta: 'voce@exemplo.com', sincronizado: D.sincronizado ? new Date().toISOString() : null } : null, linkedin: { ...D.linkedin, dias: Math.floor((D.linkedin.expiresAt - Date.now()) / 864e5), contas: D.linkedin.connected ? [{ id: 'demo', nome: D.linkedin.name, expiresAt: D.linkedin.expiresAt, dias: Math.floor((D.linkedin.expiresAt - Date.now()) / 864e5), valida: true, ativa: true }] : [] }, desigma: { mcpOk: true, exeOk: true, registered: D.sincronizado, workspace: 'C:\\Users\\voce\\Documents\\desigma', exe: 'C:\\Programas\\desigma\\desigma.exe', mcpExe: 'C:\\Programas\\desigma\\desigma-mcp.exe', project: '' }, config: { assetsDir: 'examples/assets', dailyUiStart: '2026-11-03' } })
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
    case '/api/sync/cancelar': if (D.sync && !D.sync.fim) { D.sync.cancelado = true; D.sync.passos.filter(p => p.estado === 'espera').forEach(p => (p.estado = 'pulado')); D.sync.fim = Date.now() } return D.sync || {}
    case '/api/sync': {
      if (!data) return D.sync || {}
      const a = ag(id || D.escolhido); if (data.reserva) { D.reserva = { id: a.id, nome: a.nome, via: a.via, conectado: true, sincronizado: new Date().toISOString() } } else D.escolhido = a.id
      const rot = [['conta', `Conferindo a sua conta do ${a.nome}`, 'voce@exemplo.com'], ['instrucoes', 'Ensinando as regras do Vynco', a.id === 'claude' ? 'CLAUDE.md' : a.id === 'gemini' ? 'GEMINI.md' : 'AGENTS.md'], ['skills', 'Instalando 4 skills', 'vynco-daily-ui, vynco-legendas, vynco-marca, vynco-pauta-noticias'], ['prompts', 'Copiando 2 prompts das rotinas', '/vynco-daily-ui, /vynco-pauta-noticias'], ['plugins', 'Ligando o Desigma (plugin MCP)', 'desigma'], ['trava', 'Travando a publicação para o agente', `O ${a.nome} não pode rodar o script de publicação.`], ['teste', `Testando uma resposta do ${a.nome}`, 'respondeu "ok"']]
      const S = D.sync = { agente: a.id, nome: a.nome, passos: rot.map(([pid, rotulo]) => ({ id: pid, rotulo, estado: 'espera', detalhe: '' })), fim: null, ok: false, resumo: { skills: 4, prompts: 2, plugins: 1 } }
      ;(async () => { for (let i = 0; i < rot.length; i++) { if (S.cancelado) return; S.passos[i].estado = 'rodando'; await espera(i === 6 ? 1400 : 650); Object.assign(S.passos[i], { estado: 'ok', detalhe: rot[i][2] }) } S.ok = true; S.fim = Date.now(); D.sincronizado = true })()
      return S
    }
    case '/api/linkedin/connect': D.liTimer = setTimeout(() => Object.assign(D.linkedin, { connected: true, name: 'Seu Nome', expiresAt: Date.now() + 60 * 864e5 }), 2400); return { ok: true, modo: 'ponte', msg: 'Demonstração: o login é simulado.' }
    case '/api/linkedin/cancelar': clearTimeout(D.liTimer); return { ok: true }
    case '/api/linkedin/disconnect': Object.assign(D.linkedin, { connected: false, name: null }); return { ok: true }
    case '/api/limites': return { imagem: { nome: 'Magnific', temChave: true, site: 'https://www.magnific.com', operacoes: D.ops, gasto: D.gasto, limiteMensal: 30, orcamentoMensal: 10 }, principal: { id: 'claude', nome: 'Claude', medidor: true, janelas: [{ rotulo: 'Sessão (5 horas)', pct: 34, renova: new Date(Date.now() + 2.2 * 36e5).toISOString() }, { rotulo: 'Semana', pct: 61, renova: new Date(Date.now() + 3.4 * 864e5).toISOString() }] }, reserva: D.reserva ? { id: 'antigravity', nome: 'Antigravity', medidor: false, nota: 'Conta Google gratuita: uma cota semanal (o Google não publica o número).' } : null }
    case '/api/agente/reserva': D.reserva = data.id ? { id: data.id, nome: ag(data.id).nome, via: ag(data.id).via, conectado: true, sincronizado: null } : null; return { ok: true, instalado: true, conectado: true }
    case '/api/automatico': if (data) { D.auto = !!data.ativo; D.autoDui = !!data.dailyUi } return { ativo: !!D.auto, dailyUi: !!D.autoDui, veto: 2, design: true, temReserva: !!D.reserva, aplicado: D.auto ? PLANO_DEMO() : null, plano: PLANO_DEMO() }
    case '/api/standby': D.standby = { disponivel: true, ligado: !!data.ligar }; return D.standby
    case '/api/queue': return D.fila
    case '/api/runs': return { agente: D.escolhido ? ag(D.escolhido).nome : null, perfil: { area: D.perfil.area }, avisos: [], runs: [], rotinas: MODELOS_DEMO.filter(m => !m.design || /design|ux|ui/i.test(D.perfil.area)).map(m => ({ ...m, agenda: D.rotinas[m.id] || null })) }
    case '/api/agendar': { const k = `${data.kind}:${data.id}`, x = D.fila.find(i => `${i.kind}:${i.id}` === k); if (x) x.agendado = data.quando || null; return { ok: true } }
    case '/api/rotinas/agendar': D.rotinas[data.id] = { ativo: !!data.ativo, dias: data.dias, hora: data.hora }; return { ok: true }
    case '/api/runs-antigo': return { agente: D.escolhido ? ag(D.escolhido).nome : null, rotinas: [{ id: 'daily-ui', titulo: 'Gerar o Daily UI de hoje', agendar: 'schtasks /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:00 /TN "Vynco - Gerar o Daily UI de hoje" /TR "..."' }, { id: 'pauta-noticias', titulo: 'Montar os carrosséis de notícias', agendar: 'schtasks /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:00 /TN "Vynco - Montar os carrosséis de notícias" /TR "..."' }], runs: [] }
    case '/api/approve': it.approved = true; return { ok: true }
    case '/api/unapprove': it.approved = false; return { ok: true }
    case '/api/publish': it.published = { link: 'https://github.com/otavio-guerra/vynco', quando: new Date().toISOString() }; return { ok: true }
    case '/api/run': throw new Error('Na demonstração as rotinas não rodam. Baixe o Vynco para usar de verdade.')
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
    // pedidos à IA simulados: o "entender" lê o texto com regras simples, sem chamar IA nenhuma
    case '/api/pedidos': case '/api/pedidos/confirmar': case '/api/pedidos/ajustar': case '/api/pedidos/cancelar': case '/api/pedidos/apagar': case '/api/pedidos/repeticao': {
      const P = D.ped = D.ped || { pedidos: [], repeticoes: [] }, FM = { texto: 'Post de texto', carrossel: 'Carrossel em PDF', fotos: 'Post com as suas fotos', imagem: 'Imagem gerada no Magnific', video: 'Vídeo gerado no Magnific' }
      const conf = pl => ({ bloqueios: (pl.formato === 'fotos' || (pl.formato === 'video' && pl.pasta)) && !pl.pasta ? ['Diga qual pasta tem as fotos.'] : [], avisos: [], fotos: pl.pasta ? { pasta: pl.pasta, novas: 7, usar: Math.min(7, pl.formato === 'video' ? 1 : pl.quantasFotos) } : null, magnific: ['video', 'imagem'].includes(pl.formato) ? { op: pl.formato === 'video' ? 'video' : 'gerar', modelo: pl.formato === 'video' ? (pl.pasta ? 'Kling 2.6 Pro · 5 s' : 'Seedance 2.0 Pro · 720p · 5 s') : 'Mystic · 2K · 4:5', valor: null, usoMes: { operacoes: D.ops, limite: 30 } } : null, escrever: { ia: 'Claude', modelo: 'sonnet', esforco: 'medium', antes: P.pedidos.some(x => x.estado === 'pronto' && x.plano.formato === pl.formato) ? { vezes: 1, tokens: 38400 } : null } })
      const resumo = p => { const u = p.uso || {}, l = []; if (u.entender) l.push(`entender ${milT(u.entender.total)} tokens (${u.entender.ia})`); if (u.escrever) l.push(`escrever ${milT(u.escrever.total)} tokens (${u.escrever.ia} ${u.escrever.modelo})`); if (p.plano && ['video', 'imagem'].includes(p.plano.formato) && p.estado === 'pronto') l.push(`Magnific 1 ${p.plano.formato === 'video' ? 'vídeo' : 'imagem'}`); return l.join(' · ') || 'nada' }
      const achar = () => P.pedidos.find(x => x.id === data.id)
      const fazer = (p, rep) => {
        const t = p.plano.formato, passos = [...(t === 'fotos' ? ['Copiei 3 fotos da pasta.'] : t === 'video' || t === 'imagem' ? [`Pedi ${t === 'video' ? 'o vídeo' : 'a imagem'} ao Magnific (1 operação).`] : []), 'O Claude está escrevendo o post.']
        Object.assign(p, { estado: 'fazendo', passos: [] })
        passos.forEach((x, k) => setTimeout(() => p.passos.push({ t: Date.now(), texto: x }), 500 + k * 900))
        setTimeout(() => {
          const id = 'pedido-' + p.id, cor = { video: '#ff7a85', fotos: '#3ddc84', imagem: '#8b7cff', carrossel: '#4cc2ff' }[t] || '#ffb547'
          D.fila.unshift({ kind: t === 'carrossel' ? 'noticias' : 'avulsos', id, title: p.plano.tema ? p.plano.tema[0].toUpperCase() + p.plano.tema.slice(1) : 'Pedido à IA', formato: t === 'fotos' ? 'multi' : t === 'imagem' ? 'imagem' : t === 'carrossel' ? 'carrossel' : t === 'video' ? 'video' : 'texto', ...(t === 'fotos' ? { arquivos: [svgDemo('#3ddc84'), svgDemo('#4cc2ff'), svgDemo('#ffb547')] } : {}), cover: t === 'texto' || t === 'video' ? undefined : svgDemo(cor), paginas: t === 'carrossel' ? 6 : undefined, hasFile: true, approved: false, published: null, agendado: p.plano.quando || null, caption: `${p.plano.tema || 'Um post do seu pedido'}\n\nUma demonstração: aqui vem o texto que a sua IA escreveu para o pedido, no seu tom.\n\nO que você acha?` })
          p.uso.escrever = { ia: 'Claude', modelo: 'sonnet', total: 38400, cache: 24100, custoUsd: 0.081, estimado: false }
          Object.assign(p, { estado: 'pronto', post: { kind: D.fila[0].kind, id }, titulo: D.fila[0].title, agendado: p.plano.quando || null })
          if (rep) rep.feitos++
        }, 600 + passos.length * 900 + (t === 'video' ? 1800 : 600))
      }
      if (q.pathname === '/api/pedidos' && data && data.texto) {
        const t = String(data.texto), p = { id: Date.now().toString(36), texto: t, criado: Date.now(), estado: 'entendendo', uso: {} }
        P.pedidos.unshift(p)
        setTimeout(() => {
          const f = /v[ií]deo/i.test(t) ? 'video' : /carrossel/i.test(t) ? 'carrossel' : /foto|pasta/i.test(t) ? 'fotos' : /imagem/i.test(t) ? 'imagem' : 'texto'
          const pasta = (t.match(/[A-Za-z]:\\[^\s,;]+/) || [])[0] || null, d = new Date(), hora = /manh[ãa]/i.test(t) ? 9 : /almo[cç]o/i.test(t) ? 12 : /tarde/i.test(t) ? 15 : /noite/i.test(t) ? 19 : null
          if (/amanh[ãa]/i.test(t)) d.setDate(d.getDate() + 1)
          if (/sexta/i.test(t)) d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
          if (hora != null) d.setHours(hora, 0, 0, 0)
          const repetir = /todo dia|toda (segunda|ter[cç]a|quarta|quinta|sexta)|todos os dias/i.test(t) ? { dias: /todos os dias/i.test(t) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5], hora: '08:00' } : null
          const tema = (t.match(/sobre (.+?)(?:,| para | e agende|$)/i) || [])[1] || (f === 'fotos' ? 'avanço do trabalho' : '')
          const pl = { resumo: `${FM[f]}${tema ? ' sobre ' + tema : ''}${repetir ? ', de segunda a sexta' : hora != null ? `, para ${d.toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}.`, formato: f, tema, pasta, quantasFotos: 3, quando: !repetir && hora != null ? d.toISOString() : null, repetir, horaPublicar: repetir ? '12:00' : null, duvida: null }
          Object.assign(p, { plano: pl, conferencia: conf(pl), estado: 'conferir', uso: { entender: { ia: 'Claude Haiku · esforço baixo', total: 46300, cache: 21200, custoUsd: 0.0054, estimado: false } } })
        }, 1500)
        return p
      }
      if (q.pathname === '/api/pedidos/ajustar') { const p = achar(); Object.assign(p.plano, data.plano); if (data.plano.repetir) p.plano.quando = null; p.conferencia = conf(p.plano); return { ...p } }
      if (q.pathname === '/api/pedidos/confirmar') {
        const p = achar()
        if (p.plano.repetir) { if (['video', 'imagem'].includes(p.plano.formato) && !data.magnificTodoDia) throw new Error('Esta repetição usa o Magnific todo dia (gasta créditos). Marque que você concorda antes.'); const r = { id: 'r' + p.id, texto: p.texto, resumo: p.plano.resumo, formato: p.plano.formato, pasta: p.plano.pasta, dias: p.plano.repetir.dias, hora: p.plano.repetir.hora, horaPublicar: p.plano.horaPublicar, ativo: true, feitos: 0 }; P.repeticoes.unshift(r); p.estado = 'repetindo'; if (data.agora) { const n = { id: p.id + 'x', texto: p.texto, criado: Date.now(), plano: { ...p.plano }, uso: {}, daRepeticao: true }; P.pedidos.unshift(n); fazer(n, r) } return p }
        fazer(p); return p
      }
      if (q.pathname === '/api/pedidos/cancelar') { const p = achar(); p.estado = 'cancelado'; return p }
      if (q.pathname === '/api/pedidos/apagar') { P.pedidos = P.pedidos.filter(x => x.id !== data.id); return { ok: true } }
      if (q.pathname === '/api/pedidos/repeticao') { if (data.apagar) P.repeticoes = P.repeticoes.filter(x => x.id !== data.id); else P.repeticoes.find(x => x.id === data.id).ativo = !!data.ativo; return { ok: true } }
      return { pedidos: P.pedidos.map(p => ({ ...p, uso: { ...p.uso, resumo: resumo(p) } })), repeticoes: P.repeticoes, formatos: FM, ia: { principal: 'Claude', barata: 'Claude Haiku · esforço baixo' } }
    }
    case '/api/interacao': case '/api/interacao/ideias': {
      const hoje = new Date().toISOString().slice(0, 10)
      D.int = D.int || { meta: 3, dias: { [new Date(Date.now() - 864e5).toISOString().slice(0, 10)]: 2, [new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)]: 3, [new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10)]: 1 }, ideias: [], buscas: [], job: null }
      if (q.pathname === '/api/interacao/ideias') {
        D.int.job = { estado: 'rodando' }
        setTimeout(() => { D.int.ideias = [
          { tema: 'Design de produto', angulo: 'Concordar com um exemplo da prática', comeco: 'Vivi isso num projeto recente: quando mostramos o rascunho cedo, a conversa com o time mudou. O que mais me ajudou foi…' },
          { tema: 'Pesquisa com usuários', angulo: 'Pergunta que puxa conversa', comeco: 'Fiquei pensando em como isso funciona em times pequenos, sem pesquisador dedicado. Como vocês decidem o que testar primeiro?' },
          { tema: 'Design system', angulo: 'Contraponto respeitoso', comeco: 'Concordo com a ideia, e acrescentaria um cuidado: no começo, um design system pequeno e usado vale mais que um completo e esquecido.' },
          { tema: 'Carreira em design', angulo: 'Dica curta', comeco: 'Uma coisa que funcionou para mim: guardar o antes e o depois de cada projeto. Na hora de contar o caso, ele se explica sozinho.' }], D.int.buscas = ['design de produto', 'ux research', 'design system', 'portfólio de design']; D.int.ideiasEm = new Date().toISOString(); D.int.job = { estado: 'pronto' } }, 2500)
      } else if (data && data.acao) { const n = D.int.dias[hoje] || 0; if (data.acao === 'comentei') D.int.dias[hoje] = n + 1; if (data.acao === 'desfazer') D.int.dias[hoje] = Math.max(0, n - 1); if (data.acao === 'meta') D.int.meta = +data.n }
      const seq = (() => { let k = 0, d = new Date(); if (!(D.int.dias[d.toISOString().slice(0, 10)] > 0)) d = new Date(Date.now() - 864e5); while (D.int.dias[d.toISOString().slice(0, 10)] > 0) { k++; d = new Date(d.getTime() - 864e5) } return k })()
      return { meta: D.int.meta, hoje: D.int.dias[hoje] || 0, sequencia: seq, semana: Array.from({ length: 7 }, (_, i) => { const x = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10); return { dia: x, n: D.int.dias[x] || 0 } }), ideias: D.int.ideias, buscas: D.int.buscas, ideiasEm: D.int.ideiasEm || null, perfil: { area: D.perfil.area, temas: D.perfil.temas }, job: D.int.job }
    }
    case '/api/atualizacao': {
      D.att = D.att || { atual: '0.18.1', procurada: new Date().toISOString(), avisar: true, erro: null, download: null,
        nova: { versao: '0.19.0', nome: 'Vynco 0.19.0 beta (exemplo)', publicada: new Date(Date.now() - 864e5).toISOString(), tamanho: 31702947, instalavel: true, pagina: 'https://github.com/otavio-guerra/Vynco/releases/latest',
          notas: '**Demonstração:** esta versão é de exemplo.\n\n- Peça à sua IA, no Início\n- Plano conferido antes de gastar\n- Gasto real de tokens em cada pedido' } }
      if (q.searchParams.get('procurar') === 'agora') D.att.procurada = new Date().toISOString()
      if (D.att.download?.fase === 'baixando') { D.att.download.feito = Math.min(D.att.download.total, D.att.download.feito + 6e6); if (D.att.download.feito >= D.att.download.total) D.att.download.fase = 'pronto' }
      return D.att
    }
    case '/api/atualizacao/baixar': D.att.download = { fase: 'baixando', feito: 0, total: D.att.nova.tamanho }; return D.att
    case '/api/atualizacao/instalar': throw new Error('Demonstração: aqui o instalador abriria e o Vynco fecharia para atualizar.')
    case '/api/atualizacao/avisar': D.att.avisar = !!data.avisar; return D.att
    case '/api/ia/modelos': {
      D.iaMod = D.iaMod || { claude: { criar: { modelo: 'sonnet', esforco: 'medium' }, ler: { modelo: '', esforco: 'low' } }, antigravity: { criar: {}, ler: {} } }
      if (data && data.id) { D.iaMod[data.id] = D.iaMod[data.id] || {}; D.iaMod[data.id][data.tipo] = { modelo: data.modelo || '', esforco: data.esforco || '' }; return { ok: true } }
      return { esforcos: ['low', 'medium', 'high', 'xhigh', 'max'], ias: [
        { id: 'claude', nome: 'Claude', papel: 'principal', instalado: true, livre: false, modelos: [{ v: 'haiku', n: 'Haiku', d: 'rápido, gasta menos' }, { v: 'sonnet', n: 'Sonnet', d: 'equilibrado' }, { v: 'opus', n: 'Opus', d: 'mais capaz' }, { v: 'fable', n: 'Fable', d: 'o mais capaz, gasta mais' }], escolha: D.iaMod.claude },
        { id: 'antigravity', nome: 'Antigravity', papel: 'reserva', instalado: true, livre: false, modelos: [{ v: 'gemini-3.8-flash-low', n: 'Gemini 3.8 Flash (Low)' }, { v: 'gemini-3.8-flash-high', n: 'Gemini 3.8 Flash (High)' }, { v: 'claude-sonnet-4-6', n: 'Claude Sonnet 4.6 (Thinking)' }, { v: 'claude-opus-4-6-thinking', n: 'Claude Opus 4.6 (Thinking)' }], escolha: D.iaMod.antigravity }] }
    }
    case '/api/rede/candidaturas': {
      D.cands = D.cands || []
      if (data.acao === 'add') { if (!String(data.vaga || '').trim()) throw new Error('Diga qual é a vaga.'); D.cands.unshift({ id: 'v' + Date.now().toString(36), vaga: data.vaga.trim(), empresa: data.empresa || '', link: data.link || '', nota: data.nota ?? null, quando: new Date().toISOString(), estado: 'enviada' }) }
      else { const c = D.cands.find(x => x.id === data.id); if (c && data.acao === 'estado') c.estado = data.estado; if (c && data.acao === 'remover') D.cands.splice(D.cands.indexOf(c), 1) }
      return { candidaturas: D.cands }
    }
    case '/api/rede/convites': {
      D.convites = D.convites || []
      if (data.acao === 'add') { if (!String(data.quem || '').trim()) throw new Error('Diga para quem você mandou (o nome ou o cargo).'); D.convites.unshift({ id: 'c' + Date.now().toString(36), quem: data.quem.trim(), sugestao: data.sugestao || '', nota: data.nota ?? null, quando: new Date().toISOString(), estado: 'enviado' }) }
      else { const c = D.convites.find(x => x.id === data.id); if (c && data.acao === 'estado') c.estado = data.estado; if (c && data.acao === 'remover') D.convites.splice(D.convites.indexOf(c), 1) }
      return { convites: D.convites }
    }
    case '/api/rede': D.convites = D.convites || [{ id: 'c1', quem: 'Ana (head de design)', sugestao: 'Líderes de produto em startups', nota: 8, quando: new Date(Date.now() - 25 * 864e5).toISOString(), estado: 'enviado' }, { id: 'c2', quem: 'Bruno (recrutador de design)', sugestao: 'Recrutadores de design', nota: 9, quando: new Date(Date.now() - 4 * 864e5).toISOString(), estado: 'aceito' }, { id: 'c3', quem: 'Carla (product designer)', sugestao: 'Designers sêniores da sua área', nota: 6, quando: new Date(Date.now() - 2 * 864e5).toISOString(), estado: 'enviado' }]; D.cands = D.cands || [{ id: 'v1', vaga: 'Designer de produto pleno', empresa: 'Empresa de exemplo', link: '', nota: 8, quando: new Date(Date.now() - 12 * 864e5).toISOString(), estado: 'enviada' }, { id: 'v2', vaga: 'Product designer sênior', empresa: 'Outra empresa', link: '', nota: 7, quando: new Date(Date.now() - 6 * 864e5).toISOString(), estado: 'entrevista' }]; return { candidaturas: D.cands, convites: D.convites, rede: D.rede, estado: D.redeEstado, perfil: { area: D.perfil.area, objetivo: D.perfil.objetivo, temas: D.perfil.temas }, agente: 'Claude' }
    case '/api/rede/buscar': {
      D.redeEstado = { estado: 'rodando', tipo: data.tipo }
      setTimeout(() => {
        const q = encodeURIComponent
        Object.assign(D.rede, {
          conexoes: [['Líderes de produto em startups', 'decidem quem contratar e avaliam portfólio', 'head of product startup', 'Oi! Acompanho o seu trabalho em produto e queria trocar ideias sobre design em times pequenos.'], ['Recrutadores de design', 'abrem as vagas antes de elas ficarem públicas', 'recrutador design', 'Oi! Sou designer de produto e gostaria de ficar no seu radar para vagas da área.'], ['Designers sêniores da sua área', 'trocam referências e indicam oportunidades', 'senior product designer', 'Oi! Gosto muito dos seus estudos de caso e queria acompanhar o seu trabalho.']].map(([perfil, por_que, busca, convite]) => ({ perfil, por_que, busca, convite, url: 'https://www.linkedin.com/search/results/people/?keywords=' + q(busca) })),
          seguir: [{ nome: '#uxdesign', tipo: 'hashtag', por_que: 'onde a área conversa' }, { nome: 'Comunidades de design de produto', tipo: 'comunidade', por_que: 'eventos e vagas' }],
          vagas: data.tipo === 'conexoes' ? D.rede.vagas : [{ titulo: 'Exemplo: Designer de produto pleno', empresa: 'Empresa de exemplo', local: data.local || 'Remoto', modalidade: data.modalidade || 'Remoto', link: 'https://example.com/vaga', por_que: 'Demonstração: na versão real, só aparecem vagas que a IA achou e cujo link existe.', publicada: 'há 3 dias', conferido: true, nivel: data.senioridade || 'Pleno', contrato: 'CLT', salario: 'R$ 8.000 a R$ 11.000', requisitos: ['3 anos na área', 'Portfólio com casos reais', 'Boa comunicação escrita'], diferenciais: ['Plano de saúde', 'Horário flexível'], combina: 'Você já tem os temas e a experiência que a vaga pede.', falta: 'A vaga pede inglês avançado; o seu perfil não fala disso.', candidatura: 'Pelo formulário do site, com portfólio em PDF.', fonte: 'site da empresa' }, { titulo: 'Exemplo: Especialista sênior', empresa: 'Outra empresa', local: 'Híbrido · Rio de Janeiro', modalidade: 'Híbrido', link: 'https://example.com/vaga-2', por_que: 'Combina com o seu objetivo de crescer para cargos sêniores.', publicada: 'há 1 semana', conferido: false, nivel: 'Sênior', contrato: 'PJ', requisitos: ['5 anos na área'], diferenciais: [], combina: '', falta: '', candidatura: '', fonte: 'Gupy' }],
          maisVagas: 'https://www.linkedin.com/jobs/search/?keywords=' + q(D.perfil.area || 'design'), quando: new Date().toISOString(), prefs: { local: data.local, modalidade: data.modalidade, senioridade: data.senioridade },
        })
        D.redeEstado = { estado: 'pronto', tipo: data.tipo }
      }, 2600)
      return { estado: 'rodando' }
    }
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
function falha(e) { Som.erro(); humor('error'); avisoFixo({ tipo: 'erro', titulo: 'Algo deu errado', texto: e.message }); setTimeout(atualizarHumor, 2800) }
function confirmar(t, p, ok = 'Confirmar') { const d = $('#dlg'); $('#dlg-t').textContent = t; $('#dlg-p').textContent = p; $('#dlg-ok').textContent = ok; d.showModal(); return new Promise(r => d.addEventListener('close', () => r(d.returnValue === 'sim'), { once: true })) }
const ring = el => { if (reduced || !el) return; const r = document.createElement('span'); r.className = 'ring'; el.appendChild(r); setTimeout(() => r.remove(), 750) }
const quando = ms => ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
const inicial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase())

// ---------------------------------------------------------------- tema
function aplicarTema() { const t = store.get('theme', 'auto'); document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t }
matchMedia('(prefers-color-scheme: light)').addEventListener('change', aplicarTema)
aplicarTema()

// ---------------------------------------------------------------- cenas
const ONB = ['ola', 'linkedin', 'voce', 'agente', 'sync', 'estrategia']
// áreas da navegação: Estratégia (perfil, rede) · Criar (modelos, mídias, editor) · Revisar (fila) · Agenda (calendário)
const AREA = { inicio: 'inicio', ajustes: 'ajustes', voce: 'perfil', perfil: 'perfil', rede: 'rede', rotinas: 'rotinas', biblioteca: 'rotinas', editor: 'rotinas', fila: 'fila', calendario: 'calendario' }
let atual = null, voltarPara = null
// cada tela pertence a uma área do app, com cor e ícone próprios (design system: --sec-*)
const AREA_DE = { inicio: 'inicio', perfil: 'estrategia', voce: 'estrategia', rotinas: 'criar', biblioteca: 'criar', editor: 'criar', fila: 'revisar', calendario: 'agenda', rede: 'rede', ajustes: 'ajustes' }
const AREA_NOME = { inicio: 'Início', estrategia: 'Estratégia', criar: 'Criar', revisar: 'Revisar', agenda: 'Agenda', rede: 'Rede', ajustes: 'Ajustes' }
const AREA_VIEW = { inicio: 'inicio', estrategia: 'perfil', criar: 'rotinas', revisar: 'fila', agenda: 'calendario', rede: 'conexoes', ajustes: 'ajustes' }
function marcarAreas() {
  for (const sc of $$('.scene.view')) {
    const area = AREA_DE[sc.dataset.scene]; if (!area) continue
    const head = $('.view-head > div', sc); if (!head || $('.area-k', head)) continue
    const svg = $(`.lado [data-view="${AREA_VIEW[area]}"] svg`)?.outerHTML || ''
    head.insertAdjacentHTML('afterbegin', `<span class="area-k"><i>${svg}</i>${AREA_NOME[area]}</span>`)
  }
}
let RD_FOCO = 'conexoes'
function focoRede(foco) {
  RD_FOCO = foco
  $$('[data-rd-pag]').forEach(p => { p.hidden = p.dataset.rdPag !== foco })
  const t = $('[data-rd-t]'); if (t) t.textContent = foco === 'vagas' ? 'Vagas.' : 'Conexões.'
  $$('#nav [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === foco))
  if (RD) desenharRede()
}
function cena(nome, { som = true } = {}) {
  if (nome === 'conexoes' || nome === 'vagas') { focoRede(nome); nome = 'rede'; if (atual?.dataset.scene === 'rede') return }
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
    $('#lado').hidden = naEntrada; document.body.classList.toggle('com-lado', !naEntrada); $('#conns').hidden = naEntrada
    $('#back').hidden = !(ob > 0 || voltarPara)
    const area = AREA[nome] || nome
    document.body.dataset.area = AREA_DE[nome] || ''
    $$('#nav [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === (nome === 'rede' ? RD_FOCO : area)))
    if (nome === 'rede') focoRede(RD_FOCO)
    $$('.subnav [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === nome))
    $('#conns').classList.toggle('on', nome === 'ajustes'); menuConta(false)
    if (som) Som.pad()
    ENTRAR[nome]?.(); if (!ST && !ONB.includes(nome) && !['fila', 'ajustes', 'calendario', 'inicio'].includes(nome)) status()
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
function terminar() { store.set('onboarded', '1'); voltarPara = null; cena('inicio'); tourSeNovo() }
const ENTRAR = {
  linkedin: () => entrarLinkedin(), voce: () => entrarVoce(), agente: () => entrarAgente(), sync: () => entrarSync(), estrategia: () => entrarEstrategia(),
  inicio: () => carregarInicio(), fila: () => carregarFila(), rotinas: () => { carregarRotinas(); carregarAuto() }, calendario: () => carregarCalendario(), ajustes: () => { status(); carregarImgAjustes() },
  biblioteca: () => carregarBiblioteca(), editor: () => entrarEditor(), perfil: () => carregarPerfil(), rede: () => carregarRede(),
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
let LIM = null, LIM_T = 0
async function carregarLimites(forcar) {
  if (!forcar && LIM && Date.now() - LIM_T < 150000) return LIM
  try { LIM = await api('/api/limites'); LIM_T = Date.now(); desenharConns(); if (!$('#conta-menu').hidden) desenharMenuConta(); if (atual?.dataset.scene === 'ajustes') desenharReserva(); if (atual?.dataset.scene === 'rotinas') desenharAuto() } catch { }
  return LIM
}
setInterval(() => { if (store.get('onboarded') === '1') carregarLimites() }, 180000)
const corUso = p => p >= 90 ? 'var(--red)' : p >= 70 ? 'var(--amber)' : 'var(--accent)'
const renovaTxt = q => { if (!q) return ''; const d = new Date(q), min = Math.round((d - Date.now()) / 60000); return min <= 0 ? 'renova agora' : min < 60 ? `renova em ${min} min` : min < 24 * 60 ? `renova em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `renova ${d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` }
// a barra de uso de uma IA (sessão e semana), no menu da conta e em Ajustes
function barrasUso(x) {
  if (!x) return ''
  if (!x.medidor) return `<p class="uso-nota">${esc(x.nota || 'Esta IA não informa o uso.')}${x.usosHoje ? ` O Vynco usou ${x.usosHoje}× hoje.` : ''}</p>`
  return x.janelas.map(j => `<div class="uso"><div class="uso-l"><span>${esc(j.rotulo)}</span><b style="color:${corUso(j.pct)}">${j.pct}%</b></div><div class="uso-barra" role="progressbar" aria-valuenow="${j.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(j.rotulo)}"><i style="width:${Math.min(100, j.pct)}%;background:${corUso(j.pct)}"></i></div>${j.renova ? `<small>${renovaTxt(j.renova)}</small>` : ""}</div>`).join('')
}
function desenharConns() {
  if (!ST) return
  if (!LIM && !LIM_T) { LIM_T = 1; carregarLimites(true) }
  const l = ST.linkedin, a = ST.agente
  const ses = LIM?.principal?.medidor ? LIM.principal.janelas[0] : null, liOk = l.connected && !venceLogo(l)
  $('#conns').innerHTML = `<span class="cx">${l.foto ? `<span class="cx-ic foto" style="--c:${liOk ? 'var(--green)' : 'var(--amber)'};background-image:url('${esc(l.foto)}')"><i class="cx-in">${GLIFO.linkedin}</i></span>` : `<span class="cx-ic" style="--c:${liOk ? 'var(--green)' : 'var(--amber)'};color:#fff;background:var(--li)">${GLIFO.linkedin}</span>`}<span class="cx-t"><b>${l.connected ? esc((l.name || 'LinkedIn').split(' ')[0]) : 'LinkedIn'}</b><small>${l.connected ? (venceLogo(l) ? 'vence ' + prazo(l.dias) : 'conectado') : 'desconectado'}</small></span></span><span class="cx"><span class="cx-ic" style="--c:${a && a.conectado ? 'var(--green)' : 'var(--amber)'}">${glifo(a ? a.id : '?')}</span><span class="cx-t"><b>${a ? esc(a.nome) : 'Sem IA'}</b><small>${ses ? `sessão ${ses.pct}%` : a && a.conectado ? (ST.reserva ? 'com reserva' : 'conectada') : 'falta entrar'}</small></span>${ses ? `<span class="cx-anel" style="--p:${Math.min(100, ses.pct)};--cor:${corUso(ses.pct)}" aria-hidden="true"></span>` : ''}</span>${LIM?.imagem?.temChave ? `<span class="cx"><span class="cx-ic mg-ic" style="--c:${LIM.imagem.operacoes >= LIM.imagem.limiteMensal ? 'var(--red)' : 'var(--green)'}">${GLIFO.magnific}</span><span class="cx-t"><b>Magnific</b><small>${LIM.imagem.operacoes} de ${LIM.imagem.limiteMensal} no mês</small></span></span>` : ''}`
}

// ---------------------------------------------------------------- 1. LinkedIn
let LI_POLL = null
function liEstado(s) { $('[data-li]').dataset.li = s; $('[data-li-next]').hidden = s !== 'ok'; $('[data-li-skip]').parentElement.hidden = s === 'ok'; humor(s === 'ok' ? 'live' : s === 'wait' ? 'waiting' : 'neutral') }
function desenharContaLi(l) {
  const av = $('[data-li-av]'); av.textContent = l.foto ? '' : inicial(l.name); av.style.backgroundImage = l.foto ? `url("${l.foto}")` : ''
  $('[data-li-name]').textContent = l.name || 'Conta conectada'
  $('[data-li-exp]').textContent = l.expiresAt ? `Acesso válido até ${quando(l.expiresAt)} · o Vynco avisa antes de vencer` : ''
}
async function entrarLinkedin() {
  const s = await status(); if (!s) return
  if (s.linkedin.connected) { desenharContaLi(s.linkedin); liEstado('ok') } else if (!LI_POLL) liEstado('idle')
  LI_REDIRECT = s.linkedin.redirectUri || LI_REDIRECT
  // sem a ponte do Vynco ligada, o primeiro acesso passa pelo assistente: avisa antes, sem susto
  if (!DEMO && !s.linkedin.connected && !s.linkedin.proprio) api('/api/linkedin/ponte').then(p => { $('[data-li-dica]').hidden = p.pronto }).catch(() => {})
}
async function conectarLinkedin(proprio = false) {
  try {
    const r = await api('/api/linkedin/connect', proprio ? { proprio: true } : {})
    if (r.precisaChaves) return abrirAssistente()
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
// ---------------------------------------------------------------- assistente do app próprio do LinkedIn (quando a ponte não está ligada)
let LI_REDIRECT = 'http://localhost:8765/callback', AS = 0
// ---------------------------------------------------------------- ilustrações do passo a passo (não são capturas: desenhos simplificados das telas do LinkedIn)
const LK = {
  campo: (rot, val, n, dica = '') => `<div class="lk-campo${n ? ' alvo' : ''}">${n ? `<span class="lk-n">${n}</span>` : ''}<small>${rot}</small><span class="lk-in${val ? '' : ' vazio'}">${val || dica}</span></div>`,
  botao: (t, n, prim = true) => `<span class="lk-bt${prim ? ' prim' : ''}${n ? ' alvo' : ''}">${n ? `<span class="lk-n">${n}</span>` : ''}${t}</span>`,
  check: (t, n) => `<div class="lk-ck${n ? ' alvo' : ''}">${n ? `<span class="lk-n">${n}</span>` : ''}<i></i>${t}</div>`,
  abas: (lista, ativa, n) => `<div class="lk-abas">${lista.map(a => `<span class="${a === ativa ? 'on' + (n ? ' alvo' : '') : ''}">${a === ativa && n ? `<span class="lk-n">${n}</span>` : ''}${a}</span>`).join('')}</div>`,
  card: (t, d, n) => `<div class="lk-card${n ? ' alvo' : ''}">${n ? `<span class="lk-n">${n}</span>` : ''}<span><b>${t}</b><small>${d}</small></span><span class="lk-bt">Request access</span></div>`,
  tela: (url, corpo) => `<figure class="lk" aria-label="Ilustração da página do LinkedIn"><div class="lk-bar"><i></i><i></i><i></i><span>${url}</span></div><div class="lk-body">${corpo}</div></figure>`,
}
const ILU_AS = [
  () => LK.tela('linkedin.com/company/setup/new', `<b class="lk-h">Criar uma Página</b>${LK.campo('Nome', 'Estúdio Ana Lima', 1)}${LK.campo('URL pública', 'linkedin.com/company/estudio-ana-lima')}${LK.campo('Tamanho da organização', '0-1 funcionários', 2)}${LK.campo('Tipo de organização', 'Autônomo', 3)}${LK.check('Confirmo que posso agir em nome desta organização', 4)}${LK.botao('Criar página', 5)}`),
  () => LK.tela('linkedin.com/developers/apps/new', `<b class="lk-h">Create an app</b>${LK.campo('App name', 'Vynco de Ana Lima', 1)}${LK.campo('LinkedIn Page', 'Estúdio Ana Lima', 2)}${LK.campo('App logo', 'sua-foto.png', 3)}${LK.check('I have read and agree to these terms', 4)}${LK.botao('Create app', 5)}`),
  () => LK.tela('linkedin.com/developers/apps/…/products', `${LK.abas(['Settings', 'Auth', 'Products', 'Analytics'], 'Products', 1)}${LK.card('Share on LinkedIn', 'publicar posts no seu perfil', 2)}${LK.card('Sign In with LinkedIn using OpenID Connect', 'entrar com a sua conta', 3)}<div class="lk-card apagado"><span><b>Advertising API</b><small>não precisa</small></span><span class="lk-bt">Request access</span></div>`),
  () => LK.tela('linkedin.com/developers/apps/…/auth', `${LK.abas(['Settings', 'Auth', 'Products', 'Analytics'], 'Auth', 1)}<b class="lk-h">OAuth 2.0 settings</b>${LK.campo('Authorized redirect URLs for your app', esc(LI_REDIRECT), 2)}<div class="lk-linha">${LK.botao('Update', 3)}<span class="lk-bt">+ Add redirect URL</span></div>`),
  () => LK.tela('linkedin.com/developers/apps/…/auth', `${LK.abas(['Settings', 'Auth', 'Products', 'Analytics'], 'Auth')}<b class="lk-h">Application credentials</b>${LK.campo('Client ID', '77abc12xyz34', 1)}${LK.campo('Primary Client Secret', '••••••••••••• (clique no olho para ver)', 2)}`),
]
// o que cada número da ilustração quer dizer
const LEGENDA_AS = [
  ['Nome: o seu nome ou o do seu estúdio', 'Tamanho: 0-1 funcionários', 'Tipo: Autônomo (ou o que for o seu caso)', 'Marque a confirmação', 'Clique em Criar página'],
  ['App name: "Vynco de" + o seu nome', 'LinkedIn Page: a página do passo 1', 'Logo: qualquer imagem (pode ser a sua foto)', 'Aceite os termos', 'Clique em Create app'],
  ['Abra a aba Products', 'Request access em Share on LinkedIn', 'Request access em Sign In with LinkedIn using OpenID Connect'],
  ['Abra a aba Auth', 'Clique no lápis e cole o endereço copiado', 'Clique em Update'],
  ['Copie o Client ID e cole aqui embaixo', 'Clique no olho, copie o Primary Client Secret e cole aqui'],
]
const PASSOS_AS = [
  { t: 'Uma página de empresa', txt: 'O LinkedIn só deixa criar apps ligados a uma página de empresa. Se você já administra uma (pode ser a sua página de freelancer ou estúdio), pule este passo.', abrir: ['Criar uma página', 'https://www.linkedin.com/company/setup/new/'], dica: 'Nome: o seu nome ou "Estúdio" + o seu nome. Tamanho: o menor. Não precisa publicar nada nela.' },
  { t: 'Criar o app', txt: 'Na página que abrir, preencha: <b>App name</b> "Vynco de" + o seu nome; <b>LinkedIn Page</b> a página do passo 1; um <b>logo</b> qualquer (pode ser a sua foto); marque que aceita os termos e clique em <b>Create app</b>.', abrir: ['Abrir a criação do app', 'https://www.linkedin.com/developers/apps/new'] },
  { t: 'Ligar 2 produtos', txt: 'No app recém-criado, abra a aba <b>Products</b> e clique em <b>Request access</b> nestes dois. Eles são liberados na hora:', lista: ['Share on LinkedIn', 'Sign In with LinkedIn using OpenID Connect'], abrir: ['Abrir os meus apps', 'https://www.linkedin.com/developers/apps'] },
  { t: 'Endereço de retorno', txt: 'Abra a aba <b>Auth</b>. Em <b>Authorized redirect URLs for your app</b>, clique no lápis, cole o endereço abaixo e clique em <b>Update</b>.', copiar: true },
  { t: 'Copiar as chaves', txt: 'Ainda na aba <b>Auth</b>, copie o <b>Client ID</b> e o <b>Primary Client Secret</b> (clique no olho para ver) e cole aqui. Pronto: o Vynco abre o LinkedIn para você clicar em Permitir.', form: true },
]
function abrirAssistente() { AS = Math.min(+store.get('assist', 0) || 0, PASSOS_AS.length - 1); desenharAssistente(); $('#proprio').showModal() }
function desenharAssistente() {
  const p = PASSOS_AS[AS], ultimo = AS === PASSOS_AS.length - 1
  store.set('assist', AS)
  $('[data-as-n]').textContent = `Passo ${AS + 1} de ${PASSOS_AS.length}`
  $('[data-as-intro]').hidden = AS > 0
  $('[data-as-trilha]').innerHTML = PASSOS_AS.map((x, i) => `<li class="${i < AS ? 'ok' : i === AS ? 'run' : ''}"><span class="ic"></span>${x.t}</li>`).join('')
  $('[data-as-passo]').classList.add('com-ilu')
  $('[data-as-passo]').innerHTML = `<div class="as-txt"><h4>${AS + 1}. ${p.t}</h4><p>${p.txt}</p>${p.lista ? `<ul>${p.lista.map(x => `<li><b>${x}</b> <button class="link" type="button" data-as-copia="${x}">copiar</button></li>`).join('')}</ul>` : ''}
    ${p.copiar ? `<div class="as-copia"><code>${esc(LI_REDIRECT)}</code><button class="btn sm accent" type="button" data-as-copia="${esc(LI_REDIRECT)}">Copiar</button></div>` : ''}
    ${p.abrir ? `<a class="btn sm" href="${p.abrir[1]}" target="_blank" rel="noopener">${p.abrir[0]} ↗</a>` : ''}${p.dica ? `<p class="fine">${p.dica}</p>` : ''}</div>
    <div class="as-ilu">${ILU_AS[AS]()}<ol class="lk-leg">${LEGENDA_AS[AS].map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="fine">Ilustração simplificada, com um exemplo. Se o seu LinkedIn estiver em português, os nomes aparecem traduzidos, e a página pode mudar um pouco.</p></div>`
  $('[data-form=linkedin-keys]').hidden = !p.form
  $('[data-as=voltar]').disabled = AS === 0
  $('[data-as=proximo]').textContent = ultimo ? 'Salvar e conectar' : AS === 0 ? 'Já tenho uma página / Próximo' : 'Feito, próximo'
  if (p.form) setTimeout(() => $('[data-form=linkedin-keys] [name=client_id]').focus(), 50)
}
function validarChavesAs() {
  const f = $('[data-form=linkedin-keys]'), id = f.client_id.value.trim(), sec = f.client_secret.value.trim()
  const msg = !id ? 'Cole o Client ID.' : !/^[A-Za-z0-9]{8,40}$/.test(id) ? 'O Client ID tem só letras e números (de 8 a 40). Confira se copiou inteiro.' : !sec ? 'Cole o Primary Client Secret.' : sec.length < 8 ? 'O Client Secret parece incompleto.' : ''
  $('[data-as-val]').textContent = msg; return !msg
}
$('#proprio').addEventListener('click', async e => {
  const c = e.target.closest('[data-as-copia]'); if (c) { try { await navigator.clipboard.writeText(c.dataset.asCopia); Som.tique(); pill('Copiado', c.dataset.asCopia.slice(0, 60)) } catch { pill('Não consegui copiar', 'Selecione e copie à mão.', 'var(--amber)') } return }
  const b = e.target.closest('[data-as]'); if (!b) return
  if (b.dataset.as === 'voltar' && AS > 0) { AS--; return desenharAssistente() }
  if (b.dataset.as === 'proximo') {
    if (AS < PASSOS_AS.length - 1) { AS++; Som.tique(); return desenharAssistente() }
    if (validarChavesAs()) { store.set('assist', 0); $('[data-form=linkedin-keys]').requestSubmit() }
  }
})
$('[data-form=linkedin-keys]').addEventListener('input', () => { if ($('[data-as-val]').textContent) validarChavesAs() })

function cancelarLinkedin() { clearInterval(LI_POLL); LI_POLL = null; api('/api/linkedin/cancelar', {}).catch(() => {}); liEstado('idle') }

// ---------------------------------------------------------------- 1b. triagem: quem é você (uma pergunta por vez; vira o perfil e a IA completa depois)
// O LinkedIn só entrega nome, foto e e-mail a apps (login OpenID): cargo e experiência não vêm. O resto sai destes toques.
const ICO = {
  design: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/><circle cx="18" cy="18" r="2"/>',
  tec: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  produto: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/>',
  marketing: '<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>',
  vendas: '<path d="M4 17l5-5 4 4 7-7M15 9h5v5"/>',
  rh: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5M15 14.6c2.6-.3 4.6 1 5.2 3.6"/>',
  financas: '<path d="M4 20V10M10 20V5M16 20v-7M22 20H2"/>',
  saude: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  direito: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/>',
  educacao: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  engenharia: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2"/>',
  negocio: '<path d="M12 3c3 2.5 4.5 6 4 10l-4 3-4-3c-.5-4 1-7.5 4-10z"/><circle cx="12" cy="10" r="1.6"/><path d="M8 13l-3 3 3 1M16 13l3 3-3 1"/>',
  criativo: '<rect x="3" y="6" width="18" height="13" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
  outra: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  estudante: '<path d="M4 6h7a3 3 0 0 1 1 .2V20a3 3 0 0 0-1-.2H4zM20 6h-7a3 3 0 0 0-1 .2V20a3 3 0 0 1 1-.2h7z"/>',
  comeco: '<path d="M5 19c4-1 6-4 6-8M11 11c0-3 2-6 6-7-1 4-3 6-6 7z"/>',
  pleno: '<path d="M4 18l6-6 3 3 7-7"/>',
  senior: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  lider: '<circle cx="12" cy="7" r="3"/><path d="M6 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5M4 11l2 1M20 11l-2 1"/>',
  dono: '<path d="M3 10l9-6 9 6M5 9v11h14V9M10 20v-6h4v6"/>',
  freela: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 12h18"/>',
  vaga: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M12 11v4"/>',
  clientes: '<path d="M7 11l3-3c1-1 2.5-1 3.5 0L18 12.5M3 12l4-4M21 12l-4-4M9 15l2 2M12 13l2.5 2.5"/>',
  referencia: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  rede: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8 7.5l3 8.5M16 7.5l-3 8.5M8.4 6h7.2"/>',
  divulgar: '<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>',
  mudar: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  aprender: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  recrutador: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  gestor: '<path d="M4 20V9l8-5 8 5v11M9 20v-5h6v5"/>',
  empresa: '<rect x="4" y="3" width="10" height="18" rx="1"/><path d="M14 9h6v12h-6M7 7h4M7 11h4M7 15h4"/>',
  colegas: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5"/>',
  iniciante: '<path d="M5 19c4-1 6-4 6-8M11 11c0-3 2-6 6-7-1 4-3 6-6 7z"/>',
  investidor: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.2 0-2.2-.6-2.6-1.6M12 6.5V8M12 16v1.5"/>',
  leve: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/>',
  medio: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  intenso: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
}
const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ICO.outra}</svg>`
// [valor salvo, descrição curta, ícone]
const VC_AREAS = [['Design', 'UX, UI, produto, gráfico, motion', 'design'], ['Tecnologia', 'desenvolvimento, dados, infraestrutura', 'tec'], ['Produto e projetos', 'PM, PO, agilidade, gestão de projetos', 'produto'], ['Marketing e comunicação', 'growth, conteúdo, marca, social', 'marketing'], ['Vendas e atendimento', 'comercial, sucesso do cliente, parcerias', 'vendas'], ['Pessoas e RH', 'recrutamento, cultura, desenvolvimento', 'rh'], ['Finanças e negócios', 'finanças, contabilidade, estratégia', 'financas'], ['Saúde', 'medicina, psicologia, nutrição, bem-estar', 'saude'], ['Direito', 'advocacia, jurídico de empresas, compliance', 'direito'], ['Educação', 'aulas, cursos, mentoria, pesquisa', 'educacao'], ['Engenharia e indústria', 'civil, produção, qualidade, logística', 'engenharia'], ['Empreendedorismo', 'negócio próprio, startup, franquia', 'negocio'], ['Arte e conteúdo', 'foto, vídeo, escrita, criação de conteúdo', 'criativo'], ['Outra área', 'conte qual é', 'outra']]
const VC_ESPEC = {
  'Design': ['Designer de produto (UX/UI)', 'Pesquisa com usuários (UX research)', 'Design gráfico e marca', 'Motion e animação', 'Design de serviços', 'Direção de arte', 'Liderança de design'],
  'Tecnologia': ['Front-end', 'Back-end', 'Mobile', 'Full-stack', 'Dados e IA', 'DevOps e nuvem', 'Segurança da informação', 'QA e testes', 'Liderança técnica'],
  'Produto e projetos': ['Product manager', 'Product owner', 'Agilidade (scrum, kanban)', 'Gestão de projetos', 'Operações de produto'],
  'Marketing e comunicação': ['Marketing digital e growth', 'Conteúdo e redes sociais', 'Branding', 'Performance e mídia paga', 'SEO', 'Assessoria de imprensa', 'CRM e e-mail'],
  'Vendas e atendimento': ['Vendas B2B', 'Pré-vendas (SDR/BDR)', 'Sucesso do cliente', 'Parcerias e canais', 'Varejo', 'Liderança comercial'],
  'Pessoas e RH': ['Recrutamento e seleção', 'Business partner (BP)', 'Treinamento e desenvolvimento', 'Cultura e clima', 'Remuneração e benefícios', 'Departamento pessoal'],
  'Finanças e negócios': ['Contabilidade', 'Finanças corporativas', 'Investimentos', 'Controladoria', 'Consultoria', 'Estratégia e planejamento'],
  'Saúde': ['Medicina', 'Enfermagem', 'Psicologia', 'Nutrição', 'Fisioterapia', 'Odontologia', 'Gestão em saúde'],
  'Direito': ['Advocacia empresarial', 'Trabalhista', 'Tributário', 'Digital e proteção de dados', 'Compliance', 'Jurídico interno'],
  'Educação': ['Professor(a)', 'Coordenação pedagógica', 'Cursos online', 'Mentoria e carreira', 'Pesquisa acadêmica', 'Educação corporativa'],
  'Engenharia e indústria': ['Engenharia civil', 'Produção e processos', 'Qualidade', 'Logística e supply chain', 'Manutenção', 'Engenharia elétrica'],
  'Empreendedorismo': ['Fundador(a) de startup', 'Pequeno negócio', 'E-commerce', 'Prestação de serviços', 'Franquia', 'Negócio de impacto'],
  'Arte e conteúdo': ['Fotografia', 'Vídeo e edição', 'Escrita e redação', 'Ilustração', 'Música', 'Criador(a) de conteúdo'],
}
const VC_NIVEIS = [['Estudante', 'ainda na faculdade ou num curso', 'estudante'], ['Começando', 'primeiro emprego, júnior ou mudando de área', 'comeco'], ['Pleno', 'já faz o trabalho com autonomia', 'pleno'], ['Sênior ou especialista', 'referência no que faz', 'senior'], ['Liderança', 'coordena ou gere pessoas', 'lider'], ['Dono(a) de negócio', 'tem a própria empresa', 'dono'], ['Autônomo(a) ou freelancer', 'atende clientes por conta', 'freela']]
const VC_OBJ = [['Conseguir uma vaga', 'ser encontrado por recrutadores', 'vaga'], ['Conseguir clientes', 'gerar oportunidades de negócio', 'clientes'], ['Ser referência na área', 'ser lembrado pelo que sabe', 'referencia'], ['Fazer networking', 'conhecer gente da área', 'rede'], ['Divulgar meu negócio', 'mostrar produto ou serviço', 'divulgar'], ['Mudar de área', 'mostrar que está em transição', 'mudar'], ['Aprender em público', 'compartilhar o que estuda', 'aprender']]
const VC_PUB = [['Recrutadores', 'quem contrata', 'recrutador'], ['Lideranças', 'gestores que decidem nas empresas', 'gestor'], ['Clientes', 'pessoas e empresas que compram de você', 'empresa'], ['Colegas da área', 'quem faz o mesmo que você', 'colegas'], ['Quem está começando', 'estudantes e juniores', 'iniciante'], ['Investidores', 'e possíveis parceiros de negócio', 'investidor']]
const VC_TONS = [['Direto', 'Três erros que vejo toda semana, e como evitar.'], ['Didático', 'Vou explicar, passo a passo, como eu faço isso.'], ['Próximo', 'Hoje quero contar uma coisa que aconteceu comigo.'], ['Inspirador', 'Ninguém começa pronto. Eu também não comecei.'], ['Bem-humorado', 'Spoiler: aquela reunião podia ter sido um e-mail.'], ['Técnico', 'Os números por trás da decisão, sem rodeio.']]
const PLAT = {
  'Behance': ['https://www.behance.net/', 'seu-usuario'], 'Dribbble': ['https://dribbble.com/', 'seu-usuario'], 'GitHub': ['https://github.com/', 'seu-usuario'],
  'Stack Overflow': ['', 'https://stackoverflow.com/users/…'], 'Medium': ['https://medium.com/@', 'seu-usuario'], 'Instagram': ['https://www.instagram.com/', 'seu-usuario'],
  'YouTube': ['https://www.youtube.com/@', 'seu-canal'], 'Lattes': ['', 'http://lattes.cnpq.br/…'], 'Doctoralia': ['', 'https://www.doctoralia.com.br/…'], 'JusBrasil': ['', 'https://www.jusbrasil.com.br/…'],
}
const VC_PLAT = {
  'Design': ['Behance', 'Dribbble'], 'Tecnologia': ['GitHub', 'Stack Overflow'], 'Produto e projetos': ['Medium'], 'Marketing e comunicação': ['Instagram', 'Medium'],
  'Pessoas e RH': ['Medium'], 'Finanças e negócios': ['Medium'], 'Saúde': ['Lattes', 'Doctoralia'], 'Direito': ['JusBrasil', 'Lattes'], 'Educação': ['Lattes', 'YouTube'],
  'Engenharia e indústria': ['Lattes', 'GitHub'], 'Empreendedorismo': ['Instagram'], 'Arte e conteúdo': ['Instagram', 'YouTube', 'Behance'],
}
const vcPlats = () => ['Site ou portfólio', ...[...new Set(VC.area.flatMap(a => VC_PLAT[a] || []))].slice(0, 4), 'Outro link']
// "seu-usuario" vira o endereço completo; um link inteiro passa como está
const vcUrl = (rede, v) => { v = String(v || '').trim(); if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; const base = (PLAT[rede] || [])[0]; return base ? base + v.replace(/^@/, '').replace(/^\/+/, '') : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(v) ? 'https://' + v : v }
const urlValida = u => /^https?:\/\/[^\s"<>]+\.[^\s"<>]+$/i.test(u)
const VC_FREQ = [['1 vez por semana', 'leve, para começar', 'leve'], ['2 a 3 vezes por semana', 'o ritmo que mais cresce', 'medio'], ['Todo dia útil', 'para quem quer acelerar', 'intenso']]
const VC_PASSOS = [
  { k: 'area', t: n => `Prazer${n ? ', ' + n : ''}! Em que área você trabalha?`, s: 'Escolha até 3. Na próxima pergunta você detalha.', multi: 3 },
  { k: 'esp', t: () => 'E o que você faz, exatamente?', s: 'Escolha quantas quiser e, se quiser, escreva o seu cargo do seu jeito.', multi: Infinity },
  { k: 'nivel', t: () => 'Em que momento da carreira você está?', s: 'Isso muda o tom dos posts e as vagas que a gente sugere.' },
  { k: 'objetivo', t: () => 'O que você quer conseguir com o LinkedIn?', s: 'Escolha até 3. É isso que guia os assuntos dos posts.', multi: 3 },
  { k: 'publico', t: () => 'Quem você quer que leia os seus posts?', s: 'Escolha até 3. A IA escreve pensando nessas pessoas.', multi: 3 },
  { k: 'tom', t: () => 'Como você quer soar?', s: 'Escolha até 2. Cada um vem com um exemplo de começo de post.', multi: 2 },
  { k: 'frequencia', t: () => 'Com que frequência quer postar?', s: 'Dá para mudar quando quiser.' },
  { k: 'links', t: () => 'Onde você já mostra o seu trabalho?', s: 'Cole os links (ou só o seu usuário). A sua IA lê tudo e completa o seu perfil, sem você precisar escrever.' },
  { k: 'imagens', t: () => 'Quer imagens feitas com IA nos seus posts?', s: 'Opcional. Dá para conectar depois em Ajustes.' },
  { k: 'fim', t: () => 'Pronto. É assim que a sua IA vai te ver.', s: 'Toque em qualquer parte para mudar.' },
]
let VC = null
const vcPrimeiro = () => (VC.nome || '').split(' ')[0]
const casa = (lista, txt) => lista.map(o => o[0]).filter(v => String(txt || '').toLowerCase().includes(v.toLowerCase()))
// editar a estratégia reabre uma pergunta da entrada e volta para Estratégia ao salvar
let VC_EDITAR = null
function vcDoPerfil(p, nome) {
  // o que já estiver salvo volta marcado (perfil salvo como "Especialidade · Área")
  const [esp0, area0] = String(p?.area || '').includes(' · ') ? p.area.split(' · ') : ['', p?.area || '']
  const areasSalvas = area0 ? area0.split(/,\s*/) : [], conhecidas = areasSalvas.filter(a => VC_AREAS.some(x => x[0] === a)), outras = areasSalvas.filter(a => !conhecidas.includes(a))
  const espSalvas = esp0 ? esp0.split(/,\s*/) : [], opsArea = conhecidas.flatMap(a => VC_ESPEC[a] || [])
  const VC = { perfil: p, nome, passo: 0, area: [...conhecidas, ...(outras.length ? ['Outra área'] : [])].slice(0, 3), outra: outras.join(', '), esps: espSalvas.filter(e => opsArea.includes(e)), cargo: espSalvas.filter(e => !opsArea.includes(e)).join(', '), nivel: p?.nivel || '', objetivo: casa(VC_OBJ, p?.objetivo), publico: casa(VC_PUB, p?.publico), tom: casa(VC_TONS, p?.tom), frequencia: p?.frequencia || '', site: p?.links?.site || p?.links?.portfolio || '', plat: Object.fromEntries((p?.links?.outras || []).map(o => [o.rede, o.url])), mag: null }
  VC.plat['Site ou portfólio'] = VC.site
  return VC
}
async function entrarVoce() {
  const ed = VC_EDITAR; VC_EDITAR = null
  let p = null; try { p = (await api('/api/perfil' + (ed?.id ? '?id=' + encodeURIComponent(ed.id) : ''))).perfil } catch { }
  if (!ST) await status()
  const l = ST?.linkedin || {}, nome = p?.nome || l.name || ''
  VC = vcDoPerfil(p, nome)
  if (ed) { VC.passo = ed.passo; VC.editando = true }
  const av = $('[data-vc-av]'); av.textContent = l.foto ? '' : inicial(nome || '?'); av.style.backgroundImage = l.foto ? `url("${l.foto}")` : ''
  $('[data-vc-li]').hidden = !l.connected
  desenharVoce()
}
const vcValor = k => VC[k]
const vcAreas = () => VC.area.map(a => a === 'Outra área' ? VC.outra.trim() : a).filter(Boolean)
const vcEspTxt = () => [...VC.esps, VC.cargo.trim()].filter(Boolean).join(', ')
const vcRespondido = k => k === 'area' ? !!(VC.area.length && (!VC.area.includes('Outra área') || VC.outra.trim())) : k === 'esp' ? !!(VC.esps.length || VC.cargo.trim()) : k === 'fim' ? true : k === 'links' ? Object.values(VC.plat).some(v => String(v || '').trim()) : k === 'imagens' ? !!(VC.mag && VC.mag.temChave) : Array.isArray(VC[k]) ? VC[k].length > 0 : !!VC[k]
function vcTiles(k, ops, multi) {
  const sel = v => multi ? VC[k].includes(v) : VC[k] === v
  return `<div class="vc-tiles${ops.length <= 3 ? ' tres' : ''}" role="${multi ? 'group' : 'radiogroup'}">${ops.map(([v, d, i]) => `<button type="button" class="vc-tile${sel(v) ? ' on' : ''}" data-vc-op="${esc(v)}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${sel(v)}">
    <span class="vc-tic">${ico(i)}</span><b>${esc(v)}</b><small>${esc(d)}</small><span class="vc-ok" aria-hidden="true"></span></button>`).join('')}</div>`
}
// a frase "o que você faz em …, quer …, falando com …" com cada parte clicável
const listaE2 = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || ''
function vcFrase(V, parte) {
  const areas = V.area.map(a => a === 'Outra área' ? V.outra.trim() : a).filter(Boolean), low = a => a.map(o => o.toLowerCase())
  return `${parte(1, listaE2([...V.esps, V.cargo.trim()].filter(Boolean)), 'o que você faz')} em ${parte(0, listaE2(areas), 'sua área')}, ${parte(2, V.nivel && V.nivel.toLowerCase(), 'momento da carreira')}. Quer ${parte(3, listaE2(low(V.objetivo)), 'um objetivo')}, falando com ${parte(4, listaE2(low(V.publico)), 'o seu público')}, num tom ${parte(5, listaE2(low(V.tom)), 'do seu jeito')}, ${parte(6, V.frequencia && V.frequencia.toLowerCase(), 'na frequência que quiser')}.`
}
function desenharVoce() {
  const P = VC_PASSOS[VC.passo], total = VC_PASSOS.length - 1
  $('[data-vc-t]').textContent = P.t(vcPrimeiro())
  $('[data-vc-s]').textContent = P.s
  $('[data-vc-passo]').textContent = VC.editando ? 'Editando a estratégia' : P.k === 'fim' ? 'Revisão' : `Pergunta ${VC.passo + 1} de ${total}`
  const prog = $('[data-vc-prog]'); prog.style.setProperty('--p', (Math.min(VC.passo, total) / total * 100) + '%'); prog.setAttribute('aria-valuenow', VC.passo + 1)
  let h = ''
  if (P.k === 'area') h = vcTiles('area', VC_AREAS, true) + (VC.area.includes('Outra área') ? `<label class="vc-campo"><span>Qual é a sua área?</span><input class="vc-in" data-vc="outra" maxlength="80" placeholder="Ex.: Arquitetura, Agronegócio, Turismo" value="${esc(VC.outra)}"></label>` : '')
  if (P.k === 'esp') {
    const ops = [...new Set(VC.area.flatMap(a => VC_ESPEC[a] || []))]
    h = (ops.length ? `<div class="vc-chips" role="group">${ops.map(o => `<button type="button" class="${VC.esps.includes(o) ? 'on' : ''}" data-vc-esp="${esc(o)}" aria-pressed="${VC.esps.includes(o)}">${esc(o)}</button>`).join('')}</div><div class="or vc-or">e, se quiser, escreva</div>` : '')
      + `<label class="vc-campo"><span>Seu cargo ou o que você faz</span><input class="vc-in" data-vc="cargo" maxlength="120" placeholder="${esc(ops.length ? 'Ex.: ' + ops[0] + ' em fintech' : 'Ex.: Arquiteto de interiores residenciais')}" value="${esc(VC.cargo)}"></label>`
  }
  if (P.k === 'nivel') h = vcTiles('nivel', VC_NIVEIS)
  if (P.k === 'objetivo') h = vcTiles('objetivo', VC_OBJ, true)
  if (P.k === 'publico') h = vcTiles('publico', VC_PUB, true)
  if (P.k === 'tom') h = `<div class="vc-tons" role="group">${VC_TONS.map(([v, ex]) => `<button type="button" class="vc-tom${VC.tom.includes(v) ? ' on' : ''}" data-vc-op="${esc(v)}" role="checkbox" aria-checked="${VC.tom.includes(v)}"><b>${esc(v)}</b><q>${esc(ex)}</q><span class="vc-ok" aria-hidden="true"></span></button>`).join('')}</div>`
  if (P.k === 'frequencia') h = vcTiles('frequencia', VC_FREQ)
  if (P.k === 'links') h = `<div class="vc-plats">${vcPlats().map(r => { const [base, ex] = PLAT[r] || ['', r === 'Outro link' ? 'https://…' : 'https://seusite.com'], v = VC.plat[r] || '', bad = v && !urlValida(vcUrl(r, v))
      return `<label class="vc-plat${bad ? ' bad' : ''}"><span class="vc-plat-n"><b>${esc(r)}</b>${base ? `<small>${esc(base.replace(/^https:\/\/(www\.)?/, ''))}</small>` : ''}</span><input class="vc-in" data-vc-plat="${esc(r)}" value="${esc(v)}" placeholder="${esc(ex)}" spellcheck="false" autocomplete="off"></label>` }).join('')}</div>
    <p class="fine vc-nota">Só leitura: a sua IA abre as páginas públicas para entender os seus projetos e especialidades. Nada é postado nessas plataformas.</p>`
  if (P.k === 'imagens') {
    const m = VC.mag, ok = m && m.temChave
    h = `<div class="vc-mag glass">
      <div class="vc-mag-h"><span class="vc-mag-ic" aria-hidden="true">${ico('criativo')}</span><span><b>Magnific</b><small>gerar, melhorar e refinar imagens</small></span>${ok ? '<span class="ok-badge">conectado</span>' : ''}</div>
      <ul class="vc-mag-l"><li><b>Gerar</b> imagens a partir de um texto, no estilo da sua marca.</li><li><b>Melhorar</b> a resolução de uma imagem em até 16 vezes.</li><li><b>Refinar</b> nitidez e detalhes de fotos e telas.</li></ul>
      ${ok ? '<p class="fine">Pronto: o estúdio de imagens já está ligado. Você define um limite de gasto por mês em Ajustes.</p>' : `<label class="vc-campo"><span>Chave da API do Magnific</span><input class="vc-in" data-vc-mag type="password" autocomplete="off" spellcheck="false" placeholder="cole a chave aqui"></label>
      <div class="vc-mag-a"><button type="button" class="btn sm accent" data-vc-mag-ok>Conferir e salvar</button><a class="link" href="${esc((m && m.chaveUrl) || 'https://www.magnific.com/user/organization/api-keys')}" target="_blank" rel="noopener">Criar uma chave no Magnific ↗</a></div>
      <p class="fine">O Magnific cobra à parte, pela API: a assinatura do site não vale aqui. A chave fica só no cofre deste computador. Vídeo com IA ainda não está no Vynco.</p>`}
    </div>`
    if (!m) api('/api/imagem').then(r => { const pr = (r.provedores || []).find(x => x.id === 'magnific') || {}; VC.mag = { temChave: !!pr.temChave, chaveUrl: pr.chaveUrl }; if (VC_PASSOS[VC.passo].k === 'imagens') desenharVoce() }).catch(() => { VC.mag = { temChave: false } })
  }
  if (P.k === 'fim') {
    const parte = (passo, txt, vazio) => `<button type="button" class="vc-parte${txt ? '' : ' vazio'}" data-vc-ir="${passo}">${esc(txt || vazio)}</button>`
    const lista = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || '', areaTxt = lista(vcAreas())
    h = `<div class="vc-resumo glass">
      <div class="vc-r-h"><span class="avatar" style="${$('[data-vc-av]').style.backgroundImage ? `background-image:${$('[data-vc-av]').style.backgroundImage};color:transparent` : ''}">${inicial(VC.nome || '?')}</span><span><b>${esc(VC.nome || 'Você')}</b><small>${esc([vcEspTxt(), areaTxt].filter(Boolean).join(' · ') || 'área a definir')}</small></span></div>
      <p>${vcFrase(VC, parte)}</p>
      ${(() => { const ls = vcPlats().filter(r => urlValida(vcUrl(r, VC.plat[r]))); return ls.length ? `<small class="fine">A sua IA também vai ler: ${parte(7, ls.map(r => r === 'Site ou portfólio' ? (dominio(vcUrl(r, VC.plat[r])) || 'seu site') : r).join(', '), '')}.</small>` : '' })()}
      ${VC.mag?.temChave ? '<small class="fine">Imagens com IA: Magnific conectado.</small>' : ''}</div>
      <p class="fine vc-nota">${ST?.linkedin?.connected ? 'Do LinkedIn vieram o seu nome e a sua foto. O LinkedIn não compartilha cargo nem experiência com outros apps, por isso as perguntas.' : 'O LinkedIn ainda não está conectado: tudo bem, dá para conectar depois em Ajustes.'}</p>`
  }
  // a entrada animada só quando muda de pergunta (marcar uma opção não pisca a tela)
  const corpo = $('[data-vc-corpo]'), mudou = VC.mostrado !== VC.passo; VC.mostrado = VC.passo
  corpo.classList.remove('troca'); if (mudou) void corpo.offsetWidth
  corpo.innerHTML = h; if (mudou) corpo.classList.add('troca')
  const ok = $('[data-vc-ok]'), resp = vcRespondido(P.k)
  ok.textContent = VC.editando ? 'Salvar e voltar' : P.k === 'fim' ? 'Está ótimo, continuar' : resp ? 'Continuar' : P.k === 'imagens' ? 'Agora não' : 'Pular esta'
  ok.classList.toggle('accent', VC.editando || resp)
  $('[data-vc-voltar]').hidden = VC.passo === 0 || VC.editando
}
function vcIr(n) { VC.passo = Math.max(0, Math.min(VC_PASSOS.length - 1, n)); Som.tique(); desenharVoce(); $('[data-vc-corpo] input, [data-vc-corpo] button')?.focus({ preventScroll: true }) }
function vcEscolher(v, campo) {
  const P = VC_PASSOS[VC.passo], k = campo || P.k
  if (P.multi) {
    if (VC[k].includes(v)) VC[k] = VC[k].filter(x => x !== v)
    else if (VC[k].length >= P.multi) return pill(`Escolha até ${P.multi}`, 'Tire uma opção para marcar outra.', 'var(--amber)')
    else VC[k] = [...VC[k], v]
    if (k === 'area') { const ops = VC.area.flatMap(a => VC_ESPEC[a] || []); VC.esps = VC.esps.filter(e => ops.includes(e)) }
    Som.tique(); desenharVoce()
    if (k === 'area' && v === 'Outra área' && VC.area.includes(v)) setTimeout(() => $('[data-vc=outra]')?.focus(), 50)
    return
  }
  const era = VC[k] === v
  VC[k] = era ? '' : v
  Som.liga(); desenharVoce()
  if (!era) $('[data-vc-ok]')?.focus({ preventScroll: true })
}
function vcAvancar() { if (VC.editando || VC_PASSOS[VC.passo].k === 'fim') return salvarVoce(); vcIr(VC.passo + 1) }
function vcVoltar() { if (VC.passo > 0) vcIr(VC.passo - 1) }
$('[data-scene=voce]').addEventListener('click', e => {
  const op = e.target.closest('[data-vc-op]'); if (op) return vcEscolher(op.dataset.vcOp)
  const es = e.target.closest('[data-vc-esp]'); if (es) return vcEscolher(es.dataset.vcEsp, 'esps')
  const ir = e.target.closest('[data-vc-ir]'); if (ir) return vcIr(+ir.dataset.vcIr)
  if (e.target.closest('[data-vc-mag-ok]')) return salvarChaveMag()
  if (e.target.closest('[data-vc-ok]')) return vcAvancar()
  if (e.target.closest('[data-vc-voltar]')) return vcVoltar()
})
$('[data-scene=voce]').addEventListener('input', e => {
  if (e.target.dataset.vcPlat) { VC.plat[e.target.dataset.vcPlat] = e.target.value; const ok = $('[data-vc-ok]'), resp = vcRespondido('links'); if (!VC.editando) { ok.textContent = resp ? 'Continuar' : 'Pular esta'; ok.classList.toggle('accent', resp) }; return }
  const k = e.target.dataset.vc; if (!k) return
  VC[k] = e.target.value
  const ok = $('[data-vc-ok]'), resp = vcRespondido(VC_PASSOS[VC.passo].k); if (!VC.editando) { ok.textContent = resp ? 'Continuar' : 'Pular esta'; ok.classList.toggle('accent', resp) }
})
// teclado na triagem: 1 a 9 escolhem, Enter continua, Esc volta uma pergunta
function teclaVoce(e, k) {
  if (!VC) return false
  const P = VC_PASSOS[VC.passo]
  if (k === 'Escape' && VC.editando) { voltar(); return true }
  if (k === 'Escape' && VC.passo > 0) { vcVoltar(); return true }
  if (k === 'Enter') { e.preventDefault(); vcAvancar(); return true }
  if (/^[1-9]$/.test(k) && !e.target.closest('input')) {
    const ops = $$('[data-vc-op], [data-vc-esp]', $('[data-vc-corpo]')), b = ops[+k - 1]
    if (b) { b.click(); return true }
  }
  return P && false
}
async function salvarChaveMag() {
  const f = $('[data-vc-mag]'), chave = (f?.value || '').trim()
  if (!chave) return pill('Cole a chave antes', 'Ela fica na página de chaves da API do Magnific.', 'var(--amber)')
  pill('Conferindo a chave…', '', 'var(--violet)')
  try { await api('/api/imagem/chave', { provedor: 'magnific', chave }); VC.mag = { ...(VC.mag || {}), temChave: true }; Som.liga(); pill('Magnific conectado', 'A chave fica só no cofre deste computador.', 'var(--green)'); desenharVoce() }
  catch (e) { falha(e) } finally { if (f) f.value = '' }
}
async function salvarVoce() {
  if (!VC) return proximaCena()
  const areaNome = vcAreas().join(', ')
  const area = [vcEspTxt(), areaNome].filter(Boolean).join(' · ')
  const ruim = Object.entries(VC.plat).find(([r, v]) => String(v || '').trim() && !urlValida(vcUrl(r, v)))
  if (ruim) { vcIr(VC_PASSOS.findIndex(p => p.k === 'links')); return pill(`Confira o link de ${ruim[0]}`, 'Cole o endereço completo, começando com https://', 'var(--amber)') }
  const site = vcUrl('Site ou portfólio', VC.plat['Site ou portfólio'])
  const outras = Object.entries(VC.plat).filter(([r, v]) => r !== 'Site ou portfólio' && String(v || '').trim()).map(([r, v]) => ({ rede: r === 'Outro link' ? (dominio(vcUrl(r, v)) || 'Link') : r, url: vcUrl(r, v) }))
  const p = VC.perfil || {}
  if (area || VC.nivel || VC.objetivo.length || VC.publico.length || VC.tom.length || VC.frequencia || site || outras.length) {
    try {
      await api('/api/perfil/salvar', { id: p.id, perfil: { ...p, nome: p.nome || VC.nome, area: area || p.area || '', nivel: VC.nivel, objetivo: VC.objetivo.join(', '), publico: VC.publico.join(', '), tom: VC.tom.join(', '), frequencia: VC.frequencia, links: { ...(p.links || {}), site, outras } } })
      Som.liga(); pill(VC.editando ? 'Estratégia salva' : 'Perfil começado', 'A sua IA vai usar isso em cada post.', 'var(--green)')
      if (!VC.editando && (area || site || outras.length)) store.set('analisarDepois', '1')   // quando a IA estiver pronta, ela completa o perfil
    } catch (e) { return falha(e) }
  }
  proximaCena()
}
// depois que a IA é sincronizada, ela lê a triagem (e o link) e sugere o resto do perfil, sem aplicar nada sozinha
function analisarDepoisDaTriagem() {
  if (store.get('analisarDepois') !== '1') return
  store.set('analisarDepois', '0')
  api('/api/perfil/analisar', {}).then(() => setTimeout(() => pill('A sua IA está completando o seu perfil', 'As sugestões aparecem em Estratégia, para você aplicar.', 'var(--violet)'), 1800)).catch(() => {})
}

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
function desenharLogin(a, j) { comCodigo(() => desenharLogin0(a, j)) }
function desenharLogin0(a, j) {
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
    ${j.codigo && j.fase === 'esperando' ? `<span class="res-codigo"><input data-res-codigo placeholder="O navegador mostrou um código? Cole aqui" autocomplete="off" spellcheck="false"><button class="btn sm" data-act="res-codigo" data-res="${a.id}">Enviar</button></span>` : ''}
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
let SYNC_PARAR = false
$('[data-sync-cancelar]').addEventListener('click', async () => {
  SYNC_PARAR = true
  try { await api('/api/sync/cancelar', {}) } catch { }
  Som.desliga(); pill('Sincronização cancelada', 'O que já foi instalado fica. Dá para sincronizar de novo quando quiser.', 'var(--amber)')
  SYNC_ON = false; $('[data-sync-parar]').hidden = true; voltar()
})
async function entrarSync() {
  const aId = AGS?.escolhido || ST?.agente?.id || (DEMO ? 'claude' : null)
  if (!aId) return cena('agente')
  const NOMES = { claude: 'Claude', codex: 'ChatGPT', antigravity: 'Antigravity', gemini: 'Gemini', copilot: 'GitHub Copilot', qwen: 'Qwen Code', opencode: 'OpenCode' }
  const a = AGS?.agentes.find(x => x.id === aId) || { id: aId, nome: ST?.agente?.nome || NOMES[aId] || 'agente', cor: null }
  $('[data-sync-glyph]').innerHTML = glifo(a.id, a.cor); $('[data-sync-orb]').style.setProperty('--c', a.cor || 'var(--accent)')
  $('[data-sync-t]').textContent = `Preparando o ${a.nome}…`
  $('[data-sync-s]').textContent = 'Instalando o que ele precisa para trabalhar no Vynco. Leva menos de um minuto.'
  $('[data-sync-cta]').hidden = true; $('[data-steps]').classList.remove('done')
  SYNC_ON = true; SYNC_PARAR = false; $('[data-sync-parar]').hidden = false; $('#back').hidden = true; $('[data-sync-orb]').toggleAttribute('data-busy', true); humor('work')
  let s
  try { s = await api('/api/sync', { id: a.id }) } catch (e) { if (e.status !== 409) { SYNC_ON = false; $('[data-sync-parar]').hidden = true; $('#back').hidden = false; return falha(e) } s = await api('/api/sync') }
  let feitos = 0
  while (true) {
    desenharSync(s, a)
    const n = s.passos.filter(p => !['espera', 'rodando'].includes(p.estado)).length
    if (n > feitos) { for (let i = feitos; i < n; i++) setTimeout(() => Som.tique(), (i - feitos) * 80); feitos = n }
    if (s.fim || SYNC_PARAR) break
    await espera(DEMO ? 220 : 400)
    if (SYNC_PARAR) break
    s = await api('/api/sync')
  }
  $('[data-sync-parar]').hidden = true
  if (SYNC_PARAR) { $('[data-sync-orb]').removeAttribute('data-busy'); $('#back').hidden = false; humor('neutral'); return }
  SYNC_ON = false; $('[data-sync-orb]').removeAttribute('data-busy'); $('#back').hidden = false
  $('[data-steps]').classList.add('done')
  const falhou = s.passos.find(p => p.estado === 'falhou'), avisos = s.passos.filter(p => p.estado === 'aviso')
  if (falhou) {
    Som.erro(); humor('error')
    $('[data-sync-t]').textContent = 'Faltou um passo.'; $('[data-sync-s]').textContent = falhou.detalhe
    $('[data-sync-cta]').innerHTML = `<button class="btn accent lg" data-act="sync-again">Tentar de novo</button><button class="link" data-goscene="agente">Escolher outra IA</button>`
  } else {
    Som.publica(); humor('live'); ST = null; status(); analisarDepoisDaTriagem()
    $('[data-sync-t]').innerHTML = `Pronto. <span class="soft">O ${esc(a.nome)} já conhece o Vynco.</span>`
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
