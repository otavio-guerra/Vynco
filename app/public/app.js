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
  const ja = store.get('onboarded') === '1' || ['fila', 'rotinas', 'ajustes', 'calendario', 'rede', 'biblioteca', 'perfil'].includes(new URLSearchParams(location.search).get('tela'))
  return {
    linkedin: { proprio: false, connected: ja, name: ja ? 'Seu Nome' : null, expiresAt: Date.now() + 59 * 864e5, via: 'vynco', redirectUri: 'http://localhost:8765/callback' },
    agentes: { claude: { instalado: true, conectado: false }, codex: { instalado: false, conectado: false }, gemini: { instalado: false, conectado: false }, copilot: {}, qwen: {}, opencode: {} },
    escolhido: ja ? 'claude' : null, sincronizado: ja,
    lista: [['claude', 'Claude', 'Claude Code', '#D97757'], ['codex', 'ChatGPT', 'Codex', '#10A37F'], ['gemini', 'Gemini', 'Gemini CLI', '#4285F4'], ['copilot', 'GitHub Copilot', 'Copilot CLI', '#8957E5', 1], ['qwen', 'Qwen Code', 'Qwen Code', '#615CED', 1], ['opencode', 'OpenCode', 'OpenCode', '#9BA7BF', 1]].map(([id, nome, via, cor, beta]) => ({ id, nome, via, cor, beta: !!beta })),
    jobs: {}, sync: null, posts: {}, rotinas: { dicas: { ativo: true, dias: [2], hora: '08:00' }, pergunta: { ativo: true, dias: [5], hora: '09:00' } }, tarefas: [], ops: 0, gasto: 0, analise: null, rede: { conexoes: [], seguir: [], vagas: [], prefs: {} }, redeEstado: null,
    perfil: { id: 'principal', nome: 'Seu Nome', area: '', publico: '', objetivo: '', tom: '', temas: [], evitar: [], links: { site: '', portfolio: '' }, sobre: '', pilares: [], marca: { cores: { principal: '', secundaria: '', acento: '', fundo: '', texto: '' }, fontes: { titulo: '', texto: '' }, estilo: '', referencias: [], aplicarNoMotor: false, usarNoEstudio: true }, analise: null, atualizado: null },
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
    case '/api/limites': return { imagem: { nome: 'Magnific', temChave: true, site: 'https://www.magnific.com', operacoes: D.ops, gasto: D.gasto, limiteMensal: 30, orcamentoMensal: 10 }, principal: { id: 'claude', nome: 'Claude', medidor: true, janelas: [{ rotulo: 'Sessão (5 horas)', pct: 34, renova: new Date(Date.now() + 2.2 * 36e5).toISOString() }, { rotulo: 'Semana', pct: 61, renova: new Date(Date.now() + 3.4 * 864e5).toISOString() }] }, reserva: D.reserva ? { id: 'gemini', nome: 'Gemini', medidor: false, nota: 'Conta Google gratuita: cerca de 1.000 pedidos por dia. O Gemini não informa o uso para outros apps.' } : null }
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
    case '/api/rede': return { rede: D.rede, estado: D.redeEstado, perfil: { area: D.perfil.area, objetivo: D.perfil.objetivo, temas: D.perfil.temas }, agente: 'Claude' }
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
let RD_FOCO = 'conexoes'
function focoRede(foco) {
  RD_FOCO = foco
  $$('[data-rd-col]').forEach(c => { c.hidden = c.dataset.rdCol !== foco })
  $('.rd-grid')?.classList.add('um')
  const t = $('[data-rd-t]'); if (t) t.textContent = foco === 'vagas' ? 'Vagas.' : 'Conexões.'
  $$('[data-rd-ir]').forEach(b => { b.hidden = !['ambos', foco].includes(b.dataset.rdIr); b.classList.toggle('accent', b.dataset.rdIr === foco); if (b.dataset.rdIr === foco) b.textContent = foco === 'vagas' ? 'Buscar vagas' : 'Buscar conexões'; if (b.dataset.rdIr === 'ambos') b.textContent = 'Buscar as duas' })
  $$('#nav [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === foco))
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
  $('#conns').innerHTML = `<span class="cx"><span class="cx-ic" style="--c:${liOk ? 'var(--green)' : 'var(--amber)'};color:#fff;background:var(--li)">${GLIFO.linkedin}</span><span class="cx-t"><b>${l.connected ? esc((l.name || 'LinkedIn').split(' ')[0]) : 'LinkedIn'}</b><small>${l.connected ? (venceLogo(l) ? 'vence ' + prazo(l.dias) : 'conectado') : 'desconectado'}</small></span></span><span class="cx"><span class="cx-ic" style="--c:${a && a.conectado ? 'var(--green)' : 'var(--amber)'}">${glifo(a ? a.id : '?')}</span><span class="cx-t"><b>${a ? esc(a.nome) : 'Sem IA'}</b><small>${ses ? `sessão ${ses.pct}%` : a && a.conectado ? (ST.reserva ? 'com reserva' : 'conectada') : 'falta entrar'}</small></span>${ses ? `<span class="cx-anel" style="--p:${Math.min(100, ses.pct)};--cor:${corUso(ses.pct)}" aria-hidden="true"></span>` : ''}</span>${LIM?.imagem?.temChave ? `<span class="cx"><span class="cx-ic mg-ic" style="--c:${LIM.imagem.operacoes >= LIM.imagem.limiteMensal ? 'var(--red)' : 'var(--green)'}">M</span><span class="cx-t"><b>Magnific</b><small>${LIM.imagem.operacoes} de ${LIM.imagem.limiteMensal} no mês</small></span></span>` : ''}`
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
  const NOMES = { claude: 'Claude', codex: 'ChatGPT', gemini: 'Gemini', copilot: 'GitHub Copilot', qwen: 'Qwen Code', opencode: 'OpenCode' }
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

// ---------------------------------------------------------------- fila
let FILA = [], FILTRO = 'pendente', foco = 0, verMais = false, AG_AB = false, APROVOU = null
const localISO = d => `${ymd(d)}T${hhmm(d)}`
const proximaHora = () => { const [h, m] = store.get('hora', '09:00').split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d }
const TIPO = { dailyui: 'Daily UI', noticias: 'Carrossel', series: 'Série', avulsos: 'Avulso' }
const FMT_TXT = { imagem: 'Imagem', gif: 'GIF', carrossel: 'Carrossel', documento: 'Documento', video: 'Vídeo', multi: 'Várias imagens', texto: 'Só texto', artigo: 'Artigo' }
const LIMITE = 3000   // caracteres do texto de um post no LinkedIn
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const estado = i => i.published ? 'pub' : i.rascunho ? 'draft' : i.agendado && i.approved ? 'sched' : i.approved ? 'ok' : ''
const quandoCurto = q => new Date(q).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const estadoTxt = i => i.published ? 'no ar' : i.rascunho ? 'rascunho' : i.aprovacaoAviso ? 'aprove de novo' : i.agendado ? (i.approved ? 'sai ' : 'agendado, falta aprovar · ') + quandoCurto(i.agendado) : i.approved ? 'aprovado' : 'esperando você'
const CONTA = { pendente: i => !i.published && !i.approved && !i.rascunho, pronto: i => !i.published && i.approved && !i.rascunho, publicado: i => !!i.published, rascunho: i => !i.published && !!i.rascunho, todos: () => true }
const FILTROS_REVISAR = ['pendente', 'pronto', 'rascunho']
const visiveis = () => FILA.filter(CONTA[FILTRO])
async function carregarFila() {
  if (!FILTROS_REVISAR.includes(FILTRO)) FILTRO = 'pendente'   // o que já foi ao ar mora na Agenda
  try { [FILA] = await Promise.all([api('/api/queue'), ST ? null : status()]) } catch (e) { return falha(e) }
  if (APROVOU) { const k = visiveis().findIndex(x => chaveIt(x) === APROVOU); if (k >= 0) foco = k }   // o post recém-aprovado fica selecionado
  desenharFila(); atualizarHumor(); contarFila()
}
function atualizarHumor() {
  if (!['fila', 'rotinas', 'ajustes', 'biblioteca', 'editor', 'perfil', 'rede', 'calendario'].includes(atual?.dataset.scene)) return
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
  const media = i.formato === 'video' && i.file && !DEMO ? `<video src="${arquivo(i.file)}" controls preload="metadata"></video>` : i.formato === 'gif' && i.file && !DEMO ? `<img src="${arquivo(i.file)}" alt="Prévia de ${esc(i.title)}">` : i.cover ? `<img src="${arquivo(i.cover)}" alt="Prévia de ${esc(i.title)}">` : wire(i.formato || 'imagem', { paginas: i.paginas })
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
  $('[data-fila-title]').textContent = pend ? `${pend} ${pend === 1 ? 'post esperando' : 'posts esperando'} você.` : prontos ? 'Tudo aprovado.' : FILA.length ? 'Nada para revisar.' : 'Nada para revisar ainda.'
  $('[data-fila-sub]').innerHTML = pend ? 'Olhe a prévia, aperte <kbd class="sm">A</kbd> para aprovar e <kbd class="sm">P</kbd> para publicar.' : prontos ? `${prontos} ${prontos === 1 ? 'pronto' : 'prontos'} para ir ao ar quando você quiser (<kbd class="sm">P</kbd>).` : 'Peça um post novo para a sua IA em Criar. Quando ficar pronto, ele aparece aqui.'
  foco = Math.max(0, Math.min(foco, v.length - 1))
  $('[data-strip]').innerHTML = v.length ? v.map((i, n) => `<button class="post${n === foco ? ' focus' : ''}" data-n="${n}" aria-pressed="${n === foco}">
    <div class="shot">${capa(i)}</div>
    <footer><span class="state ${estado(i)}"></span><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || TIPO[i.kind]} · ${estadoTxt(i)}</small></span></footer>
    ${i.formato !== 'texto' && i.caption ? `<p class="resumo">${esc(i.caption.split('\n').filter(l => l.trim())[0] || '')}</p>` : ''}</button>`).join('')
    : `<div class="empty"><div class="wf-row">${wire('imagem')}${wire('carrossel')}${wire('video')}</div><h3>${FILTRO === 'pendente' ? 'Nada esperando você.' : 'Nada por aqui.'}</h3><p>Quando a sua IA terminar uma peça, ela aparece aqui para você olhar antes de ir ao ar.</p><div class="cta small"><button class="btn sm accent" data-view="rotinas">Escolher um modelo de post</button><button class="btn sm" data-novo-post>Escrever um post</button></div></div>`
  detalhe()
}
function detalhe() {
  const i = visiveis()[foco], d = $('[data-detail]')
  if (!i) { d.hidden = true; return } d.hidden = false
  const l = ST?.linkedin || {}, nome = l.name || 'Você'
  const chars = i.caracteres ?? (i.caption || '').trim().length, passou = chars > LIMITE
  const editar = i.kind === 'avulsos' && i.pasta && !i.published ? `<button class="btn" data-q="editar">Editar</button>` : ''
  const acoes = i.published ? `<a class="btn" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">Ver no LinkedIn</a>`
    : i.rascunho ? `<button class="btn accent" data-q="enviar">Enviar para aprovação</button>${editar}<button class="link soft" data-q="excluir">Excluir</button>`
    : [editar, !i.hasFile ? `<button class="btn" data-q="export">Exportar</button>` : '',
       `<button class="btn${i.approved ? '' : ' accent'}" data-q="toggle">${i.approved ? 'Desfazer aprovação' : 'Aprovar'} <kbd>A</kbd></button>`,
       i.approved && i.hasFile ? `<button class="btn good" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora <kbd>P</kbd></button>` : '',
       !i.published ? `<button class="btn" data-q="agendar" aria-expanded="${AG_AB}">${i.agendado ? 'Mudar horário' : 'Agendar'}</button>` : ''].join('')
  const avisoAg = ATIV.avisos.find(a => a.chave === chaveIt(i) && !a.ok)
  const alerta = !i.published && i.aprovacaoAviso ? `<div class="fp-alerta"><b>${i.aprovacaoAviso === 'antiga' ? 'Aprove de novo, com um clique' : 'Este post mudou depois que você aprovou'}</b><small>${i.aprovacaoAviso === 'antiga' ? 'A aprovação é de antes da atualização de segurança, que agora confere o texto e os arquivos de cada post.' : 'O texto ou um arquivo é diferente do que você aprovou. Olhe a prévia de novo antes de aprovar.'}</small></div>` : avisoAg && !i.published ? `<div class="fp-alerta"><b>${esc(avisoAg.texto)}</b><small>${new Date(avisoAg.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>` : ''
  d.innerHTML = `${alerta}${APROVOU === chaveIt(i) && i.approved && !i.published && !i.agendado ? (() => { const q = proximoLivre(); return `<div class="fp-depois"><b>Aprovado. E agora?</b><div class="fp-depois-a"><button class="btn accent" data-q="ag-sugestao" data-quando="${q.toISOString()}">Agendar para ${esc(quandoCurto(q))}</button><button class="btn good" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora</button><button class="link" data-q="agendar">Outro horário</button></div><small>Sugestão: o próximo dia útil livre, no horário que você costuma usar.</small></div>` })() : ''}<div class="fp-label"><span>Prévia no feed</span><span>${TIPO[i.kind]} · ${FMT_TXT[i.formato] || ''}</span></div>
    ${cartaoFeed(i, { aberto: verMais, quandoTxt: i.published ? 'publicado ' + quando(Date.parse(i.published.quando)) : 'agora' })}
    ${i.agendado && !i.published ? `<div class="fp-ag${i.approved ? '' : ' warn'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>${i.approved ? 'Sai sozinho' : 'Agendado, mas só sai se você aprovar'} · <b>${quandoCurto(i.agendado)}</b></span></div>` : ''}
    <div class="fp-actions">${acoes}${i.file && (!i.pasta || ST?.desktop) ? `<a class="link" href="${arquivo(i.file)}" target="_blank" rel="noopener">${i.pasta ? 'Abrir a pasta' : 'Abrir o arquivo'}</a>` : ''}</div>
    ${AG_AB && !i.published && !i.rascunho ? `<div class="fp-agform">${(() => { const q = i.agendado ? new Date(i.agendado) : proximoLivre(); return `<label><span>Dia</span><input type="date" data-ag-dia value="${ymd(q)}" min="${hoje0()}"></label><label><span>Hora</span><input type="time" data-ag-hora value="${hhmm(q)}"></label>` })()}<button class="btn sm accent" data-q="ag-salvar">${i.approved ? 'Agendar' : 'Aprovar e agendar'}</button>${i.agendado ? '<button class="link soft" data-q="ag-tirar">Tirar da agenda</button>' : ''}<p class="fine">Sugestão: o próximo dia útil livre, no horário que você costuma usar. O Vynco publica no horário enquanto estiver aberto; se estiver fechado, publica assim que você abrir. <button class="link" data-q="ag-ver">Ver na Agenda</button></p></div>` : ''}
    <p class="fp-note${passou ? ' bad' : ''}">${passou ? `O texto tem ${chars.toLocaleString('pt-BR')} caracteres: o LinkedIn aceita até ${LIMITE.toLocaleString('pt-BR')}. Encurte a legenda para publicar.` : `${chars.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres`}${!i.published && !l.connected ? ' · Conecte o LinkedIn em Ajustes para publicar.' : l.connected && !i.published ? ` · sai como ${esc(l.name || '')}` : ''}</p>`
}
async function acao(q) {
  const i = visiveis()[foco]; if (!i) return
  if (q === 'mais') { verMais = !verMais; return detalhe() }
  if (q === 'editar') return abrirEditor({ id: i.id })
  if (q === 'agendar') { AG_AB = !AG_AB; Som.tique(); return detalhe() }
  if (q === 'ag-sugestao') { const b = $('[data-q=ag-sugestao]'), d = new Date(b.dataset.quando); APROVOU = null; return agendarItem(chaveIt(i), ymd(d), hhmm(d)) }
  if (q === 'ag-salvar') { const dia = $('[data-ag-dia]').value, hora = $('[data-ag-hora]').value, v = dia && hora ? dia + 'T' + hora : ''; if (!v) return pill('Escolha o dia e a hora', '', 'var(--amber)'); AG_AB = false; return agendarItem(chaveIt(i), v.slice(0, 10), v.slice(11, 16)) }
  if (q === 'ag-ver') { const d = $('[data-ag-dia]').value || hoje0(), n = new Date(d + 'T12:00'); CAL.dia = d; CAL.ano = n.getFullYear(); CAL.mes = n.getMonth(); AG_ABA = 'mes'; AG_AB = false; voltarPara = null; return cena('calendario') }
  if (q === 'ag-tirar') { AG_AB = false; return tirarDaAgenda(chaveIt(i)) }
  const item = { kind: i.kind, id: i.id }
  try {
    if (q === 'enviar') { await api('/api/post/enviar', { id: i.id }); Som.liga(); pill('Enviado para aprovação', i.title, 'var(--amber)'); FILTRO = 'pendente' }
    if (q === 'excluir') { if (!(await confirmar('Excluir este rascunho?', `"${i.title}" vai para a lixeira do workspace (dá para recuperar).`, 'Excluir'))) return; await api('/api/post/excluir', { id: i.id }); Som.desliga(); pill('Rascunho excluído', i.title, 'var(--amber)') }
    if (q === 'toggle' && !i.published) {
      const era = i.approved
      await api(era ? '/api/unapprove' : '/api/approve', item)
      era ? Som.desliga() : Som.liga()
      pill(era ? 'Aprovação desfeita' : 'Aprovado', i.title, era ? 'var(--amber)' : 'var(--green)')
      ring($(`[data-strip] .post[data-n="${foco}"] .state`))
      APROVOU = era ? null : chaveIt(i)   // mostra o "E agora?" no lugar dos botões
      if (!era) { FILTRO = 'pronto'; foco = 0 }
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
$('[data-strip]').addEventListener('click', e => { const p = e.target.closest('.post'); if (!p) return; foco = +p.dataset.n; verMais = false; AG_AB = false; APROVOU = null; Som.tique(); desenharFila() })
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
  if (!v.find(m => m.arquivo === BIB_SEL)) BIB_SEL = v[0]?.arquivo || null   // a prévia acompanha o filtro (filtro vazio: sem prévia, o vazio fica no meio)
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
function abrirEditor(pedido = {}) { ED_PEDIDO = pedido; voltarPara = ['fila', 'biblioteca', 'perfil', 'rotinas', 'ajustes', 'calendario', 'rede'].includes(atual?.dataset.scene) ? atual.dataset.scene : 'fila'; if (atual?.dataset.scene === 'editor') entrarEditor(); else cena('editor') }
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
    f = `<label class="ed-campo"><span>O que você quer ver <small>descreva cena, estilo, luz e cores</small></span><textarea data-es="prompt" rows="4" maxlength="4000" placeholder="Ex.: um vynco pixel art num arquipélago ao entardecer, tons de roxo e menta, céu estrelado">${esc(ES.p.prompt)}</textarea></label>
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
  if (!(await confirmar('Remover a chave do Magnific?', 'O Vynco para de conseguir gerar e melhorar imagens até você salvar outra.', 'Remover'))) return
  try { await api('/api/imagem/chave', { provedor: prov().id, chave: '' }); Som.desliga(); pill('Chave removida', '', 'var(--amber)'); carregarImgAjustes() } catch (err) { falha(err) }
})

// ---------------------------------------------------------------- perfil (quem publica, público, tom, pilares, marca)
let PF = null, PF_INFO = null, pfSujo = false, pfAnT = null
const OBJETIVOS = VC_OBJ.map(o => o[0])   // as mesmas opções da entrada
const TONS = VC_TONS.map(o => o[0])
const COR_ROT = { principal: 'Principal', secundaria: 'Secundária', acento: 'Acento', fundo: 'Fundo', texto: 'Texto' }
const COR_PADRAO = { principal: '#9246f9', secundaria: '#26eda0', acento: '#ffb547', fundo: '#1a1230', texto: '#f6f2ff' }
const caminhoPf = (o, k) => k.split('.').reduce((a, x) => a?.[x], o)
const definePf = (o, k, v) => { const ps = k.split('.'), u = ps.pop(); ps.reduce((a, x) => (a[x] ??= {}), o)[u] = v }
// contraste (WCAG): 4,5 para texto comum, 3 para títulos grandes e elementos gráficos
const lumH = h => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contraste = (a, b) => { const [x, y] = [lumH(a), lumH(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const corOk = h => /^#[0-9a-f]{6}$/i.test(h || '')
async function carregarPerfil(id) {
  desenharRitmo()
  try { PF_INFO = await api('/api/perfil' + (id ? '?id=' + encodeURIComponent(id) : '')) } catch (e) { return falha(e) }
  PF = JSON.parse(JSON.stringify(PF_INFO.perfil)); pfSujo = false
  if (!BIB.length) { try { BIB = (await api('/api/midia')).itens } catch { } }
  desenharPerfil()
  if (PF_INFO.analise?.estado === 'rodando' && PF_INFO.analise.id === PF.id) acompanharAnalise()
}
// a estratégia em uma frase: cada parte reabre a pergunta da entrada (os mesmos cartões)
function desenharResumoPf() {
  const box = $('[data-pf-resumo]'); if (!box) return
  const V = vcDoPerfil(PF, PF.nome || ST?.linkedin?.name || '')
  const parte = (passo, txt, vazio) => `<button type="button" class="vc-parte${txt ? '' : ' vazio'}" data-pf-ir="${passo}">${esc(txt || vazio)}</button>`
  box.innerHTML = `<header class="ed-box-h"><h3>Sua estratégia em uma frase</h3><span class="fine">toque numa parte para mudar</span></header><p class="pf-frase">${vcFrase(V, parte)}</p>`
}
async function desenharRitmo() {
  const box = $('[data-pf-ritmo]'); if (!box) return
  let r = null, p = null; try { [r, p] = await Promise.all([api('/api/runs'), api('/api/perfil').then(x => x.perfil)]) } catch { return }
  const ativas = (r.rotinas || []).filter(m => m.agenda?.ativo)
  box.innerHTML = `<header class="ed-box-h"><h3>Ritmo</h3><button class="link" type="button" data-view="rotinas">Ajustar em Criar</button></header>
    <p class="pf-ritmo-t"><b>${esc(p.frequencia || 'Frequência ainda não definida')}</b>${ativas.length ? ` · ${ativas.length === 1 ? 'a sua IA cria sozinha' : 'a sua IA cria sozinha'}: ${ativas.map(m => `${esc(m.titulo)} (${esc(agendaTxt(m.agenda).replace(/^Repete /, ''))})`).join('; ')}` : ' · nenhum modelo se repete sozinho ainda. Em Criar, "Repetir" faz a sua IA criar nos dias e na hora que você escolher.'}</p>`
}
function desenharPerfil() {
  if (!PF) return
  desenharResumoPf()
  $('[data-pf-sel]').innerHTML = PF_INFO.perfis.map(p => `<option value="${esc(p.id)}"${p.id === PF.id ? ' selected' : ''}>${esc(p.nome)}${p.id === PF_INFO.ativo ? ' (em uso)' : ''}</option>`).join('')
  $('[data-pf-sel]').hidden = PF_INFO.perfis.length < 2
  const conta = PF_INFO.perfis.find(p => p.id === PF.id)?.conta
  $('[data-pf-conta]').textContent = conta ? `LinkedIn: ${conta}` : PF.id === 'principal' ? 'sem conta ligada' : ''
  for (const el of $$('[data-pf]')) { if (document.activeElement === el) continue; const v = caminhoPf(PF, el.dataset.pf); el.value = Array.isArray(v) ? v.join(', ') : v || '' }
  for (const [k, ops0] of [['objetivo', OBJETIVOS], ['tom', TONS]]) {
    const salvos = (PF[k] || '').split(/,\s*/).filter(Boolean), ops = [...ops0, ...salvos.filter(v => !ops0.includes(v))]   // valores antigos continuam visíveis
    $(`[data-pf-chips="${k}"]`).innerHTML = ops.map(o => `<button type="button" data-v="${esc(o)}" class="${salvos.includes(o) ? 'on' : ''}">${esc(o)}</button>`).join('')
  }
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
    <div class="pf-usa"><b>Como o Vynco usa isto</b><ul>
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
  if (rodando) { $('[data-pf-analise]').innerHTML = `<div class="steps glass"><li class="run"><span class="ic"></span><span><b>${esc(PF_INFO.agente ? `A sua IA (${PF_INFO.agente})` : 'A sua IA')} está lendo o seu perfil e os seus links</b><small>Leva de 30 segundos a alguns minutos.</small></span></li></div>`; return }
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
$('[data-scene=perfil]').addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return
  if (t.closest('[data-pf-chips]')) { const k = t.closest('[data-pf-chips]').dataset.pfChips, v = t.dataset.v, atual_ = (PF[k] || '').split(/,\s*/).filter(Boolean); PF[k] = (atual_.includes(v) ? atual_.filter(x => x !== v) : [...atual_, v]).join(', '); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.dataset.pfRef) { const r = PF.marca.referencias, i = r.indexOf(t.dataset.pfRef); i >= 0 ? r.splice(i, 1) : r.length < 3 ? r.push(t.dataset.pfRef) : pill('Até 3 referências', 'Tire uma antes de escolher outra.', 'var(--amber)'); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.matches('[data-pf-pilar-add]')) { PF.pilares.push({ tema: '', por_que: '', ideias: [] }); pfMudou(); desenharPilares(); return $$('.pf-pilar [data-pl=tema]').pop()?.focus() }
  if (t.dataset.plTirar != null) { PF.pilares.splice(+t.dataset.plTirar, 1); pfMudou(); return desenharPilares() }
  if (t.dataset.ideia) { const [k, n] = t.dataset.ideia.split(':').map(Number), ideia = PF.pilares[k].ideias[n]; return abrirEditor({ titulo: ideia.slice(0, 80), legenda: '' , dica: `Ideia do pilar "${PF.pilares[k].tema}": ${ideia}` }) }
  if (t.dataset.aplicar) return aplicarSugestao(t.dataset.aplicar)
  if (t.matches('[data-pf-ir]')) {
    if (pfSujo) await salvarPerfil({ quieto: true })
    VC_EDITAR = { passo: +t.dataset.pfIr, id: PF.id }; voltarPara = 'perfil'; Som.tique(); return cena('voce')
  }
  if (t.matches('[data-pf-analisar]')) return analisarPerfil()
  if (t.matches('[data-pf-salvar]')) return salvarPerfil()
})

// ---------------------------------------------------------------- rede: conexões e vagas (a IA pesquisa na web; convites e candidaturas são da pessoa)
let RD = null, RD_P = { local: '', modalidade: '', senioridade: '' }, rdT = null
const MODALIDADES = ['Remoto', 'Híbrido', 'Presencial'], NIVEIS = ['Júnior', 'Pleno', 'Sênior', 'Liderança']
async function carregarRede() {
  try { RD = await api('/api/rede') } catch (e) { return falha(e) }
  RD_P = { ...RD_P, ...(RD.rede.prefs || {}) }
  $('[data-rd=local]').value = RD_P.local || ''
  desenharRede()
  if (RD.estado?.estado === 'rodando') acompanharRede()
}
function desenharRede() {
  const r = RD.rede, rodando = RD.estado?.estado === 'rodando'
  for (const [k, ops] of [['modalidade', MODALIDADES], ['senioridade', NIVEIS]]) $(`[data-rd-chips="${k}"]`).innerHTML = ops.map(o => `<button type="button" data-v="${o}" class="${RD_P[k] === o ? 'on' : ''}">${o}</button>`).join('')
  $$('[data-rd-ir]').forEach(b => (b.disabled = rodando))
  $('[data-rd-sub]').textContent = RD.perfil.area ? `Sugestões para ${RD.perfil.area}${RD.perfil.objetivo ? `, com foco em: ${RD.perfil.objetivo.toLowerCase()}` : ''}. Feitas pela sua IA a partir do seu perfil.` : 'Preencha a sua área em Estratégia: é dela que saem as sugestões de conexões e vagas.'
  $('[data-rd-estado]').innerHTML = rodando ? `<div class="steps glass"><li class="run"><span class="ic"></span><span><b>${esc(RD.agente ? `A sua IA (${RD.agente})` : 'A sua IA')} está pesquisando ${RD.estado.tipo === 'vagas' ? 'vagas' : RD.estado.tipo === 'conexoes' ? 'conexões' : 'conexões e vagas'}</b><small>Leva de 1 a 4 minutos. Os links das vagas são conferidos antes de aparecer.</small></span></li></div>`
    : RD.estado?.estado === 'falhou' ? `<p class="ed-erro">${esc(RD.estado.erro || 'A busca não deu certo.')}</p>` : r.quando ? `<p class="fine">Última busca em ${new Date(r.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${r.descartadas ? ` · ${r.descartadas} ${r.descartadas === 1 ? 'vaga descartada' : 'vagas descartadas'} por link quebrado` : ''}.</p>` : ''
  $('[data-rd-nc]').textContent = r.conexoes.length ? `${r.conexoes.length} ${r.conexoes.length === 1 ? "sugestão" : "sugestões"}` : ''
  $('[data-rd-conexoes]').innerHTML = r.conexoes.length ? r.conexoes.map((c, i) => `<article class="rd-card"><b>${esc(c.perfil)}</b><p>${esc(c.por_que)}</p>
      ${c.convite ? `<div class="rd-convite"><small>Mensagem de convite</small><span>${esc(c.convite)}</span></div>` : ''}
      <div class="rd-a"><a class="btn sm accent" href="${esc(urlOk(c.url))}" target="_blank" rel="noopener">Buscar no LinkedIn ↗</a>${c.convite ? `<button class="link" type="button" data-rd-copia="${i}">Copiar o convite</button>` : ''}</div></article>`).join('')
    : `<div class="es-vazio"><p>Aqui aparecem os tipos de pessoa que mais ajudam o seu objetivo, com a busca pronta no LinkedIn e uma mensagem de convite no seu tom.</p></div>`
  $('[data-rd-seguir]').innerHTML = r.seguir?.length ? `<div class="rd-seguir"><small>Para seguir</small>${r.seguir.map(s => `<span class="rd-tag" title="${esc(s.por_que)}">${esc(s.nome)}<i>${esc(s.tipo)}</i></span>`).join('')}</div>` : ''
  $('[data-rd-nv]').textContent = r.vagas.length ? `${r.vagas.length} ${r.vagas.length === 1 ? "vaga" : "vagas"}` : ''
  $('[data-rd-vagas]').innerHTML = (r.vagas.length ? r.vagas.map(cartaoVaga).join('')
    : `<div class="es-vazio"><p>${r.quando ? 'A IA não achou vagas recentes com essas preferências. Tente outro local ou modalidade.' : 'Aqui aparecem vagas públicas recentes que combinam com a sua área, com o link conferido.'}</p></div>`)
    + (r.maisVagas ? `<a class="link" href="${esc(urlOk(r.maisVagas))}" target="_blank" rel="noopener">Ver mais vagas no LinkedIn ↗</a>` : '')
}
// a vaga em duas camadas: o essencial à vista (cargo, empresa, etiquetas, por que combina) e o resto em "Ver detalhes"
function cartaoVaga(v) {
  const tags = [v.modalidade, v.nivel, v.contrato].filter(Boolean).map(t => `<span class="vg-tag">${esc(t)}</span>`).join('') + (v.salario ? `<span class="vg-tag money">${esc(v.salario)}</span>` : '')
  const lista = (t, xs, cls = '') => xs && xs.length ? `<div class="vg-bloco${cls}"><small>${t}</small><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''
  const tem = (v.requisitos || []).length || (v.diferenciais || []).length || v.combina || v.falta || v.candidatura
  return `<article class="rd-card vg">
    <header class="vg-h"><span class="vg-logo" aria-hidden="true">${inicial(v.empresa || v.titulo)}</span><span><b>${esc(v.titulo)}</b><small class="rd-meta">${[v.empresa, v.local].filter(Boolean).map(esc).join(' · ')}</small></span>${v.publicada ? `<small class="vg-quando">${esc(v.publicada)}</small>` : ''}</header>
    ${tags ? `<div class="vg-tags">${tags}</div>` : ''}
    <p>${esc(v.por_que)}</p>
    ${tem ? `<details class="vg-mais"><summary>Ver detalhes</summary>
      ${lista('Requisitos', v.requisitos)}${lista('Diferenciais e benefícios', v.diferenciais)}
      ${v.combina || v.falta ? `<div class="vg-fit">${v.combina ? `<div class="vg-bloco ok"><small>O que você já tem</small><p>${esc(v.combina)}</p></div>` : ''}${v.falta ? `<div class="vg-bloco falta"><small>O que pode faltar</small><p>${esc(v.falta)}</p></div>` : ''}</div>` : ''}
      ${v.candidatura ? `<div class="vg-bloco"><small>Como se candidatar</small><p>${esc(v.candidatura)}</p></div>` : ''}
    </details>` : ''}
    <div class="rd-a"><a class="btn sm accent" href="${esc(urlOk(v.link))}" target="_blank" rel="noopener">Abrir a vaga${v.fonte ? ' no ' + esc(v.fonte) : ''} ↗</a><span class="rd-ok ${v.conferido ? 'ok' : ''}">${v.conferido ? 'link conferido' : 'o site não deixa conferir o link'}</span></div></article>`
}
async function buscarRede(tipo) {
  RD_P.local = $('[data-rd=local]').value
  try { await api('/api/rede/buscar', { tipo, ...RD_P }); RD.estado = { estado: 'rodando', tipo }; humor('work'); Som.tique(); desenharRede(); acompanharRede() } catch (e) { falha(e) }
}
function acompanharRede() {
  clearTimeout(rdT)
  rdT = setTimeout(async () => {
    let r; try { r = await api('/api/rede') } catch { return acompanharRede() }
    const era = RD.estado?.estado; RD = r
    if (r.estado?.estado === 'rodando') { if (atual?.dataset.scene === 'rede') desenharRede(); return acompanharRede() }
    if (era === 'rodando') { r.estado?.estado === 'pronto' ? (Som.liga(), pill('Sugestões prontas', 'Veja as conexões e as vagas na aba Rede.', 'var(--green)')) : (Som.erro(), pill('A busca não deu certo', r.estado?.erro || '', 'var(--red)')) }
    atualizarHumor(); if (atual?.dataset.scene === 'rede') desenharRede()
  }, DEMO ? 800 : 3000)
}
$('[data-scene=rede]').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.closest('[data-rd-chips]')) { const k = b.closest('[data-rd-chips]').dataset.rdChips; RD_P[k] = RD_P[k] === b.dataset.v ? '' : b.dataset.v; Som.tique(); return desenharRede() }
  if (b.dataset.rdIr) return buscarRede(b.dataset.rdIr)
  if (b.dataset.rdCopia != null) { try { await navigator.clipboard.writeText(RD.rede.conexoes[+b.dataset.rdCopia].convite); Som.tique(); pill('Convite copiado', 'Cole na mensagem do convite no LinkedIn.', 'var(--green)') } catch { pill('Não consegui copiar', '', 'var(--amber)') } }
})

// ---------------------------------------------------------------- início: o que vai ao ar, o que espera você e o que a IA vai fazer
let INI_ROT = [], INI_AUTO = false
async function carregarInicio() {
  try { const [f, r, au] = await Promise.all([api('/api/queue'), api('/api/runs').catch(() => ({ rotinas: [] })), api('/api/automatico').catch(() => null), ST ? null : status()]); FILA = f; INI_ROT = (r.rotinas || []).filter(x => x.agenda?.ativo); INI_AUTO = !!au?.ativo } catch (e) { return falha(e) }
  desenharInicio(); contarFila(); atualizarHumor()
}
const quandoRel = q => {
  const d = new Date(q), h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), dias = Math.round((new Date(ymd(d) + 'T12:00') - new Date(hoje0() + 'T12:00')) / 864e5)
  return dias === 0 ? `Hoje, ${h}` : dias === 1 ? `Amanhã, ${h}` : `${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}, ${h}`
}
function proximaRotina(r) {   // o próximo dia e hora em que a rotina roda
  const [hh, mm] = (r.agenda.hora || '08:00').split(':').map(Number), agora = new Date()
  for (let k = 0; k < 8; k++) { const x = new Date(agora); x.setDate(agora.getDate() + k); x.setHours(hh, mm, 0, 0); if ((r.agenda.dias || []).includes(x.getDay()) && x > agora) return x }
  return null
}
function desenharInicio() {
  const nome = (ST?.linkedin?.name || '').split(' ')[0], h = new Date().getHours()
  $('[data-ini-t]').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}${nome ? ', ' + nome : ''}.`
  const ag = FILA.filter(i => i.agendado && !i.published).sort((a, b) => a.agendado.localeCompare(b.agendado))
  const esp = FILA.filter(CONTA.pendente), pub = FILA.filter(i => i.published).sort((a, b) => String(b.published.quando || '').localeCompare(String(a.published.quando || '')))
  const sem7 = ag.filter(i => new Date(i.agendado) - Date.now() <= 7 * 864e5).length, semAprov = ag.filter(i => !i.approved).length
  $('[data-ini-s]').textContent = ag.length ? `O próximo post sai ${quandoRel(ag[0].agendado).toLowerCase()}. ${ag.length === 1 ? 'Só ele está na agenda.' : `Há ${ag.length} posts na agenda.`}` : esp.length ? 'Nada agendado ainda. Revise o que está esperando e escolha quando sai.' : 'Nada agendado ainda. Peça um post à sua IA em Criar.'
  const li = ST?.linkedin || {}
  const chip = (n, rot, view, tom = '') => `<button type="button" class="ini-chip glass${tom}" data-view="${view}"><b>${n}</b><span>${rot}</span></button>`
  $('[data-ini-resumo]').innerHTML = chip(sem7, sem7 === 1 ? 'agendado nos próximos 7 dias' : 'agendados nos próximos 7 dias', 'calendario')
    + chip(esp.length, 'esperando você', 'fila', esp.length ? ' warn' : '')
    + chip(pub.filter(i => String(i.published.quando || '').slice(0, 7) === hoje0().slice(0, 7)).length, 'publicados este mês', 'calendario')
    + `<button type="button" class="ini-chip glass${li.connected ? '' : ' bad'}" data-view="ajustes"><b>${li.connected ? 'LinkedIn' : '!'}</b><span>${li.connected ? (venceLogo(li) ? `vence ${prazo(li.dias)}` : 'conectado') : 'não conectado'}</span></button>`
  if (INI_AUTO) $('[data-ini-s]').textContent += ' Modo automático ligado: a IA cria e o Vynco aprova e agenda.'
  const sb = ST?.standby, avisoSb = ag.length && sb?.disponivel && !sb.ligado ? `<p class="ini-alerta">O Vynco só publica com o app aberto. Ligue o modo standby: ele abre com o Windows, fica na bandeja e não perde nenhum horário. <button class="btn sm accent" data-act="standby-ligar">Ligar</button></p>` : ''
  const aviso = avisoSb + (semAprov ? `<p class="ini-alerta">${semAprov === 1 ? '1 post agendado ainda não foi aprovado' : `${semAprov} posts agendados ainda não foram aprovados`} e não vai ao ar assim. <button class="link" data-view="fila">Aprovar em Revisar</button></p>` : '')
  const falta = q => { const m = Math.round((new Date(q) - Date.now()) / 60000); return m < 60 ? `em ${Math.max(1, m)} min` : m < 24 * 60 ? `em ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `em ${Math.round(m / 1440)} ${Math.round(m / 1440) === 1 ? 'dia' : 'dias'}` }
  const hero = $('[data-ini-hero]'), p0 = ag[0]
  hero.hidden = !p0
  if (p0) {
    const leg = (p0.caption || '').split('\n').filter(l => l.trim())
    hero.innerHTML = `<div class="ini-hero-capa">${capa(p0)}</div>
      <div class="ini-hero-c"><span class="ini-hero-k">PRÓXIMO POST · ${esc(falta(p0.agendado))}</span>
        <h2>${esc(leg[0] || p0.title)}</h2>
        <p>${esc(leg.slice(1).join(' ').slice(0, 180))}${leg.slice(1).join(' ').length > 180 ? '…' : ''}</p>
        <div class="ini-hero-m"><span class="ini-hero-q"><b>${quandoRel(p0.agendado)}</b></span><span class="ini-tag">${esc(FMT_TXT[p0.formato] || p0.formato || '')}</span><span class="ini-tag ${p0.approved ? 'ok' : 'warn'}">${p0.approved ? 'aprovado · sai sozinho' : 'falta aprovar'}</span></div>
        <div class="ini-acoes"><button class="btn sm accent" data-ini-abrir="${esc(chaveIt(p0))}">Ver a prévia</button><button class="link" data-ini-dia="${ymd(new Date(p0.agendado))}">Mudar o horário</button></div></div>`
  }
  const resto = ag.slice(1, 13), dias = []
  for (const i of resto) { const d = ymd(new Date(i.agendado)); let g = dias.find(x => x.d === d); if (!g) dias.push(g = { d, itens: [] }); g.itens.push(i) }
  const diaTxt = d => { const n = Math.round((new Date(d + 'T12:00') - new Date(hoje0() + 'T12:00')) / 864e5), dt = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }); return n === 0 ? `Hoje · ${dt}` : n === 1 ? `Amanhã · ${dt}` : dt }
  $('[data-ini-feed-t]').textContent = p0 ? 'Depois dele' : 'Vai ao ar'
  $('[data-ini-feed]').innerHTML = ag.length ? aviso + (resto.length ? dias.map(g => `<div class="ini-dia"><h3 class="ini-dia-t">${esc(diaTxt(g.d))}<small>${g.itens.length} ${g.itens.length === 1 ? 'post' : 'posts'}</small></h3>${g.itens.map(i => `<div class="ini-post">
      <div class="ini-quando"><span class="ini-dot${i.approved ? '' : ' warn'}"></span><b>${new Date(i.agendado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b><small>${esc(i.title)} · ${i.approved ? 'aprovado, sai sozinho' : 'falta aprovar'}</small></div>
      ${cartaoFeed(i, { quandoTxt: quandoCurto(i.agendado) })}
      <div class="ini-acoes"><button class="btn sm" data-ini-abrir="${esc(chaveIt(i))}">Abrir em Revisar</button><button class="link" data-ini-dia="${ymd(new Date(i.agendado))}">Mudar o horário</button></div>
    </div>`).join('')}</div>`).join('') : '<p class="fine">Só o post acima está na agenda por enquanto.</p>') + (ag.length > 13 ? `<p class="fine ini-mais">E mais ${ag.length - 13} depois desses. <button class="link" data-view="calendario">Ver tudo na Agenda</button></p>` : '') : ''
  if (!ag.length) $('[data-ini-feed]').innerHTML = `<div class="empty glass"><h3>Nada agendado.</h3><p>${esp.length ? 'Você tem posts esperando. Aprove e escolha o dia: eles aparecem aqui como vão ficar no feed.' : 'Quando você agendar um post, ele aparece aqui exatamente como vai ficar no feed.'}</p><div class="cta small">${esp.length ? '<button class="btn sm accent" data-view="fila">Revisar agora</button>' : '<button class="btn sm accent" data-view="rotinas">Criar um post</button>'}</div></div>`
  $('[data-ini-esperando]').innerHTML = `<header class="ed-box-h"><h3>Esperando você</h3><span class="tag">${esp.length}</span></header>${esp.length ? `<div class="ini-mini">${esp.slice(0, 4).map(i => `<button type="button" class="ini-mini-it" data-ini-abrir="${esc(chaveIt(i))}" title="${esc(i.title)}">${capa(i)}</button>`).join('')}</div><button class="btn sm accent" data-view="fila">Revisar agora</button>` : '<p class="fine">Nada para revisar. Quando a sua IA terminar um post, ele aparece aqui.</p>'}`
  const rots = INI_ROT.map(r => ({ r, q: proximaRotina(r) })).filter(x => x.q).sort((a, b) => a.q - b.q)
  $('[data-ini-rotinas]').innerHTML = `<header class="ed-box-h"><h3>A sua IA vai criar</h3><button class="link" type="button" data-view="rotinas">Criar</button></header>${rots.length ? `<ul class="ini-lista">${rots.slice(0, 4).map(x => `<li><b>${esc(x.r.titulo)}</b><small>${quandoRel(x.q)} · vai para Revisar</small></li>`).join('')}</ul>` : '<p class="fine">Nenhum modelo se repete sozinho. Em Criar, "Repetir" escolhe os dias e a hora.</p>'}<p class="fine">Criar usa a sua IA (e os créditos dela). Publicar o que já está aprovado e agendado não usa: só precisa do Vynco aberto.</p>`
  $('[data-ini-noar]').innerHTML = `<header class="ed-box-h"><h3>No ar</h3><button class="link" type="button" data-ini-noar-ver>Ver tudo</button></header>${pub.length ? `<ul class="ini-lista">${pub.slice(0, 3).map(i => `<li><b>${esc(i.title)}</b><small>${i.published.quando ? new Date(i.published.quando).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : ''}${i.published.link ? ` · <a class="link" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">ver no LinkedIn ↗</a>` : ''}</small></li>`).join('')}</ul>` : '<p class="fine">Nada publicado pelo Vynco ainda.</p>'}`
}
$('[data-scene=inicio]').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.dataset.iniAbrir) return abrirNaFila(b.dataset.iniAbrir)
  if (b.dataset.iniDia) { const d = b.dataset.iniDia, n = new Date(d + 'T12:00'); CAL = { ano: n.getFullYear(), mes: n.getMonth(), dia: d }; AG_ABA = 'mes'; voltarPara = null; return cena('calendario') }
  if (b.matches('[data-ini-noar-ver]')) { AG_ABA = 'noar'; voltarPara = null; return cena('calendario') }
  if (b.dataset.q === 'mais') { const art = b.closest('.ini-post'), k = art?.querySelector('[data-ini-abrir]')?.dataset.iniAbrir, i = k && itemDe(k); if (i) art.querySelector('.fp').outerHTML = cartaoFeed(i, { aberto: !b.textContent.includes('menos'), quandoTxt: quandoCurto(i.agendado) }) }
})

// ---------------------------------------------------------------- modo automático (cartão no topo de Criar)
let AUTO_D = null, AUTO_OPC = { dailyUi: false, veto: 2 }
async function carregarAuto() {
  const box = $('[data-auto]'); if (!box) return
  try { AUTO_D = await api('/api/automatico') } catch (e) { box.innerHTML = ''; return }
  AUTO_OPC = { dailyUi: AUTO_D.dailyUi || (!AUTO_D.ativo && AUTO_D.design), veto: AUTO_D.veto ?? 2 }
  carregarLimites(); desenharAuto()
}
const DIA_NOME = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
function desenharAuto() {
  const box = $('[data-auto]'); if (!box || !AUTO_D) return
  const on = AUTO_D.ativo, p = on ? AUTO_D.aplicado : AUTO_D.plano
  const nivelTxt = { normal: 'Ritmo normal', economia: 'Economizando', reserva: 'Só a reserva' }[p?.nivel] || ''
  const linhas = (p?.slots || []).map(sl => `<tr><td>${DIA_NOME[sl.dia]}</td><td><b>${esc(sl.titulo)}</b><small>${esc(FMT_TXT[sl.formato] || sl.formato || '')}</small></td><td>cria ${esc(sl.criar)}</td><td>sai ${esc(sl.publicar)}</td><td><span class="auto-ia${sl.ia === 'reserva' ? ' res' : ''}">${sl.ia === 'reserva' ? 'reserva' : 'principal'}</span></td></tr>`).join('')
  box.innerHTML = `<header class="ed-box-h"><h3>Modo automático <span class="auto-st${on ? ' on' : ''}">${on ? 'ligado' : 'desligado'}</span></h3>${on ? '<span class="auto-a"><button class="link" type="button" data-auto-refazer>Refazer o plano agora</button><button class="btn sm" type="button" data-auto-off>Desligar</button></span>' : ''}</header>
    <p class="fine auto-txt">${on ? 'A sua IA cria nos dias abaixo, o Vynco confere e aprova sozinho, e o post entra na agenda.' : 'A sua IA cria, o Vynco confere cada post (arquivo, tamanho da legenda, trechos por preencher e o que você pediu para evitar) e aprova sozinho.'} Cada post entra na agenda com pelo menos ${AUTO_OPC.veto} ${AUTO_OPC.veto === 1 ? 'hora' : 'horas'} para você vetar. O que não passa na conferência fica em Revisar esperando você.</p>
    ${p?.erro ? `<p class="ini-alerta">${esc(p.erro)}</p>` : `<div class="auto-grid">
      <div class="auto-plano"><div class="auto-plano-h"><b>${nivelTxt}${p?.slots ? ` · ${p.slots.length} ${p.slots.length === 1 ? 'post' : 'posts'} por semana` : ''}</b><small>${esc(p?.motivo || '')}</small></div>
        <table class="auto-tab">${linhas}</table></div>
      <aside class="auto-folga"><b>Folga das suas IAs</b>${LIM?.principal ? `<div class="auto-ia-b"><small>${esc(LIM.principal.nome)} (principal)</small>${barrasUso(LIM.principal)}</div>` : ''}${LIM?.reserva ? `<div class="auto-ia-b"><small>${esc(LIM.reserva.nome)} (reserva)</small>${barrasUso(LIM.reserva)}</div>` : `<p class="uso-nota">Sem IA reserva. <button class="link" type="button" data-view="ajustes">Ligar o Gemini (grátis)</button> para o plano não parar quando a principal chegar ao limite.</p>`}
        <p class="uso-nota">O plano é refeito todo dia com o uso de hoje. Com a semana pela metade, ele troca carrossel por texto e passa parte para a reserva.</p></aside>
    </div>`}
    ${on ? '' : `<div class="auto-opc">${AUTO_D.design ? `<label class="ed-switch"><input type="checkbox" data-auto-dui${AUTO_OPC.dailyUi ? ' checked' : ''}><span><b>Incluir o Daily UI</b><small>uma tela por dia útil, criada às 7h30 e publicada às 10h</small></span></label>` : ''}
      <label class="auto-veto"><span>Tempo para vetar</span><select class="sel" data-auto-veto>${[1, 2, 4, 12].map(h => `<option value="${h}"${+AUTO_OPC.veto === h ? ' selected' : ''}>${h} ${h === 1 ? 'hora' : 'horas'}</option>`).join('')}</select></label>
      <button class="btn accent" type="button" data-auto-on>Ligar o modo automático</button></div>`}`
}
$('[data-auto]')?.addEventListener('change', e => {
  if (e.target.matches('[data-auto-dui]')) { AUTO_OPC.dailyUi = e.target.checked; api('/api/automatico').then(d => { AUTO_D = { ...d, ativo: false }; desenharAuto() }).catch(() => {}) }
  if (e.target.matches('[data-auto-veto]')) { AUTO_OPC.veto = +e.target.value; desenharAuto() }
})
$('[data-auto]')?.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  try {
    if (b.matches('[data-auto-on]')) {
      if (!(await confirmar('Ligar o modo automático?', `Os posts vão ao ar sem você ler antes. O Vynco confere cada um e só agenda com pelo menos ${AUTO_OPC.veto} ${AUTO_OPC.veto === 1 ? 'hora' : 'horas'} de folga, para você poder vetar. Dá para desligar quando quiser.`, 'Ligar'))) return
      await api('/api/automatico', { ativo: true, dailyUi: AUTO_OPC.dailyUi, veto: AUTO_OPC.veto }); Som.liga(); pill('Modo automático ligado', 'A sua IA cria e o Vynco aprova e agenda.', 'var(--green)')
    }
    if (b.matches('[data-auto-off]')) { await api('/api/automatico', { ativo: false }); Som.desliga(); pill('Modo automático desligado', 'O que já está na agenda continua lá.', 'var(--amber)') }
    if (b.matches('[data-auto-refazer]')) { await api('/api/automatico', { ativo: true, dailyUi: AUTO_D.dailyUi, veto: AUTO_D.veto }); Som.tique(); pill('Plano refeito', 'Com o uso de agora das suas IAs.', 'var(--green)') }
    if (b.matches('[data-auto-on], [data-auto-off], [data-auto-refazer]')) { await carregarAuto(); carregarRotinas() }
  } catch (err) { falha(err) }
})

// ---------------------------------------------------------------- tour guiado (depois da entrada)
// A tela escurece, só o item da vez fica aceso, e um balão explica o que é e onde clicar. Nada atrás responde ao clique.
const TOUR = [
  { titulo: 'Bem-vindo ao Vynco', texto: 'Em um minuto você vê onde fica cada coisa. Dá para pular quando quiser.' },
  { sel: '#nav [data-view=inicio]', cena: 'inicio', titulo: 'Início', texto: 'O que vai ao ar, em ordem e do jeito que aparece no LinkedIn. O próximo post fica em destaque.' },
  { sel: '#nav [data-view=perfil]', titulo: 'Estratégia', texto: 'Quem você é, para quem escreve e com que tom. A sua IA lê isso antes de cada post. Toque na frase para mudar.' },
  { sel: '#nav [data-view=rotinas]', titulo: 'Criar', texto: 'Escolha um modelo e a sua IA cria o post. Ou escreva você mesmo.' },
  { sel: '[data-auto]', cena: 'rotinas', titulo: 'Modo automático', texto: 'Ligado, a IA cria nos dias do plano e o Vynco confere, aprova e agenda sozinho, com tempo para você vetar.' },
  { sel: '#nav [data-view=fila]', cena: 'inicio', titulo: 'Revisar', texto: 'Os posts esperando você, com a prévia do feed. A aprova, P publica. O número mostra quantos esperam.' },
  { sel: '#nav [data-view=calendario]', titulo: 'Agenda', texto: 'O mês com o que sai e quando, e o que já foi ao ar. Arraste um post para um dia para agendar.' },
  { sel: '#nav [data-view=conexoes]', titulo: 'Rede', texto: 'Tipos de pessoa para se conectar e vagas para a sua área, sugeridos pela sua IA.' },
  { sel: '#conns', titulo: 'Sua conta e seus limites', texto: 'LinkedIn, IA e Magnific, com o uso da sessão. Clique para ver a semana e quando renova.' },
  { sel: '.lado-pe [data-view=ajustes]', titulo: 'Ajustes', texto: 'Ligue uma IA reserva (o Gemini é grátis) e o modo standby, para o Vynco abrir com o Windows e não perder horário.' },
  { titulo: 'Tudo pronto', texto: 'O Vynco só publica o que está aprovado. Quando quiser ver este tour de novo, ele fica no menu da sua conta.', fim: true },
]
let TOUR_I = -1
function tourIniciar() {
  if ($('#tour')) return
  menuConta(false)
  document.body.insertAdjacentHTML('beforeend', `<div id="tour" class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t"><div class="tour-bloq"></div><div class="tour-luz" hidden></div><div class="tour-pop glass"><span class="tour-n" data-tour-n></span><h3 id="tour-t" data-tour-t></h3><p data-tour-p></p><div class="tour-a"><button class="link soft" type="button" data-tour="pular">Pular o tour</button><span class="tour-pts" data-tour-pts></span><button class="btn sm" type="button" data-tour="voltar">Voltar</button><button class="btn sm accent" type="button" data-tour="prox">Próximo</button></div></div></div>`)
  $('#tour').addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b) return; const a = b.dataset.tour; a === 'pular' ? tourFim() : a === 'voltar' ? tourIr(TOUR_I - 1) : TOUR[TOUR_I].fim ? tourFim() : tourIr(TOUR_I + 1) })
  addEventListener('resize', tourPosicionar); addEventListener('keydown', tourTecla, true)
  tourIr(0)
}
function tourTecla(e) {
  if (!$('#tour')) return
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return tourFim() }
  if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); return TOUR[TOUR_I].fim ? tourFim() : tourIr(TOUR_I + 1) }
  if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); return tourIr(TOUR_I - 1) }
  if (!['Tab'].includes(e.key)) { e.stopPropagation() }
}
async function tourIr(i) {
  if (i < 0 || i >= TOUR.length) return
  TOUR_I = i; const p = TOUR[i]
  if (p.cena && atual?.dataset.scene !== p.cena) { voltarPara = null; cena(p.cena, { som: false }); await espera(reduced ? 60 : 420) }
  const alvo = p.sel && $(p.sel)
  if (alvo) alvo.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  $('[data-tour-n]').textContent = `${i + 1} de ${TOUR.length}`
  $('[data-tour-t]').textContent = p.titulo
  $('[data-tour-p]').textContent = p.texto
  $('[data-tour-pts]').innerHTML = TOUR.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'ok' : ''}"></i>`).join('')
  $('[data-tour=voltar]').hidden = i === 0
  $('[data-tour=prox]').textContent = p.fim ? 'Começar' : i === 0 ? 'Mostrar' : 'Próximo'
  $('[data-tour=pular]').hidden = !!p.fim
  Som.tique()
  setTimeout(tourPosicionar, reduced ? 0 : 260)
  $('[data-tour=prox]').focus({ preventScroll: true })
}
function tourPosicionar() {
  const t = $('#tour'); if (!t) return
  const p = TOUR[TOUR_I], alvo = p.sel && $(p.sel), luz = $('.tour-luz', t), pop = $('.tour-pop', t)
  const r = alvo && alvo.getClientRects().length ? alvo.getBoundingClientRect() : null
  t.classList.toggle('centro', !r)
  luz.hidden = !r
  if (!r) { pop.style.left = pop.style.top = ''; return }
  const pad = 6
  Object.assign(luz.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' })
  const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 14, W = innerWidth, H = innerHeight
  let x, y
  if (r.right + m + pw < W) { x = r.right + m + pad; y = r.top + r.height / 2 - ph / 2 }          // à direita
  else if (r.bottom + m + ph < H) { x = r.left + r.width / 2 - pw / 2; y = r.bottom + m + pad }  // embaixo
  else { x = r.left + r.width / 2 - pw / 2; y = r.top - ph - m - pad }                            // em cima
  pop.style.left = Math.max(12, Math.min(W - pw - 12, x)) + 'px'
  pop.style.top = Math.max(12, Math.min(H - ph - 12, y)) + 'px'
}
function tourFim() {
  $('#tour')?.remove(); removeEventListener('resize', tourPosicionar); removeEventListener('keydown', tourTecla, true)
  store.set('tour', '1'); Som.liga()
  if (atual?.dataset.scene !== 'inicio') { voltarPara = null; cena('inicio') }
}
// começa sozinho na primeira vez que a pessoa chega ao app depois da entrada
function tourSeNovo() { if (store.get('tour') !== '1' && !DEMO_CAPTURA()) setTimeout(() => { if (!$('#tour') && !ONB.includes(atual?.dataset.scene)) tourIniciar() }, 900) }
const DEMO_CAPTURA = () => document.documentElement.classList.contains('static')

// ---------------------------------------------------------------- criar: modelos de post (rotinas) para qualquer área
let ROT = null, ROT_F = 'todos', ROT_AB = null, ROT_FORM = null, PERF_CR = null
const DIAS_C = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], DIAS_N = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const FMT_MOD = { carrossel: 'Carrossel', texto: 'Texto', imagem: 'Imagem' }
const agendaTxt = a => {
  if (!a || !a.ativo || !(a.dias || []).length) return ''
  const d = [...a.dias].sort(), uteis = d.join() === '1,2,3,4,5'
  return `Repete ${d.length === 7 ? 'todo dia' : uteis ? 'de segunda a sexta' : d.map(x => DIAS_N[x]).join(', ')} às ${a.hora || '08:00'}`
}
async function carregarRotinas() {
  try { [ROT, PERF_CR] = await Promise.all([api('/api/runs'), api('/api/perfil').then(r => r.perfil).catch(() => PERF_CR)]) } catch (e) { return falha(e) }
  if (!ST) await status()
  FLUXO_RUNS = ROT.runs.filter(r => r.status === 'rodando').length
  if (!FILA.length) { try { FILA = await api('/api/queue') } catch { } }
  desenharRotinas(); desenharFluxo()
  if (ROT.runs.some(r => r.status === 'rodando')) setTimeout(() => atual?.dataset.scene === 'rotinas' && carregarRotinas(), 4000)
}
function desenharRotinas() {
  const d = ROT, temDesign = d.rotinas.some(r => r.design)
  $('[data-rot-sub]').textContent = !d.agente ? 'Conecte uma IA em Ajustes (no pé do menu) para criar peças.' : `A sua IA (${d.agente}) cria a peça a partir do seu perfil${d.perfil?.area ? ` (${d.perfil.area})` : ''} e para antes de publicar. Nada vai ao ar sem você aprovar.`
  const f = $('[data-rot-filtro]')
  if (temDesign && !$('[data-v=design]', f)) f.insertAdjacentHTML('beforeend', '<button data-v="design">Design</button>')
  $$('button', f).forEach(b => b.classList.toggle('on', b.dataset.v === ROT_F))
  $('[data-rot-avisos]').innerHTML = ''
  const card = r => {
    const u = d.runs.find(x => x.id === r.id), rodando = u && u.status === 'rodando', ag = agendaTxt(r.agenda)
    const est = !u ? '' : rodando ? `<span class="rot-st run"><span class="spin"></span>Criando… começou às ${new Date(u.inicio).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}</span>`
      : u.status === 'concluída' ? `<span class="rot-st ok">Pronto às ${new Date(u.fim || u.inicio).toLocaleTimeString('pt-BR', { timeStyle: 'short' })} · <button class="link" data-view="fila">revisar</button></span>`
      : `<span class="rot-st bad">Não deu certo. Veja o registro abaixo e tente de novo.</span>`
    const form = ROT_AB === r.id ? `<div class="rot-form">
        <span class="fine">Em quais dias a IA cria este post?</span>
        <div class="dias" role="group" aria-label="Dias da semana">${DIAS_C.map((c, k) => `<button type="button" data-rot-dia="${k}" class="${ROT_FORM.dias.includes(k) ? 'on' : ''}" aria-pressed="${ROT_FORM.dias.includes(k)}" title="${DIAS_N[k]}">${c}</button>`).join('')}</div>
        <label class="hora"><span>às</span><input type="time" data-rot-hora value="${esc(ROT_FORM.hora)}"></label>
        <div class="row"><button class="btn sm accent" data-rot-salvar="${r.id}">Salvar</button>${r.agenda?.ativo ? `<button class="btn sm" data-rot-parar="${r.id}">Parar de repetir</button>` : ''}<button class="link soft" data-rot-fechar>Cancelar</button></div>
        <p class="fine">Roda enquanto o Vynco estiver aberto (se estiver fechado, roda quando você abrir). A peça vai para Revisar esperando você.</p></div>` : ''
    return `<article class="glass rot${rodando ? ' rodando' : ''}">
      <div class="rot-art">${wire(r.formato === 'imagem' ? 'gif' : r.formato)}</div>
      <div class="rot-c">
        <header><h3>${esc(r.titulo)}</h3><div class="vg-tags"><span class="vg-tag">${FMT_MOD[r.formato] || r.formato}</span>${r.web ? '<span class="vg-tag">pesquisa na web</span>' : ''}${r.design ? '<span class="vg-tag">design</span>' : ''}</div></header>
        <p>${esc(r.desc)}</p>
        <small class="rot-agenda${ag ? ' on' : ''}">${ag || `Sugestão: ${esc(r.freqTxt || '')}`}</small>
        ${est}
        <div class="row"><button class="btn sm${rodando ? '' : ' accent'}" data-run="${r.id}" ${rodando || !d.agente ? 'disabled' : ''}>${rodando ? 'Criando…' : 'Criar agora'}</button><button class="btn sm" data-rot-rep="${r.id}" aria-expanded="${ROT_AB === r.id}">${ag ? 'Mudar a repetição' : 'Repetir'}</button></div>
        ${form}
        ${u ? `<details class="more"><summary>O que a IA fez</summary><pre class="log">${esc(u.tail || '…')}</pre></details>` : ''}
      </div></article>`
  }
  const rec = recomendados(PERF_CR || {}, d.rotinas)
  $('[data-rot-rec]').innerHTML = rec.ids.length ? `<div class="cr-head"><h2>Recomendados para você</h2><p class="fine">${esc(rec.motivo)}</p></div><div class="rot-grid rec">${rec.ids.map(id => card(d.rotinas.find(r => r.id === id))).join('')}</div>` : ''
  const lista = d.rotinas.filter(r => !rec.ids.includes(r.id)).filter(r => ROT_F === 'todos' || (ROT_F === 'design' ? r.design : r.formato === ROT_F && !r.design))
  $('[data-rotinas]').innerHTML = lista.map(card).join('') || `<div class="es-vazio"><p>Nenhum modelo neste filtro.</p></div>`
}
// três modelos que combinam com o que a pessoa quer do LinkedIn (o mesmo critério da entrada)
const REC_OBJ = { 'Conseguir uma vaga': ['licao', 'bastidores', 'dicas'], 'Conseguir clientes': ['mito-verdade', 'dicas', 'recomendacao'], 'Ser referência na área': ['dicas', 'opiniao', 'passo-a-passo'], 'Fazer networking': ['pergunta', 'opiniao', 'bastidores'], 'Divulgar meu negócio': ['passo-a-passo', 'bastidores', 'mito-verdade'], 'Mudar de área': ['licao', 'recomendacao', 'pergunta'], 'Aprender em público': ['licao', 'recomendacao', 'dicas'] }
function recomendados(p, modelos) {
  const existe = id => modelos.some(m => m.id === id), objs = Object.keys(REC_OBJ).filter(o => String(p.objetivo || '').toLowerCase().includes(o.toLowerCase()))
  const ids = []
  if (existe('daily-ui') && /design|ux|ui\b/i.test(p.area || '')) ids.push('daily-ui')
  for (const o of objs) for (const id of REC_OBJ[o]) if (existe(id) && !ids.includes(id)) ids.push(id)
  for (const id of ['dicas', 'licao', 'pergunta']) if (existe(id) && !ids.includes(id)) ids.push(id)
  return { ids: ids.slice(0, 3), motivo: objs.length ? `Para quem quer ${listaE(objs.map(o => o.toLowerCase()))}. Cada um usa os seus pilares e o seu tom.` : 'Bons para começar. Conte o seu objetivo em Estratégia para recomendações mais certeiras.' }
}
async function rodar(id) {
  if (!ST) await status()
  if (!ST?.agente?.conectado) return falha(new Error('Conecte uma IA primeiro em Ajustes.'))
  try { await api('/api/run', { id }); Som.liga(); pill('Criando o seu post', 'Ele aparece em Revisar quando ficar pronto (de 2 a 10 minutos).', 'var(--violet)'); if (atual?.dataset.scene === 'rotinas') carregarRotinas() } catch (e) { falha(e) }
}
$('[data-rot-filtro]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ROT_F = b.dataset.v; Som.tique(); desenharRotinas() })
$('[data-rotinas]').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.dataset.rotRep) { const r = ROT.rotinas.find(x => x.id === b.dataset.rotRep); ROT_AB = ROT_AB === r.id ? null : r.id; ROT_FORM = { dias: r.agenda?.ativo ? [...r.agenda.dias] : r.freq === 'diario' ? [1, 2, 3, 4, 5] : [2], hora: r.agenda?.hora || '08:00' }; Som.tique(); return desenharRotinas() }
  if (b.dataset.rotDia != null) { const k = +b.dataset.rotDia; ROT_FORM.dias = ROT_FORM.dias.includes(k) ? ROT_FORM.dias.filter(x => x !== k) : [...ROT_FORM.dias, k]; Som.tique(); return desenharRotinas() }
  if (b.matches('[data-rot-fechar]')) { ROT_AB = null; return desenharRotinas() }
  const salvar = b.dataset.rotSalvar, parar = b.dataset.rotParar
  if (salvar || parar) {
    ROT_FORM.hora = $('[data-rot-hora]')?.value || ROT_FORM.hora
    if (salvar && !ROT_FORM.dias.length) return pill('Escolha pelo menos um dia', '', 'var(--amber)')
    try {
      await api('/api/rotinas/agendar', { id: salvar || parar, ativo: !!salvar, dias: ROT_FORM.dias, hora: ROT_FORM.hora })
      ROT_AB = null; salvar ? Som.liga() : Som.desliga()
      pill(salvar ? 'Repetição salva' : 'Não repete mais', salvar ? agendaTxt({ ativo: true, ...ROT_FORM }) : '', salvar ? 'var(--green)' : 'var(--amber)')
      carregarRotinas()
    } catch (err) { falha(err) }
  }
})

// ---------------------------------------------------------------- calendário: o que foi ao ar, o que está agendado e o que as rotinas vão criar
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = d => d.toTimeString().slice(0, 5)
const hoje0 = () => ymd(new Date())
let CAL = { ano: new Date().getFullYear(), mes: new Date().getMonth(), dia: hoje0() }, CAL_ROT = [], AG_ABA = 'mes'
async function carregarCalendario() {
  try { const [f, r] = await Promise.all([api('/api/queue'), api('/api/runs'), ST ? null : status()]); FILA = f; CAL_ROT = r.rotinas.filter(x => x.agenda?.ativo) } catch (e) { return falha(e) }
  desenharCalendario(); contarFila(); desenharAgAba()
}
function desenharAgAba() {
  const noar = AG_ABA === 'noar', pub = FILA.filter(i => i.published).sort((a, b) => String(b.published.quando || '').localeCompare(String(a.published.quando || '')))
  $$('[data-ag]').forEach(b => b.toggleAttribute('aria-current', b.dataset.ag === AG_ABA))
  const n = $('[data-ag-n]'); n.hidden = !pub.length; n.textContent = pub.length
  for (const sel of ['.cal-legenda', '.cal-grid', '.cal-nav']) { const el = $('[data-scene=calendario] ' + sel); if (el) el.hidden = noar }
  const box = $('[data-ag-noar]'); box.hidden = !noar
  if (noar) box.innerHTML = pub.length ? `<p class="fine noar-nota">O LinkedIn não deixa apps lerem curtidas, comentários ou alcance. Aqui fica o que saiu, quando e o link para ver no LinkedIn.</p>` + pub.map(i => `<article class="noar-it glass"><div class="noar-capa">${capa(i)}</div><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || ''} · publicado ${i.published.quando ? new Date(i.published.quando).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : ''}</small></span>${i.published.link ? `<a class="btn sm" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">Ver no LinkedIn ↗</a>` : ''}</article>`).join('')
    : `<div class="empty"><h3>Nada publicado ainda.</h3><p>Quando um post for ao ar, ele aparece aqui com a data e o link.</p><div class="cta small"><button class="btn sm accent" data-view="fila">Ir para Revisar</button></div></div>`
  if (noar) $('[data-cal-titulo]').textContent = 'No ar.'
  $('[data-cal-sub]').textContent = noar ? (pub.length ? `${pub.length} ${pub.length === 1 ? 'post publicado' : 'posts publicados'} pelo Vynco.` : 'O que foi ao ar aparece aqui.') : $('[data-cal-sub]').textContent
}
$('[data-ag-abas]')?.addEventListener('click', e => { const b = e.target.closest('[data-ag]'); if (!b) return; AG_ABA = b.dataset.ag; Som.tique(); if (AG_ABA === 'mes') desenharCalendario(); desenharAgAba() })
function eventos(ds) {
  const ev = []
  for (const i of FILA) {
    if (i.published?.quando && ymd(new Date(i.published.quando)) === ds) ev.push({ t: 'pub', i, hora: hhmm(new Date(i.published.quando)) })
    else if (i.agendado && ymd(new Date(i.agendado)) === ds) ev.push({ t: 'ag', i, hora: hhmm(new Date(i.agendado)) })
  }
  const dow = new Date(ds + 'T12:00').getDay()
  if (ds >= hoje0()) for (const r of CAL_ROT) if (r.agenda.dias.includes(dow) && !(ds === hoje0() && r.agenda.ultima === ds)) ev.push({ t: 'rot', r, hora: r.agenda.hora || '08:00' })
  return ev.sort((a, b) => a.hora.localeCompare(b.hora))
}
const chaveIt = i => `${i.kind}:${i.id}`
const semData = () => FILA.filter(i => !i.published && !i.agendado && !i.rascunho).sort((a, b) => (b.approved ? 1 : 0) - (a.approved ? 1 : 0))
function desenharCalendario() {
  const { ano, mes } = CAL, prim = new Date(ano, mes, 1), ini = new Date(ano, mes, 1 - prim.getDay()), hoje = hoje0()
  $('[data-cal-titulo]').innerHTML = `${MESES[mes][0].toUpperCase() + MESES[mes].slice(1)} <span class="soft">${ano}</span>`
  const doMes = FILA.filter(i => { const q = i.published?.quando || i.agendado; return q && new Date(q).getMonth() === mes && new Date(q).getFullYear() === ano })
  const nAg = doMes.filter(i => !i.published).length, nPub = doMes.filter(i => i.published).length
  $('[data-cal-sub]').textContent = nAg || nPub ? `${nPub} ${nPub === 1 ? 'post no ar' : 'posts no ar'} e ${nAg} ${nAg === 1 ? 'agendado' : 'agendados'} neste mês.` : 'Nada agendado neste mês ainda. Arraste um post da lista "Sem data" para um dia.'
  let h = DIAS_N.map(d => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')
  for (let k = 0; k < 42; k++) {
    const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + k), ds = ymd(d), ev = eventos(ds), fora = d.getMonth() !== mes
    if (k === 35 && fora) break   // não desenha a 6ª semana quando ela é toda do mês seguinte
    h += `<div class="cal-d${fora ? ' fora' : ''}${ds === hoje ? ' hoje' : ''}${ds === CAL.dia ? ' sel' : ''}${ds < hoje ? ' passado' : ''}" role="gridcell" tabindex="${ds === CAL.dia ? 0 : -1}" data-dia="${ds}" aria-label="${d.getDate()} de ${MESES[d.getMonth()]}: ${ev.length ? ev.length + (ev.length === 1 ? ' item' : ' itens') : 'vazio'}">
      <span class="cal-n">${d.getDate()}</span>
      ${ev.slice(0, 3).map(e => `<span class="cal-ev ${e.t}"${e.t === 'ag' ? ` draggable="true" data-arrasta="${esc(chaveIt(e.i))}"` : ''} title="${esc(e.hora + ' · ' + (e.i ? e.i.title : 'Rotina: ' + e.r.titulo))}"><i>${e.hora}</i>${esc(e.i ? e.i.title : e.r.titulo)}</span>`).join('')}
      ${ev.length > 3 ? `<span class="cal-mais">+${ev.length - 3}</span>` : ''}</div>`
  }
  $('[data-cal-mes]').innerHTML = h
  desenharDia(); desenharCalAvisos()
  const sem = semData()
  $('[data-cal-nsem]').textContent = sem.length || ''
  $('[data-cal-sem]').innerHTML = sem.length ? sem.map(i => `<div class="cal-it" draggable="true" data-arrasta="${esc(chaveIt(i))}"><span class="state ${estado(i)}"></span><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || ''} · ${estadoTxt(i)}</small></span></div>`).join('') : '<p class="fine">Nada esperando data. Peça um post novo em Criar.</p>'
}
function desenharDia() {
  const ds = CAL.dia, d = new Date(ds + 'T12:00'), ev = eventos(ds), passado = ds < hoje0(), sem = semData()
  $('[data-cal-dia]').innerHTML = `<header class="ed-box-h"><h3>${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>${ds === hoje0() ? '<span class="tag">hoje</span>' : ''}</header>
    <div class="cal-lista">${ev.length ? ev.map(e => e.t === 'rot'
      ? `<div class="cal-li rot"><i>${e.hora}</i><span><b>${esc(e.r.titulo)}</b><small>a sua IA cria e manda para Revisar</small></span><button class="link" data-view="rotinas">Ajustar</button></div>`
      : `<div class="cal-li ${e.t}"><i>${e.hora}</i><span><b>${esc(e.i.title)}</b><small>${e.t === 'pub' ? 'no ar' : e.i.approved ? 'agendado · sai sozinho' : 'agendado · falta aprovar'}</small></span>
          ${e.t === 'pub' ? `<a class="link" href="${esc(urlOk(e.i.published.link))}" target="_blank" rel="noopener">Ver ↗</a>` : `<span class="cal-li-a"><input type="time" value="${e.hora}" data-cal-hora="${esc(chaveIt(e.i))}" aria-label="Horário"><button class="link" data-cal-fila="${esc(chaveIt(e.i))}">Abrir</button><button class="link soft" data-cal-tirar="${esc(chaveIt(e.i))}">Tirar</button></span>`}</div>`).join('')
      : `<p class="fine">${passado ? 'Nada neste dia.' : 'Dia livre.'}</p>`}</div>
    ${!passado && sem.length ? `<div class="cal-add"><select data-cal-add aria-label="Post para agendar">${sem.map(i => `<option value="${esc(chaveIt(i))}">${esc(i.title)}${i.approved ? '' : ' (falta aprovar)'}</option>`).join('')}</select><input type="time" data-cal-add-hora value="${store.get('hora', '09:00')}" aria-label="Horário"><button class="btn sm accent" data-cal-agendar>Agendar</button></div>` : ''}`
}
const itemDe = k => FILA.find(i => chaveIt(i) === k)
// agenda um post num dia e hora; se ainda não estiver aprovado, pergunta se pode aprovar junto (só sai no horário o que você aprovou)
async function agendarItem(k, ds, hora) {
  const i = itemDe(k); if (!i) return
  if (ds < hoje0()) return pill('Esse dia já passou', 'Escolha hoje ou um dia futuro.', 'var(--amber)')
  hora = hora || (i.agendado ? hhmm(new Date(i.agendado)) : store.get('hora', '09:00'))
  let q = new Date(`${ds}T${hora}`)
  if (q < new Date()) { q = new Date(Date.now() + 36e5); q.setMinutes(0, 0, 0) }
  try {
    if (!i.approved) {
      if (!(await confirmar('Aprovar e agendar?', `"${i.title}" só vai ao ar sozinho se estiver aprovado. Olhe a prévia em Revisar se ainda não leu.`, 'Aprovar e agendar'))) return
      await api('/api/approve', { kind: i.kind, id: i.id })
    }
    await api('/api/agendar', { kind: i.kind, id: i.id, quando: q.toISOString() })
    store.set('hora', hhmm(q)); Som.liga()
    pill('Agendado', `${i.title} · ${q.toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, 'var(--green)')
    CAL.dia = ymd(q); await (atual?.dataset.scene === 'calendario' ? carregarCalendario() : carregarFila())
  } catch (e) { falha(e) }
}
async function tirarDaAgenda(k) {
  const i = itemDe(k); if (!i) return
  try { await api('/api/agendar', { kind: i.kind, id: i.id, quando: null }); Som.desliga(); pill('Fora da agenda', i.title, 'var(--amber)'); await (atual?.dataset.scene === 'calendario' ? carregarCalendario() : carregarFila()) } catch (e) { falha(e) }
}
function abrirNaFila(k) {
  const i = itemDe(k); if (!i) return
  if (i.published) { AG_ABA = 'noar'; voltarPara = null; return cena('calendario') }
  FILTRO = CONTA.pendente(i) ? 'pendente' : CONTA.pronto(i) ? 'pronto' : CONTA.publicado(i) ? 'publicado' : 'todos'
  foco = Math.max(0, visiveis().findIndex(x => chaveIt(x) === k)); verMais = false
  voltarPara = null; cena('fila')
}
const cal = $('[data-scene=calendario]')
cal.addEventListener('click', e => {
  const b = e.target.closest('[data-cal], [data-cal-tirar], [data-cal-fila], [data-cal-agendar]')
  if (b?.dataset.cal) { const m = b.dataset.cal; if (m === 'hoje') { const n = new Date(); CAL = { ano: n.getFullYear(), mes: n.getMonth(), dia: hoje0() } } else { const n = new Date(CAL.ano, CAL.mes + (m === 'prox' ? 1 : -1), 1); CAL.ano = n.getFullYear(); CAL.mes = n.getMonth() } Som.tique(); return desenharCalendario() }
  if (b?.dataset.calTirar) return tirarDaAgenda(b.dataset.calTirar)
  if (b?.dataset.calFila) return abrirNaFila(b.dataset.calFila)
  if (b?.matches('[data-cal-agendar]')) return agendarItem($('[data-cal-add]').value, CAL.dia, $('[data-cal-add-hora]').value)
  const d = e.target.closest('[data-dia]')
  if (d) { CAL.dia = d.dataset.dia; Som.tique(); $$('.cal-d', cal).forEach(x => { x.classList.toggle('sel', x === d); x.tabIndex = x === d ? 0 : -1 }); desenharDia() }
})
cal.addEventListener('change', e => { const t = e.target.closest('[data-cal-hora]'); if (t && t.value) agendarItem(t.dataset.calHora, CAL.dia, t.value) })
// teclado: setas andam pelos dias
cal.addEventListener('keydown', e => {
  const d = e.target.closest('[data-dia]'); if (!d) return
  const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return d.click() }
  if (!passo) return
  e.preventDefault()
  const n = new Date(d.dataset.dia + 'T12:00'); n.setDate(n.getDate() + passo); CAL.dia = ymd(n)
  if (n.getMonth() !== CAL.mes) { CAL.ano = n.getFullYear(); CAL.mes = n.getMonth() }
  desenharCalendario(); $(`[data-dia="${CAL.dia}"]`, cal)?.focus()
})
// arrastar e soltar: da lista "Sem data" ou de um dia para outro
cal.addEventListener('dragstart', e => { const a = e.target.closest('[data-arrasta]'); if (!a) return; e.dataTransfer.setData('text/plain', a.dataset.arrasta); e.dataTransfer.effectAllowed = 'move'; a.classList.add('arrastando') })
cal.addEventListener('dragend', e => { e.target.closest('[data-arrasta]')?.classList.remove('arrastando'); $$('.cal-d.alvo', cal).forEach(x => x.classList.remove('alvo')) })
cal.addEventListener('dragover', e => { const d = e.target.closest('[data-dia]'); if (!d || d.dataset.dia < hoje0()) return; e.preventDefault(); $$('.cal-d.alvo', cal).forEach(x => x !== d && x.classList.remove('alvo')); d.classList.add('alvo') })
cal.addEventListener('drop', e => { const d = e.target.closest('[data-dia]'); if (!d) return; e.preventDefault(); d.classList.remove('alvo'); const k = e.dataTransfer.getData('text/plain'); if (k) agendarItem(k, d.dataset.dia) })

// ---------------------------------------------------------------- menu da conta (Ajustes mora aqui)
function desenharMenuConta() {
  if (!ST) return
  const l = ST.linkedin, a = ST.agente
  const P = LIM?.principal, R = LIM?.reserva
  $('#conta-menu').innerHTML = `<div class="cm-h"><span class="avatar" style="${l.foto ? `background-image:url('${esc(l.foto)}');color:transparent` : ''}">${inicial(l.name || 'Você')}</span><span><b>${esc(l.name || 'Você')}</b><small>${l.connected ? (venceLogo(l) ? `LinkedIn vence ${prazo(l.dias)}` : 'LinkedIn conectado') : 'LinkedIn não conectado'} · ${a ? esc(a.nome) + (a.conectado ? '' : ' (falta entrar)') : 'sem IA'}</small></span></div>
    <div class="cm-sec"><div class="cm-sec-h"><span class="cx-ic sm" style="--c:${l.connected && !venceLogo(l) ? 'var(--green)' : 'var(--amber)'};color:#fff;background:var(--li)">${GLIFO.linkedin}</span><b>LinkedIn</b><small>${l.connected ? `válido até ${quando(l.expiresAt)}` : 'não conectado: nada vai ao ar'}</small></div></div>
    <div class="cm-sec"><div class="cm-sec-h"><span class="cx-ic sm">${glifo(a ? a.id : '?')}</span><b>${a ? esc(a.nome) : 'Sem IA'}</b><small>${a ? (a.conectado ? 'IA principal' : 'falta entrar na conta') : 'escolha uma em Ajustes'}</small></div>${barrasUso(P)}</div>
    ${LIM?.imagem ? `<div class="cm-sec"><div class="cm-sec-h"><span class="cx-ic sm mg-ic" style="--c:${LIM.imagem.temChave ? 'var(--green)' : 'var(--faint)'}">M</span><b>Magnific</b><small>${LIM.imagem.temChave ? 'imagens com IA' : 'sem chave: ligue em Ajustes'}</small></div>${LIM.imagem.temChave ? barrasUso({ medidor: true, janelas: [{ rotulo: `Operações este mês (${LIM.imagem.operacoes} de ${LIM.imagem.limiteMensal})`, pct: Math.round(100 * LIM.imagem.operacoes / Math.max(1, LIM.imagem.limiteMensal)), renova: null }, { rotulo: `Gasto estimado (€${LIM.imagem.gasto.toFixed(2)} de €${LIM.imagem.orcamentoMensal})`, pct: Math.round(100 * LIM.imagem.gasto / Math.max(0.01, LIM.imagem.orcamentoMensal)), renova: null }] }) + `<p class="uso-nota">Os limites são os que você definiu em Ajustes. A API do Magnific não informa o saldo da conta: ${LIM.imagem.site ? `<a class="link" href="${esc(urlOk(LIM.imagem.site))}" target="_blank" rel="noopener">ver os créditos no site ↗</a>` : 'confira no site'}.</p>` : ''}</div>` : ''}
    <div class="cm-sec"><div class="cm-sec-h"><span class="cx-ic sm">${glifo(ST.reserva ? ST.reserva.id : '?')}</span><b>${ST.reserva ? esc(ST.reserva.nome) : 'Sem IA reserva'}</b><small>${ST.reserva ? 'assume se a principal falhar' : 'ligue em Ajustes: o Gemini é grátis'}</small></div>${ST.reserva ? barrasUso(R) : ''}</div>
    <button role="menuitem" data-cm="ajustes"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Ajustes<small>LinkedIn, IA, imagens, som e tema</small></span></button>
    <button role="menuitem" data-cm="tour"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m6.2 9.8 1-3 3-1-1 3z" fill="currentColor"/></svg><span>Tour pelo app<small>onde fica cada coisa, em 1 minuto</small></span></button>
    <button role="menuitem" data-cm="atalhos"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4" width="13" height="8.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7h1M7 7h1M10 7h2M5 9.8h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Atalhos de teclado<small>aperte ? em qualquer tela</small></span></button>`
}
function menuConta(abrir) {
  const m = $('#conta-menu'), b = $('#conns'), on = abrir ?? m.hidden
  if (on) { desenharMenuConta(); carregarLimites() }
  m.hidden = !on; b.setAttribute('aria-expanded', on)
  if (on) $('button', m)?.focus()
}
$('#conta-menu').addEventListener('click', e => { const b = e.target.closest('[data-cm]'); if (!b) return; menuConta(false); if (b.dataset.cm === 'atalhos') return $('#atalhos').showModal(); if (b.dataset.cm === 'tour') return tourIniciar(); voltarPara = null; cena(b.dataset.cm) })
document.addEventListener('click', e => { if (!e.target.closest('#conta')) menuConta(false) })
$('#conta-menu').addEventListener('keydown', e => {
  const bs = $$('#conta-menu button'), k = bs.indexOf(document.activeElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(k + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus() }
  if (e.key === 'Escape') { e.stopPropagation(); menuConta(false); $('#conns').focus() }
})
// número de posts esperando você, ao lado de "Fila"
// ---------------------------------------------------------------- fluxo do post: Criar → Revisar → Agendar → No ar
// a mesma faixa aparece em Criar, Fila e Calendário; cada etapa leva para onde aquilo se resolve
let FLUXO_RUNS = 0
function desenharFluxo() {
  const mes = new Date().getMonth()
  const n = {
    criar: FLUXO_RUNS,
    revisar: FILA.filter(i => !i.published && !i.approved && !i.rascunho).length,
    agendar: FILA.filter(i => !i.published && i.approved && !i.rascunho && !i.agendado).length,
    noar: FILA.filter(i => i.agendado && !i.published).length,
  }
  const pub = FILA.filter(i => i.published?.quando && new Date(i.published.quando).getMonth() === mes).length
  const etapas = [
    ['criar', 'Criar', FLUXO_RUNS ? `${FLUXO_RUNS} sendo ${FLUXO_RUNS === 1 ? 'criado' : 'criados'}` : 'peça um post à sua IA'],
    ['revisar', 'Revisar', n.revisar ? `${n.revisar} ${n.revisar === 1 ? 'esperando' : 'esperando'} você` : 'nada esperando'],
    ['agendar', 'Agendar', n.agendar ? `${n.agendar} ${n.agendar === 1 ? 'aprovado' : 'aprovados'} sem data` : 'tudo com data'],
    ['noar', 'No ar', `${n.noar} ${n.noar === 1 ? 'agendado' : 'agendados'} · ${pub} ${pub === 1 ? 'publicado' : 'publicados'} no mês`],
  ]
  for (const nav of $$('[data-fluxo]')) {
    const aqui = nav.dataset.fluxo
    nav.innerHTML = etapas.map(([k, t, sub], i) => `${i ? '<span class="fx-seta" aria-hidden="true"></span>' : ''}<button type="button" class="fx${k === aqui ? ' on' : ''}${(k === 'revisar' && n.revisar) || (k === 'agendar' && n.agendar) ? ' tem' : ''}" data-fx="${k}"${k === aqui ? ' aria-current="step"' : ''}><span class="fx-n">${i + 1}</span><span><b>${t}</b><small>${sub}</small></span></button>`).join('')
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fx]'); if (!b) return
  const k = b.dataset.fx; Som.tique(); voltarPara = null
  if (k === 'criar') return cena('rotinas')
  if (k === 'revisar') { FILTRO = 'pendente'; foco = 0; return atual?.dataset.scene === 'fila' ? carregarFila() : cena('fila') }
  if (k === 'agendar') { FILTRO = 'pronto'; foco = 0; return atual?.dataset.scene === 'fila' ? carregarFila() : cena('fila') }
  if (k === 'noar') return cena('calendario')
})
// os próximos 7 dias, em cima da fila: o calendário sem sair dela
function desenharSemana() {
  const el = $('[data-semana]'); if (!el) return
  const dias = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return d })
  el.innerHTML = `<span class="sm-t">Próximos 7 dias</span>` + dias.map((d, k) => {
    const ds = ymd(d), ev = FILA.filter(i => (i.agendado && !i.published && ymd(new Date(i.agendado)) === ds) || (i.published?.quando && ymd(new Date(i.published.quando)) === ds))
    return `<button type="button" class="sm-d${ev.length ? ' tem' : ''}${k === 0 ? ' hoje' : ''}" data-semana-dia="${ds}" title="${esc(ev.map(i => i.title).join(' · ') || 'Dia livre')}"><small>${k === 0 ? 'hoje' : DIAS_N[d.getDay()]}</small><b>${d.getDate()}</b><i>${ev.length ? ev.length + (ev.length === 1 ? ' post' : ' posts') : 'livre'}</i></button>`
  }).join('') + '<button type="button" class="link sm-ver" data-view="calendario">Ver o calendário</button>'
}
$('[data-semana]')?.addEventListener('click', e => { const b = e.target.closest('[data-semana-dia]'); if (!b) return; CAL.dia = b.dataset.semanaDia; const d = new Date(CAL.dia + 'T12:00'); CAL.ano = d.getFullYear(); CAL.mes = d.getMonth(); voltarPara = null; cena('calendario') })
// próximo horário livre: o próximo dia útil sem post marcado, no horário de sempre
function proximoLivre() {
  const [hh, mm] = store.get('hora', '09:00').split(':').map(Number)
  const ocupado = new Set(FILA.filter(i => i.agendado && !i.published).map(i => ymd(new Date(i.agendado))))
  const d = new Date(); d.setHours(hh, mm, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1)
  for (let k = 0; k < 60; k++) { if (![0, 6].includes(d.getDay()) && !ocupado.has(ymd(d))) return d; d.setDate(d.getDate() + 1) }
  return d
}
function contarFila() { desenharFluxo(); desenharSemana(); { const lim = Date.now() + 7 * 864e5, na = FILA.filter(i => i.agendado && !i.published && new Date(i.agendado).getTime() <= lim).length, e = $('[data-nav-n=agenda]'); if (e) { e.hidden = !na; e.textContent = na; e.setAttribute('aria-label', `${na} agendados nos próximos 7 dias`) } } const n = FILA.filter(CONTA.pendente).length, el = $('[data-nav-n=fila]'); el.hidden = !n; el.textContent = n; el.setAttribute('aria-label', `${n} ${n === 1 ? 'post esperando' : 'posts esperando'} você`) }

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
  desenharReserva(); desenharStandby()
  const dok = d.mcpOk
  linha('desigma', dok ? (d.registered ? 'var(--green)' : 'var(--amber)') : 'var(--faint)', dok ? (d.registered ? 'Ligado à sua IA: cada peça vira um quadro editável.' : 'Encontrado. Sincronize para ligar à sua IA.') : 'Não encontrado neste computador. É opcional.',
    dok ? '' : '<a class="link" href="https://github.com/deepfounder-ai/desigma/releases" target="_blank" rel="noopener">Baixar</a>')
  const f = $('[data-form=desigma]'); for (const k of ['exe', 'mcpExe', 'workspace', 'project']) if (document.activeElement !== f[k]) f[k].value = d[k] || ''
  const fc = $('[data-form=config]'); if (document.activeElement !== fc.assetsDir) fc.assetsDir.value = config.assetsDir || ''; if (document.activeElement !== fc.dailyUiStart) fc.dailyUiStart.value = config.dailyUiStart || ''
  marcarPrefs()
}
function desenharReserva() {
  if (!ST) return
  const r = ST.reserva, x = LIM?.reserva, row = $('[data-conn=reserva]'); if (!row) return
  $('[data-res-ic]', row).innerHTML = glifo(r ? r.id : 'gemini')
  $('[data-res-n]', row).innerHTML = r ? `IA reserva · ${esc(r.nome)}` : 'IA reserva <small class="opt">recomendado</small>'
  $('.c-ic', row).style.setProperty('--c', r ? (r.conectado ? 'var(--green)' : 'var(--amber)') : 'var(--faint)')
  $('[data-conn-t]', row).innerHTML = r ? (r.conectado ? `Se a principal chegar ao limite ou falhar, o ${esc(r.nome)} cria no lugar. O post vai para Revisar como sempre.${r.sincronizado ? '' : ' Falta sincronizar.'}` : `Falta entrar na conta do ${esc(r.nome)}.`) + (x ? `<span class="uso-mini">${barrasUso(x)}</span>` : '')
    : 'Quando a sua IA chega ao limite de uso, o Vynco não cria nada. Com uma reserva, outra IA assume. O Gemini é grátis com uma conta Google (cerca de 1.000 pedidos por dia).'
  $('[data-conn-a]', row).innerHTML = RES_ON ? `<span class="soft">${esc(RES_ON)}</span>${RES_JANELA ? `<button class="link" data-act="res-janela" data-res="${RES_JANELA}">Não abriu? Abrir numa janela</button>` : ''}` : r ? `${r.conectado && r.sincronizado ? '' : `<button class="btn sm accent" data-act="res-ligar" data-res="${r.id}">Terminar</button>`}<button class="link soft" data-act="res-tirar">Tirar</button>`
    : `<button class="btn sm accent" data-act="res-ligar" data-res="${ST.agente?.id === 'gemini' ? 'claude' : 'gemini'}">Usar o ${ST.agente?.id === 'gemini' ? 'Claude' : 'Gemini'}${ST.agente?.id === 'gemini' ? '' : ' (grátis)'}</button>`
}
let RES_ON = '', RES_JANELA = ''
async function ligarReserva(id) {
  const nome = { claude: 'Claude', gemini: 'Gemini', codex: 'ChatGPT' }[id] || id
  const passo = t => { RES_ON = t; desenharReserva() }
  try {
    passo('Conferindo…')
    let r = await api('/api/agente/reserva', { id })
    if (!r.conectado) {
      passo(r.instalado ? `Abrindo o login do ${nome}…` : `Instalando o ${nome}…`)
      let j = await api('/api/agente/login', { id })
      const t0 = Date.now()
      while (!['ok', 'erro'].includes(j.fase)) { await espera(DEMO ? 300 : 1500); j = await api('/api/agente/job?id=' + id); if (!j.fase) break; RES_JANELA = Date.now() - t0 > 20000 ? id : ''; passo(j.msg || 'Entrando…') }
      RES_JANELA = ''
      if (j.fase !== 'ok') throw new Error(j.msg || `Não deu para entrar no ${nome}.`)
    }
    passo('Ensinando as regras do Vynco…')
    let s2; try { s2 = await api('/api/sync', { id, reserva: true }) } catch (e) { if (e.status !== 409) throw e; s2 = await api('/api/sync') }
    while (!s2.fim) { await espera(DEMO ? 220 : 800); s2 = await api('/api/sync') }
    if (s2.passos?.some(p => p.estado === 'falhou')) throw new Error(s2.passos.find(p => p.estado === 'falhou').detalhe || 'a sincronização falhou')
    Som.liga(); pill(`${nome} é a sua IA reserva`, 'Se a principal chegar ao limite, ele assume.', 'var(--green)')
  } catch (e) { falha(e) } finally { RES_ON = ''; ST = null; await status(); carregarLimites(true); desenharReserva() }
}
function desenharStandby() {
  const box = $('[data-standby]'); if (!box || !ST) return
  const sb = ST.standby || {}; box.hidden = !sb.disponivel
  $$('[data-standby-v]', box).forEach(b => b.classList.toggle('on', (b.dataset.standbyV === '1') === !!sb.ligado))
}
$('[data-standby]')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-standby-v]'); if (!b) return
  try { const sb = await api('/api/standby', { ligar: b.dataset.standbyV === '1' }); if (ST) ST.standby = sb; Som.tique(); desenharStandby(); pill(sb.ligado ? 'O Vynco abre com o Windows' : 'O Vynco não abre mais com o Windows', sb.ligado ? 'Ele fica na bandeja e publica no horário.' : 'Lembre de abrir o app nos horários agendados.', sb.ligado ? 'var(--green)' : 'var(--amber)'); if (atual?.dataset.scene === 'inicio') desenharInicio() } catch (err) { falha(err) }
})
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
  if (t.matches('[data-goscene]')) { const de = atual.dataset.scene; voltarPara = ['fila', 'rotinas', 'ajustes', 'perfil', 'calendario', 'rede', 'biblioteca'].includes(de) ? de : voltarPara; return cena(t.dataset.goscene) }
  if (t.matches('[data-run]')) return rodar(t.dataset.run)
  if (t.matches('[data-agent]')) return entrarCom(t.dataset.agent)
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
  if (t.matches('[data-atalhos]')) { Som.tique(); return $('#atalhos').showModal() }
  if (t.id === 'back') return voltar()
  if (t.id === 'conns') return menuConta()
  const act = t.dataset.act; if (!act) return
  try {
    if (act === 'res-ligar') return ligarReserva(t.dataset.res)
    if (act === 'res-janela') { await api('/api/agente/login', { id: t.dataset.res, console: true }); return pill('Abri uma janela de login', 'Siga o que aparece nela. O Vynco percebe sozinho quando terminar.', 'var(--violet)') }
    if (act === 'res-tirar') { await api('/api/agente/reserva', { id: null }); ST = null; await status(); Som.desliga(); return pill('Sem IA reserva', 'Se a principal chegar ao limite, nada é criado até ela voltar.', 'var(--amber)') }
    if (act === 'standby-ligar') { const sb = await api('/api/standby', { ligar: true }); if (ST) ST.standby = sb; Som.liga(); pill('O Vynco abre com o Windows', 'Ele fica na bandeja e publica no horário.', 'var(--green)'); return desenharInicio() }
    if (act === 'li-connect' || act === 'li-reopen') return conectarLinkedin()
    if (act === 'li-cancel') return cancelarLinkedin()
    if (act === 'li-proprio') return abrirAssistente()
    if (act === 'li-again') { voltarPara = atual.dataset.scene; cena('linkedin'); return setTimeout(conectarLinkedin, 450) }
    if (act === 'li-add') { if (await confirmar('Entrar com outra conta?', 'Antes, saia do LinkedIn no navegador (ou use outro perfil do navegador). Senão o LinkedIn entra direto com a conta que já está aberta.', 'Continuar')) { voltarPara = atual.dataset.scene; cena('linkedin'); setTimeout(conectarLinkedin, 450) } return }
    if (act === 'li-off') {
      const c = (ST?.linkedin?.contas || []).find(x => x.ativa), varias = (ST?.linkedin?.contas || []).length > 1
      if (await confirmar(`Desconectar ${c ? c.nome : 'o LinkedIn'}?`, varias ? 'A outra conta conectada passa a ser a usada para publicar.' : 'O Vynco para de conseguir publicar até você conectar de novo.', 'Desconectar')) { await api('/api/linkedin/disconnect', c ? { id: c.id } : {}); Som.desliga(); status() }
      return
    }
    if (act === 'outros') return menuOutros()
    if (act === 'login-console') return LOGIN && entrarCom(LOGIN.id, { console: true })
    if (act === 'login-cancel') return cancelarLogin()
    if (act === 'sync-again') { if (atual.dataset.scene === 'sync') { $('[data-sync-cta]').hidden = true; return entrarSync() } voltarPara = atual.dataset.scene; return cena('sync') }
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
  if (atual?.dataset.scene === 'voce' && !$('dialog[open]') && !e.target.closest('textarea, select')) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if ((k !== 'Enter' || !e.target.closest('button, a')) && teclaVoce(e, k)) return }
  if (e.target.closest('input, textarea, select') || $('dialog[open]')) return
  if (e.key === '?') { e.preventDefault(); menuConta(false); return $('#atalhos').showModal() }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const nome = atual?.dataset.scene
  lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, true)
  if (k === 'Escape') { if (!$('#conta-menu').hidden) return menuConta(false); if ($('.dd[data-open]')) return menuOutros(false); if (ONB.includes(nome) || voltarPara) return voltar() }
  if (k === 'Enter' && ONB.includes(nome) && !e.target.closest('button, a, summary')) {
    e.preventDefault()
    if (nome === 'ola') return proximaCena()
    if (nome === 'linkedin') return $('[data-li]').dataset.li === 'ok' ? proximaCena() : $('[data-li]').dataset.li === 'idle' ? conectarLinkedin() : null
    if (nome === 'sync') return !$('[data-sync-cta]').hidden && $('[data-sync-cta] [data-next]') ? proximaCena() : null
    if (nome === 'estrategia') return $('[data-est-cta] .btn.accent')?.click()
  }
  if (nome === 'fila') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); foco += k === 'ArrowRight' ? 1 : -1; verMais = false; Som.tique(); desenharFila(); $(`[data-strip] .post[data-n="${foco}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }) }
    if (k === 'a') acao('toggle')
    if (k === 'p') acao('publish')
  }
})
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, false) })

// ---------------------------------------------------------------- avisos que ficam (erros e coisas que terminaram enquanto você fazia outra coisa)
// a pílula do topo continua para confirmações rápidas; o que precisa de atenção fica aqui até você fechar ou clicar
function avisoFixo({ tipo = 'info', titulo, texto = '', acao = null }) {
  const box = $('#avisos'); if (!box) return
  const el = document.createElement('div'); el.className = 'aviso-fixo ' + tipo; el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status')
  el.innerHTML = `<span class="af-ic" aria-hidden="true"></span><span class="af-t"><b>${esc(titulo)}</b>${texto ? `<small>${esc(texto)}</small>` : ''}</span>${acao ? `<button class="btn sm${tipo === 'erro' ? '' : ' accent'}" type="button" data-af-acao>${esc(acao.rotulo)}</button>` : ''}<button class="af-x" type="button" aria-label="Fechar aviso">×</button>`
  el.querySelector('.af-x').onclick = () => el.remove()
  if (acao) el.querySelector('[data-af-acao]').onclick = () => { el.remove(); acao.fn() }
  box.prepend(el)
  while (box.children.length > 4) box.lastElementChild.remove()
  if (tipo === 'info') setTimeout(() => el.remove(), 10000)
}

// ---------------------------------------------------------------- o que a sua IA está fazendo (de qualquer tela)
let ATIV = { rotinas: [], analise: null, rede: null, avisos: [] }, ativT = null, ativPrimeira = true
const ATIV_VISTO = { runs: {}, analise: null, rede: null, aviso: +store.get('aviso-visto', 0) || 0 }
const listaE = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || ''
async function vigiar() {
  clearTimeout(ativT)
  if (DEMO) return
  let a; try { a = await api('/api/atividade') } catch { ativT = setTimeout(vigiar, 15000); return }
  const aqui = atual?.dataset.scene
  // criações que terminaram
  for (const r of a.rotinas) {
    const k = r.id + ':' + r.inicio, antes = ATIV_VISTO.runs[k]
    if (!ativPrimeira && antes === 'rodando' && r.status !== 'rodando') {
      if (r.status === 'concluída') { Som.liga(); avisoFixo({ tipo: 'ok', titulo: `Pronto: ${r.titulo}`, texto: 'O post está em Revisar esperando você.', acao: { rotulo: 'Revisar agora', fn: () => { FILTRO = 'pendente'; foco = 0; voltarPara = null; cena('fila') } } }) }
      else { Som.erro(); avisoFixo({ tipo: 'erro', titulo: `${r.titulo} não deu certo`, texto: 'Veja o que a IA fez e tente de novo.', acao: { rotulo: 'Ver em Criar', fn: () => { voltarPara = null; cena('rotinas') } } }) }
      if (aqui === 'fila') carregarFila(); if (aqui === 'rotinas') carregarRotinas()
    }
    ATIV_VISTO.runs[k] = r.status
  }
  // análise do perfil (a tela Perfil e o fim da entrada já acompanham a deles)
  const an = a.analise?.estado
  if (!ativPrimeira && ATIV_VISTO.analise === 'rodando' && an && an !== 'rodando' && !['perfil', 'estrategia'].includes(aqui)) {
    an === 'pronto' ? avisoFixo({ tipo: 'ok', titulo: 'A sua IA terminou de ler o seu perfil', texto: 'Veja as sugestões e aplique o que fizer sentido.', acao: { rotulo: 'Ver sugestões', fn: () => { voltarPara = null; cena('perfil') } } })
      : avisoFixo({ tipo: 'erro', titulo: 'A análise do perfil não deu certo', texto: a.analise.erro || 'Tente de novo em Estratégia.', acao: { rotulo: 'Abrir Estratégia', fn: () => { voltarPara = null; cena('perfil') } } })
  }
  ATIV_VISTO.analise = an || null
  // busca da Rede
  const rd = a.rede?.estado
  if (!ativPrimeira && ATIV_VISTO.rede === 'rodando' && rd && rd !== 'rodando' && aqui !== 'rede') {
    rd === 'pronto' ? avisoFixo({ tipo: 'ok', titulo: 'Sugestões da Rede prontas', texto: 'Conexões e vagas para a sua área.', acao: { rotulo: 'Ver', fn: () => { voltarPara = null; cena('rede') } } })
      : avisoFixo({ tipo: 'erro', titulo: 'A busca da Rede não deu certo', texto: a.rede.erro || 'Tente de novo.', acao: { rotulo: 'Abrir Rede', fn: () => { voltarPara = null; cena('rede') } } })
  }
  ATIV_VISTO.rede = rd || null
  // avisos da agenda e das repetições (o app pode ter reaberto: a numeração recomeça)
  const maior = Math.max(0, ...a.avisos.map(x => x.n))
  if (maior < ATIV_VISTO.aviso) ATIV_VISTO.aviso = 0
  for (const x of a.avisos.filter(x => x.n > ATIV_VISTO.aviso).reverse()) {
    avisoFixo({ tipo: x.ok ? 'ok' : 'erro', titulo: x.titulo, texto: x.texto, acao: x.chave && !x.ok ? { rotulo: 'Ver o post', fn: () => abrirNaFila(x.chave) } : x.link ? { rotulo: 'Ver no LinkedIn', fn: () => abrirFora(x.link) } : null })
  }
  ATIV_VISTO.aviso = Math.max(ATIV_VISTO.aviso, maior); store.set('aviso-visto', ATIV_VISTO.aviso)
  ATIV = a; ativPrimeira = false; desenharAtiv()
  if (aqui === 'fila') detalhe(); if (aqui === 'calendario') desenharCalAvisos()
  const algo = a.rotinas.some(r => r.status === 'rodando') || an === 'rodando' || rd === 'rodando'
  ativT = setTimeout(vigiar, algo ? 4000 : 15000)
}
function desenharAtiv() {
  const el = $('#ativ'); if (!el) return
  const n = ATIV.rotinas.filter(r => r.status === 'rodando').length, partes = []
  if (n) partes.push(n === 1 ? 'criando 1 post' : `criando ${n} posts`)
  if (ATIV.analise?.estado === 'rodando') partes.push('lendo o seu perfil')
  if (ATIV.rede?.estado === 'rodando') partes.push(ATIV.rede.tipo === 'vagas' ? 'buscando vagas' : ATIV.rede.tipo === 'conexoes' ? 'buscando conexões' : 'buscando conexões e vagas')
  el.hidden = !partes.length
  el.dataset.ir = n ? 'rotinas' : ATIV.analise?.estado === 'rodando' ? 'perfil' : 'rede'
  $('[data-ativ-t]', el).textContent = `A sua IA está ${listaE(partes)}`
  el.title = 'Ver o andamento'
}
$('#ativ')?.addEventListener('click', e => { const ir = e.currentTarget.dataset.ir; if (ONB.includes(atual?.dataset.scene)) return; voltarPara = null; cena(ir) })
// avisos da agenda na Agenda
function desenharCalAvisos() {
  const box = $('[data-cal-avisos]'); if (!box) return
  box.innerHTML = ATIV.avisos.slice(0, 3).map(a => `<div class="cr-aviso ${a.ok ? 'ok' : 'bad'}"><span class="dot"></span><span><b>${esc(a.titulo)}</b> · ${esc(a.texto)}</span>${a.chave && !a.ok ? `<button class="link" type="button" data-cal-fila="${esc(a.chave)}">Ver o post</button>` : a.link ? `<a class="link" href="${esc(urlOk(a.link))}" target="_blank" rel="noopener">Ver no LinkedIn ↗</a>` : ''}</div>`).join('')
}

// ---------------------------------------------------------------- fim da entrada: a sua estratégia
// a análise começa quando a IA termina de sincronizar; aqui a pessoa vê o resultado e escolhe o que usar
let ESTR = null, estT = null
const EST_CAMPOS = [['area', 'Área de atuação'], ['publico', 'Para quem você escreve'], ['objetivo', 'Objetivo no LinkedIn'], ['tom', 'Tom de voz']]
async function entrarEstrategia() {
  clearTimeout(estT)
  let d; try { d = await api('/api/perfil') } catch (e) { return falha(e) }
  const marcados = ESTR?.marcados
  ESTR = { perfil: d.perfil, estado: d.analise, agente: d.agente, marcados: marcados || null, usada: ESTR?.usada || false }
  desenharEstrategia()
  if (d.analise?.estado === 'rodando') estT = setTimeout(() => atual?.dataset.scene === 'estrategia' && entrarEstrategia(), 3000)
}
function aplicarAnalise(P, a, chaves) {   // as mesmas regras do botão "Aplicar" em Perfil
  for (const k of chaves) {
    if (['area', 'publico', 'objetivo', 'tom'].includes(k) && a[k]) P[k] = a[k]
    if (k === 'temas' && a.temas?.length) P.temas = a.temas.filter(Boolean)
    if (k === 'cores') { for (const [c, v] of Object.entries(a.cores || {})) if (corOk(v) && c in P.marca.cores) P.marca.cores[c] = v; if (a.estilo_visual) P.marca.estilo = a.estilo_visual }
    if (k === 'pilares') for (const p of a.pilares || []) if (p.tema && !P.pilares.some(x => x.tema.toLowerCase() === p.tema.toLowerCase())) P.pilares.push({ tema: p.tema, por_que: p.por_que || '', ideias: (p.ideias || []).filter(Boolean) })
  }
  return P
}
function desenharEstrategia() {
  const p = ESTR.perfil, st = ESTR.estado, a = (st?.estado === 'pronto' && st.resultado) || p.analise, rodando = st?.estado === 'rodando'
  const t = $('[data-est-t]'), s = $('[data-est-s]'), corpo = $('[data-est]'), cta = $('[data-est-cta]')
  const fim = `<button class="btn accent lg" type="button" data-est-criar>Criar meu primeiro post</button><button class="btn lg" type="button" data-finish>Ir para Revisar</button>`
  if (rodando) {
    t.innerHTML = 'Lendo o seu perfil…'
    s.textContent = `A sua IA${ESTR.agente ? ` (${ESTR.agente})` : ''} está lendo as suas respostas e os seus links para sugerir a sua estratégia. Leva de 30 segundos a alguns minutos.`
    corpo.innerHTML = `<ol class="steps glass est-espera"><li class="run"><span class="ic"></span><span><b>Entendendo a sua área e o seu público</b><small>a partir das perguntas e das plataformas que você colou</small></span></li><li><span class="ic"></span><span><b>Sugerindo tom, temas e pilares de conteúdo</b><small>nada muda no seu perfil sem você escolher</small></span></li></ol>`
    cta.innerHTML = `<button class="link soft" type="button" data-finish>Continuar sem esperar (as sugestões ficam em Estratégia)</button>`
    return
  }
  if (a && (a.area || a.resumo || (a.pilares || []).length)) {
    if (!ESTR.marcados) ESTR.marcados = Object.fromEntries([...EST_CAMPOS.map(c => c[0]), 'temas', 'pilares', 'cores'].map(k => [k, true]))
    const m = ESTR.marcados, caixa = (k, rot, conteudo) => conteudo ? `<label class="est-c${m[k] ? ' on' : ''}"><input type="checkbox" data-est-k="${k}"${m[k] ? ' checked' : ''}${ESTR.usada ? ' disabled' : ''}><span class="est-h"><small>${rot}</small></span><span class="est-v">${conteudo}</span></label>` : ''
    t.innerHTML = ESTR.usada ? 'Pronto. <span class="soft">A sua IA já escreve com isso.</span>' : 'Sua estratégia.'
    s.textContent = ESTR.usada ? 'Agora é criar. A sua IA faz o primeiro post a partir de um dos seus pilares, e ele chega em Revisar para você olhar.' : 'A sua IA juntou as suas respostas e os seus links. Marque o que quer usar; dá para mudar tudo depois em Estratégia.'
    corpo.innerHTML = `${a.resumo ? `<p class="est-resumo glass">${esc(a.resumo)}</p>` : ''}<div class="est-grade">
      ${EST_CAMPOS.map(([k, rot]) => caixa(k, rot, a[k] ? esc(Array.isArray(a[k]) ? a[k].join(', ') : a[k]) : '')).join('')}
      ${caixa('temas', 'Temas', (a.temas || []).length ? esc(a.temas.join(', ')) : '')}
      ${caixa('cores', 'Cores da sua marca', Object.values(a.cores || {}).filter(corOk).length ? `<span class="est-cores">${Object.values(a.cores).filter(corOk).map(c => `<i style="background:${c}" title="${c}"></i>`).join('')}</span>${a.estilo_visual ? `<small>${esc(a.estilo_visual)}</small>` : ''}` : '')}
    </div>
    ${(a.pilares || []).length ? `<div class="est-pilares">${caixa('pilares', 'Pilares de conteúdo', `<ul>${a.pilares.map(x => `<li><b>${esc(x.tema)}</b>${x.por_que ? ` · ${esc(x.por_que)}` : ''}${(x.ideias || [])[0] ? `<small>ideia: ${esc(x.ideias[0])}</small>` : ''}</li>`).join('')}</ul>`)}</div>` : ''}`
    cta.innerHTML = ESTR.usada ? fim : `<button class="btn accent lg" type="button" data-est-usar>Usar esta estratégia</button><button class="link soft" type="button" data-finish>Pular, ver depois em Estratégia</button>`
    return
  }
  // sem análise (sem IA, ou deu errado): mostra o ponto de partida que a pessoa respondeu
  t.innerHTML = 'Seu ponto de partida.'
  s.textContent = st?.estado === 'falhou' ? `A análise não deu certo agora (${st.erro || 'erro'}). Dá para pedir de novo em Estratégia; a sua IA já usa o que você respondeu.` : 'Isto é o que você contou. Quando quiser, peça à sua IA para completar a estratégia em Perfil.'
  const linhas = [...EST_CAMPOS, ['nivel', 'Momento da carreira'], ['frequencia', 'Frequência']].filter(([k]) => p[k]).map(([k, rot]) => `<div class="est-c on fixo"><span class="est-h"><small>${rot}</small></span><span class="est-v">${esc(p[k])}</span></div>`).join('')
  corpo.innerHTML = linhas ? `<div class="est-grade">${linhas}</div>` : '<p class="fine">Você pulou as perguntas. Tudo bem: dá para preencher em Estratégia.</p>'
  cta.innerHTML = fim
}
$('[data-scene=estrategia]')?.addEventListener('change', e => { const c = e.target.closest('[data-est-k]'); if (!c) return; ESTR.marcados[c.dataset.estK] = c.checked; Som.tique(); desenharEstrategia() })
$('[data-scene=estrategia]')?.addEventListener('click', async e => {
  if (e.target.closest('[data-est-usar]')) {
    const st = ESTR.estado, a = (st?.estado === 'pronto' && st.resultado) || ESTR.perfil.analise
    const chaves = Object.entries(ESTR.marcados || {}).filter(([, v]) => v).map(([k]) => k)
    if (!chaves.length) return pill('Marque pelo menos um item', 'Ou pule e veja depois em Estratégia.', 'var(--amber)')
    try {
      const P = aplicarAnalise(JSON.parse(JSON.stringify(ESTR.perfil)), a, chaves)
      ESTR.perfil = await api('/api/perfil/salvar', { id: P.id, perfil: P }); ESTR.usada = true
      Som.publica(); pill('Estratégia salva', 'A sua IA já escreve com ela.', 'var(--green)'); desenharEstrategia()
    } catch (err) { falha(err) }
    return
  }
  if (e.target.closest('[data-est-criar]')) {
    store.set('onboarded', '1'); voltarPara = null
    if (!ST) await status()
    if (!ST?.agente?.conectado) return cena('rotinas')
    try {
      const mod = (await api('/api/runs')).rotinas, id = recomendados(ESTR.perfil, mod).ids[0]
      if (!id) return cena('rotinas')
      await api('/api/run', { id }); Som.liga()
      avisoFixo({ tipo: 'info', titulo: 'A sua IA começou o seu primeiro post', texto: `Modelo "${(mod.find(m => m.id === id) || {}).titulo || id}". Leva de 2 a 10 minutos; o aviso aparece quando ficar pronto.` })
      vigiar(); cena('inicio'); tourSeNovo()
    } catch (err) { falha(err); cena('rotinas') }
  }
})

// ---------------------------------------------------------------- início
if (DEMO) setTimeout(() => pill('Demonstração', 'Logins simulados: nada é conectado nem publicado de verdade.', 'var(--violet)'), 1200)
if (new URLSearchParams(location.search).has('captura')) document.documentElement.classList.add('static')
const pedida = new URLSearchParams(location.search).get('tela')   // ?tela=fila abre direto numa cena (útil para capturas e atalhos)
if (pedida && $(`.scene[data-scene="${pedida}"]`)) cena(pedida, { som: false })
else {
  // quem já tem o LinkedIn e a IA prontos não passa pela entrada de novo (mesmo se as preferências do navegador sumiram)
  const abrirApp = () => { cena('inicio', { som: false }); setInterval(() => { const a = atual?.dataset.scene; a === 'fila' ? carregarFila() : a === 'calendario' ? carregarCalendario() : a === 'inicio' && carregarInicio() }, 60000) }
  if (store.get('onboarded') === '1') abrirApp()
  else status().then(s => { if (!DEMO && s && (s.linkedin?.contas || []).length && s.agente?.sincronizado) { store.set('onboarded', '1'); abrirApp() } else cena('ola', { som: false }) })
}
vigiar()
