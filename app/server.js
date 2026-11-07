'use strict'
// Farol (painel local): conexões (LinkedIn e o agente de IA), sincronização, fila de posts, aprovação e publicação.
// Sem dependências. Escuta só em 127.0.0.1; toda ação exige o token desta sessão (contra sites tentando agir pelo navegador).
// Uso: node app/server.js   → http://127.0.0.1:4800
const fs = require('fs')
const path = require('path')
const http = require('http')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')
const C = require('../engine/config.js')
const AG = require('../engine/agentes.js')
const S = require('../engine/segredos.js')
const CONTAS = require('../engine/linkedin/contas.js')
const PUB_LI = require('../engine/linkedin/publicar.js')
const BIBLIOTECA = require('../engine/midia.js')
const POSTS = require('../engine/posts.js')

const ROOT = C.ROOT, PUB = path.join(__dirname, 'public')
const TOKEN = crypto.randomBytes(24).toString('hex')
// PORT=0 pede uma porta livre; sem PORT, a do config (4800). Na versão desktop (FAROL_PORTA_LIVRE), se a 4800 estiver ocupada, usa outra.
const PORT = process.env.PORT != null && process.env.PORT !== '' ? +process.env.PORT : C.cfg.app.port
const porta = () => server.address().port
const IS_WIN = process.platform === 'win32'
const PONTE = (C.cfg.linkedin && C.cfg.linkedin.ponte) || 'https://farol-otavio-guerra.vercel.app'

// ---------------------------------------------------------------- utilidades
const run = (cmd, args, o = {}) => new Promise(ok => execFile(cmd, args, { cwd: ROOT, timeout: o.timeout || 30000, windowsHide: true, maxBuffer: 4e6 }, (err, stdout, stderr) => ok({ code: err ? (err.code ?? 1) : 0, out: String(stdout || ''), err: String(stderr || '') })))
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const readJSONText = t => { try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) } catch { return null } }
const exists = p => { try { return !!p && fs.existsSync(p) } catch { return false } }
const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)) }
const body = req => new Promise(ok => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) req.destroy() }); req.on('end', () => { try { ok(JSON.parse(s || '{}')) } catch { ok({}) } }) })
const publicados = () => readJSON(C.PUBLICADOS, [])
const agenteId = () => (C.load().agente || {}).id || null

// ---------------------------------------------------------------- LinkedIn
// a conta ativa vem nos campos de sempre (connected, name...); todas as contas vão em "contas", sem token
function linkedinStatus() {
  const k = S.get('linkedin.app'), lista = CONTAS.lista(), a = lista.find(c => c.ativa)
  return { proprio: !!(k && k.client_id && k.client_secret), connected: !!(a && a.valida), name: a && a.nome, foto: a && a.foto, expiresAt: a && a.expiresAt, dias: a ? a.dias : null, via: a && a.via, contas: lista, redirectUri: C.cfg.linkedin.redirectUri, aguardando: !!(LI && LI.expira > Date.now()) }
}
// login em andamento pela ponte do Farol (o state confere que o token que volta é deste pedido)
let LI = null
async function ponteOk() { try { const r = await fetch(PONTE + '/api/linkedin/ping', { signal: AbortSignal.timeout(6000) }); const j = await r.json(); return !!j.pronto } catch { return false } }
async function salvarToken(access_token, expires_in, via) {
  // confere o token com o próprio LinkedIn (nome e id vêm de lá, não do navegador)
  const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.ok ? r.json() : null).catch(() => null)
  if (!me || !me.sub) throw new Error('O LinkedIn não confirmou o acesso. Tente de novo.')
  CONTAS.salvar({ access_token, expires_at: Date.now() + (+expires_in || 5184000) * 1000, author: `urn:li:person:${me.sub}`, nome: me.name, foto: me.picture || null, via })
  return me.name
}
const PAGINA_VOLTA = () => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Farol · LinkedIn</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1626;color:#e9edf6;font:16px/1.5 'Segoe UI',system-ui,sans-serif;text-align:center;padding:24px">
<main><div id="i" style="width:56px;height:56px;margin:0 auto 18px;border-radius:50%;border:3px solid #2a3550;border-top-color:#4cc2ff;animation:g 1s linear infinite"></div>
<h1 id="t" style="font-weight:600;margin:0 0 6px;font-size:26px">Conectando ao Farol…</h1><p id="s" style="color:#9ba7bf;margin:0">Só um instante.</p></main>
<style>@keyframes g{to{transform:rotate(360deg)}}</style>
<script>
const h = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname)
const fim = (ok, t, s) => { const i = document.getElementById('i'); i.style.animation = 'none'; i.style.border = '0'; i.style.background = ok ? '#3ddc84' : '#ff5f6d'; document.getElementById('t').textContent = t; document.getElementById('s').textContent = s }
if (h.get('error')) fim(false, 'Não deu certo', h.get('error') + ' Volte ao Farol e tente de novo.')
else fetch('/api/linkedin/salvar', { method: 'POST', headers: { 'X-Engine-Token': '${TOKEN}', 'Content-Type': 'application/json' }, body: JSON.stringify({ state: h.get('state'), access_token: h.get('access_token'), expires_in: h.get('expires_in') }) })
  .then(r => r.json().then(j => r.ok ? fim(true, 'Pronto, ' + (j.nome || '') + '.', 'Pode fechar esta aba e voltar ao Farol.') : fim(false, 'Não deu certo', j.erro || 'Tente de novo.')))
  .catch(() => fim(false, 'O Farol não respondeu', 'Abra o Farol e tente de novo.'))
</script></body></html>`

// ---------------------------------------------------------------- Desigma (achado sozinho; ajustável em Ajustes)
const DESIGMA_GUESS = () => {
  const roots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'desigma'), process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'desigma'), 'E:\\Programas\\desigma', 'C:\\Programas\\desigma', 'D:\\Programas\\desigma'].filter(Boolean)
  const n = x => IS_WIN ? x + '.exe' : x
  for (const r of roots) if (exists(path.join(r, n('desigma')))) return { exe: path.join(r, n('desigma')), mcpExe: exists(path.join(r, n('desigma-mcp'))) ? path.join(r, n('desigma-mcp')) : '' }
  return { exe: '', mcpExe: '' }
}
function desigmaStatus() {
  const cfg = C.load().desigma, g = cfg.exe && cfg.mcpExe ? {} : DESIGMA_GUESS()
  const exe = cfg.exe || g.exe, mcpExe = cfg.mcpExe || g.mcpExe, workspace = cfg.workspace || C.WS
  return { exe, mcpExe, exeOk: exists(exe), mcpOk: exists(mcpExe), workspace, project: cfg.project, workspaceOk: exists(workspace), projectOk: exists(cfg.project), registered: !!(C.load().agente || {}).desigma, guessed: !cfg.exe && !!g.exe, download: 'https://github.com/deepfounder-ai/desigma/releases' }
}

// ---------------------------------------------------------------- fila de posts (lida do workspace)
const MIDIA = /\.(png|gif|jpe?g|mp4|pdf)$/i
const formato = f => /\.pdf$/i.test(f || '') ? 'carrossel' : /\.gif$/i.test(f || '') ? 'gif' : /\.mp4$/i.test(f || '') ? 'video' : 'imagem'
function queue() {
  const pub = publicados(), base = f => path.basename(f || '').replace(MIDIA, '')
  const pubBy = Object.fromEntries(pub.map(p => [base(p.imagem), p]))
  const items = []
  const add = (kind, id, title, file, cover, legenda, okFile, extra = {}) => {
    items.push({ kind, id, title, formato: formato(file), file: file && path.relative(C.WS, file), cover: cover && path.relative(C.WS, cover), hasFile: exists(file), approved: kind === 'series' ? true : exists(okFile), published: pubBy[base(file)] || null, caption: exists(legenda) ? fs.readFileSync(legenda, 'utf8') : '', ...extra })
  }
  // o GIF vai ao ar quando existe; o PNG fica de reserva
  const preferirGif = (dir, nome) => { const g = path.join(dir, 'gif', nome + '.gif'); return exists(g) ? g : path.join(dir, 'png', nome + '.png') }
  // Daily UI
  const du = C.ws('dailyui')
  for (const f of ls(path.join(du, 'legendas')).filter(f => /^\d{3}\.txt$/.test(f))) {
    const nn = f.slice(0, 3), png = ls(path.join(du, 'png')).find(x => x.startsWith(nn + '-'))
    const file = png && preferirGif(du, png.replace(/\.png$/, ''))
    add('dailyui', nn, `Daily UI ${nn}`, file, png && path.join(du, 'png', png), path.join(du, 'legendas', f), path.join(du, 'aprovados', nn + '.ok'))
  }
  // carrosséis de notícias
  const nt = C.ws('noticias')
  for (const f of ls(path.join(nt, 'legendas')).filter(f => f.endsWith('.txt'))) {
    const id = f.replace('.txt', '')
    add('noticias', id, `Carrossel ${id.slice(-1).toUpperCase()} · ${id.slice(0, 10)}`, path.join(nt, 'pdf', id + '.pdf'), path.join(nt, 'png', id, '01.png'), path.join(nt, 'legendas', f), path.join(nt, 'aprovados', id + '.ok'), { paginas: ls(path.join(nt, 'png', id)).filter(x => x.endsWith('.png')).length })
  }
  // série própria (já aprovada pelo autor ao gerar)
  const se = C.ws('series')
  for (const f of ls(path.join(se, 'legendas')).filter(f => /^\d\d-.*\.txt$/.test(f))) {
    const id = f.replace('.txt', '')
    add('series', id, `Série ${id.slice(0, 2)}`, preferirGif(se, id), path.join(se, 'png', id + '.png'), path.join(se, 'legendas', f), null)
  }
  // avulsos (workspace/avulsos), em qualquer formato que a API aceita:
  //   nome.png|gif|jpg|mp4|pdf + nome.txt   → um arquivo         nome.txt sozinho  → só texto
  //   pasta/ com imagens + legenda.txt      → várias imagens     pasta/ com link.json + legenda.txt → artigo
  const av = C.ws('avulsos'), noAv = ls(av)
  const okAv = id => path.join(av, 'aprovados', id + '.ok')
  for (const f of noAv.filter(f => MIDIA.test(f))) {
    const id = f.replace(MIDIA, ''), file = path.join(av, f)
    add('avulsos', id, id, file, /\.(png|gif|jpe?g)$/i.test(f) ? file : null, path.join(av, id + '.txt'), okAv(id))
  }
  const comMidia = new Set(noAv.filter(f => MIDIA.test(f)).map(f => f.replace(MIDIA, '')))
  for (const f of noAv.filter(f => f.endsWith('.txt') && !f.endsWith('.alt.txt') && !comMidia.has(f.slice(0, -4)))) {
    const id = f.slice(0, -4), file = path.join(av, f)
    add('avulsos', id, id, file, null, file, okAv(id), { formato: 'texto' })
  }
  // pastas (também os posts do editor): post.json diz o título e se ainda é rascunho
  for (const d of noAv.filter(d => d !== 'aprovados' && fs.statSync(path.join(av, d)).isDirectory())) {
    const dir = path.join(av, d)
    let p; try { p = PUB_LI.montar(dir) } catch { continue }   // pasta sem legenda.txt: ainda não é um post
    const meta = readJSON(path.join(dir, 'post.json'), {})
    const capa = p.arquivos.find(f => /\.(png|gif|jpe?g)$/i.test(f)) || null
    add('avulsos', d, meta.titulo || d, dir, capa, path.join(dir, 'legenda.txt'), okAv(d), { formato: p.formato, pasta: true, rascunho: !!meta.rascunho, editor: !!meta.criado, arquivos: p.arquivos.map(f => path.relative(C.WS, f)), artigo: p.artigo || undefined })
  }
  for (const it of items) it.caracteres = it.caption.trim().length
  return items.sort((a, b) => (a.published ? 1 : 0) - (b.published ? 1 : 0) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
}
function ls(d) { try { return fs.readdirSync(d).sort() } catch { return [] } }
const findItem = (kind, id) => queue().find(i => i.kind === kind && i.id === id)
const legendaDe = it => it.kind !== 'avulsos' ? C.ws(it.kind, 'legendas', it.id + '.txt') : it.pasta ? C.ws('avulsos', it.id, 'legenda.txt') : C.ws('avulsos', it.id + '.txt')

// ---------------------------------------------------------------- rotinas (o agente escolhido, em modo não interativo)
const RUNS = []
function startRun(rid) {
  const ag = agenteId(); if (!ag) throw new Error('Escolha um agente de IA antes (Ajustes).')
  const r = AG.ROTINAS[rid]; if (!r) throw new Error('rotina desconhecida')
  if (RUNS.some(x => x.id === rid && x.status === 'rodando')) throw new Error('essa rotina já está rodando')
  const logDir = C.ws('logs'); fs.mkdirSync(logDir, { recursive: true })
  const log = path.join(logDir, `${rid}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  const p = AG.rotina(ag, rid)
  const item = { id: rid, titulo: r.titulo, agente: AG.AGENTES[ag].nome, status: 'rodando', inicio: Date.now(), log: path.relative(C.WS, log) }
  const out = fs.createWriteStream(log)
  p.stdout.pipe(out); p.stderr.pipe(out)
  p.on('error', e => { out.write('\n' + e.message); item.status = 'falhou' })
  p.on('close', code => { item.status = code === 0 ? 'concluída' : 'falhou'; item.fim = Date.now() })
  RUNS.unshift(item)
  return item
}

// ---------------------------------------------------------------- HTTP
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' }
const DEMO_STATUS = () => ({
  agente: { id: 'claude', nome: 'Claude', via: 'Claude Code', instalado: true, conectado: true, conta: 'voce@exemplo.com', sincronizado: new Date().toISOString() },
  linkedin: { proprio: false, connected: true, name: 'Seu Nome', expiresAt: Date.now() + 59 * 864e5, dias: 59, via: 'farol', contas: [{ id: 'demo', nome: 'Seu Nome', expiresAt: Date.now() + 59 * 864e5, dias: 59, valida: true, ativa: true }], redirectUri: C.cfg.linkedin.redirectUri },
  desigma: { exe: 'C:\\Programas\\desigma\\desigma.exe', mcpExe: 'C:\\Programas\\desigma\\desigma-mcp.exe', workspace: 'C:\\Users\\voce\\Documents\\desigma', project: '', exeOk: true, mcpOk: true, workspaceOk: true, projectOk: false, registered: true },
  config: { assetsDir: 'examples/assets', workspaceDir: 'workspace', dailyUiStart: '2026-11-03' },
})

// só atende quem chamou pelo endereço local exato: barra o "DNS rebinding" (um site que aponta o próprio domínio para 127.0.0.1
// para ler o painel como se fosse da mesma origem)
const hostOk = h => { const p = server.address().port; return h === `127.0.0.1:${p}` || h === `localhost:${p}` }

const server = http.createServer(async (req, res) => {
  if (!hostOk(String(req.headers.host || '').toLowerCase())) return send(res, 403, 'endereço não permitido', 'text/plain; charset=utf-8')
  const u = new URL(req.url, `http://127.0.0.1:${porta()}`)
  try {
    // volta do login do LinkedIn pela ponte (a página lê o token do fragmento e manda para /api/linkedin/salvar)
    if (req.method === 'GET' && u.pathname === '/linkedin/done') return send(res, 200, PAGINA_VOLTA(), 'text/html; charset=utf-8')
    // arquivos do painel
    if (req.method === 'GET' && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/files/')) {
      const f = u.pathname === '/' ? 'index.html' : u.pathname.slice(1)
      const p = path.join(PUB, path.normalize(f))
      if (!p.startsWith(PUB) || !exists(p)) return send(res, 404, 'não encontrado', 'text/plain')
      let b = fs.readFileSync(p)
      if (f === 'index.html') b = b.toString('utf8').replace('__TOKEN__', TOKEN)
      return send(res, 200, b, MIME[path.extname(p)] || 'application/octet-stream')
    }
    // arquivos gerados (só de dentro do workspace)
    if (req.method === 'GET' && u.pathname.startsWith('/files/')) {
      const p = path.join(C.WS, path.normalize(decodeURIComponent(u.pathname.slice(7))))
      if (!p.startsWith(C.WS + path.sep) || !exists(p)) return send(res, 404, 'não encontrado', 'text/plain')
      return send(res, 200, fs.readFileSync(p), MIME[path.extname(p).toLowerCase()] || 'application/octet-stream')
    }
    // API: exige o token da sessão e a origem local
    if (req.headers['x-engine-token'] !== TOKEN) return send(res, 403, { erro: 'token inválido' })
    const origin = req.headers.origin
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return send(res, 403, { erro: 'origem não permitida' })

    // envio de arquivo para a biblioteca: o corpo é o próprio arquivo (sem JSON), com o nome na URL
    if (req.method === 'POST' && u.pathname === '/api/midia/upload') {
      try { return send(res, 200, await BIBLIOTECA.receber(String(u.searchParams.get('nome') || 'arquivo'), req)) } catch (e) { return send(res, 400, { erro: e.message }) }
    }

    if (req.method === 'GET') {
      switch (u.pathname) {
        case '/api/status': {
          if (process.env.ENGINE_DEMO) return send(res, 200, DEMO_STATUS())
          const ag = agenteId(), cfg = C.load()
          const agente = ag ? { ...(await AG.status(ag)), nome: AG.AGENTES[ag].nome, via: AG.AGENTES[ag].via, sincronizado: cfg.agente.sincronizado } : null
          return send(res, 200, { agente, linkedin: linkedinStatus(), desigma: desigmaStatus(), config: { assetsDir: cfg.assetsDir, workspaceDir: C.WS, dailyUiStart: cfg.dailyUiStart }, cofre: { protegido: S.protegido() }, desktop: !!process.env.FAROL_DESKTOP })
        }
        case '/api/agentes': {
          const principais = ['claude', 'codex', 'gemini']
          const st = Object.fromEntries(await Promise.all(principais.map(async id => [id, await AG.status(id).catch(() => ({}))])))
          return send(res, 200, { escolhido: agenteId(), agentes: AG.lista().map(a => ({ ...a, ...(st[a.id] || {}) })) })
        }
        case '/api/agente/status': return send(res, 200, await AG.status(u.searchParams.get('id')))
        case '/api/agente/job': return send(res, 200, AG.job(u.searchParams.get('id')) || {})
        case '/api/sync': return send(res, 200, AG.estadoSync() || {})
        case '/api/queue': return send(res, 200, queue())
        case '/api/midia': return send(res, 200, { itens: BIBLIOTECA.listar(), limites: BIBLIOTECA.LIMITES })
        case '/api/post': { try { return send(res, 200, POSTS.carregar(u.searchParams.get('id'))) } catch (e) { return send(res, 404, { erro: e.message }) } }
        case '/api/runs': {
          const ag = agenteId()
          return send(res, 200, {
            agente: ag && AG.AGENTES[ag].nome,
            rotinas: Object.entries(AG.ROTINAS).map(([id, r]) => ({ id, titulo: r.titulo, agendar: AG.agendamento(ag, id) })),
            runs: RUNS.slice(0, 10).map(r => ({ ...r, tail: (() => { try { return fs.readFileSync(path.join(C.WS, r.log), 'utf8').slice(-1500) } catch { return '' } })() })),
          })
        }
      }
      return send(res, 404, { erro: 'rota não encontrada' })
    }
    if (req.method !== 'POST') return send(res, 404, { erro: 'rota não encontrada' })

    const b = await body(req)
    switch (u.pathname) {
      // ---- agente de IA
      case '/api/agente/login': return send(res, 200, AG.login(b.id, { console: !!b.console }))
      case '/api/agente/cancelar': AG.cancelar(b.id); return send(res, 200, { ok: true })
      case '/api/agente/escolher': { if (!AG.AGENTES[b.id]) return send(res, 400, { erro: 'agente desconhecido' }); C.save({ agente: { id: b.id } }); return send(res, 200, { ok: true }) }
      case '/api/sync': {
        const id = b.id || agenteId(); if (!AG.AGENTES[id]) return send(res, 400, { erro: 'Escolha um agente antes.' })
        C.save({ agente: { id } })
        const d = desigmaStatus()
        if (d.guessed) C.save({ desigma: { exe: d.exe, mcpExe: d.mcpExe } })   // guarda o que foi achado sozinho
        try { return send(res, 200, AG.sincronizar(id, d)) } catch (e) { return send(res, 409, { erro: e.message }) }
      }
      // ---- LinkedIn: um botão (ponte do Farol) ou o app próprio do usuário
      case '/api/linkedin/connect': {
        if (await ponteOk() && !b.proprio) {
          LI = { state: crypto.randomBytes(16).toString('hex'), expira: Date.now() + 10 * 60000 }
          const url = `${PONTE}/api/linkedin/start?` + new URLSearchParams({ state: LI.state, port: String(porta()) })
          AG.abrirUrl(url)
          return send(res, 200, { ok: true, modo: 'ponte', url, msg: 'Abri o LinkedIn no navegador. Entre e clique em Permitir.' })
        }
        if (!linkedinStatus().proprio) return send(res, 200, { ok: false, precisaChaves: true, msg: 'O login de um clique ainda não está disponível. Use o seu próprio app do LinkedIn.' })
        spawn(process.execPath, [path.join(ROOT, 'engine', 'linkedin', 'auth.js')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref()
        return send(res, 200, { ok: true, modo: 'proprio', msg: 'Abri o LinkedIn no navegador. Entre e clique em Permitir.' })
      }
      case '/api/linkedin/salvar': {
        if (!LI || LI.expira < Date.now() || typeof b.state !== 'string' || !crypto.timingSafeEqual(Buffer.from(b.state.padEnd(32).slice(0, 32)), Buffer.from(LI.state))) return send(res, 400, { erro: 'Este login expirou ou não foi pedido por este Farol.' })
        if (!b.access_token) return send(res, 400, { erro: 'O LinkedIn não mandou o acesso.' })
        LI = null
        try { return send(res, 200, { ok: true, nome: await salvarToken(String(b.access_token), b.expires_in, 'farol') }) } catch (e) { return send(res, 400, { erro: e.message }) }
      }
      case '/api/linkedin/cancelar': LI = null; return send(res, 200, { ok: true })
      case '/api/linkedin/keys': {
        const id = String(b.client_id || '').trim(), sec = String(b.client_secret || '').trim()
        if (!/^[A-Za-z0-9]{8,40}$/.test(id) || sec.length < 8) return send(res, 400, { erro: 'Confira o Client ID e o Client Secret.' })
        S.set('linkedin.app', { client_id: id, client_secret: sec })
        return send(res, 200, { ok: true })
      }
      case '/api/linkedin/disconnect': CONTAS.remover(typeof b.id === 'string' ? b.id : undefined); return send(res, 200, { ok: true })
      case '/api/linkedin/usar': { try { CONTAS.usar(String(b.id || '')); return send(res, 200, { ok: true }) } catch (e) { return send(res, 400, { erro: e.message }) } }
      // ---- Desigma
      case '/api/desigma/config': {
        const patch = {}
        for (const k of ['exe', 'mcpExe', 'workspace', 'project']) if (typeof b[k] === 'string') patch[k] = b[k].trim()
        C.save({ desigma: patch }); return send(res, 200, { ok: true, desigma: desigmaStatus() })
      }
      case '/api/desigma/open': { const d = desigmaStatus(); if (!d.exeOk) return send(res, 400, { erro: 'Desigma não encontrado.' }); spawn(d.exe, ['--bridge', ...(d.projectOk ? [d.project] : [])], { detached: true, stdio: 'ignore' }).unref(); return send(res, 200, { ok: true }) }
      case '/api/config': { const patch = {}; for (const k of ['assetsDir', 'dailyUiStart']) if (typeof b[k] === 'string') patch[k] = b[k].trim(); C.save(patch); return send(res, 200, { ok: true, msg: 'Salvo. Reinicie o painel para valer em tudo.' }) }
      // ---- biblioteca e editor
      case '/api/midia/alt': { try { BIBLIOTECA.definirAlt(b.arquivo, b.alt); return send(res, 200, { ok: true }) } catch (e) { return send(res, 400, { erro: e.message }) } }
      case '/api/midia/excluir': { try { BIBLIOTECA.excluir(String(b.arquivo || '')); return send(res, 200, { ok: true }) } catch (e) { return send(res, 400, { erro: e.message }) } }
      case '/api/post/salvar': { try { return send(res, 200, POSTS.salvar(b)) } catch (e) { return send(res, 400, { erro: e.message }) } }
      case '/api/post/enviar': { try { POSTS.enviar(String(b.id || '')); return send(res, 200, { ok: true }) } catch (e) { return send(res, 400, { erro: e.message }) } }
      case '/api/post/excluir': { try { POSTS.excluir(String(b.id || '')); return send(res, 200, { ok: true }) } catch (e) { return send(res, 400, { erro: e.message }) } }
      // ---- fila
      case '/api/approve': case '/api/unapprove': {
        const it = findItem(b.kind, b.id); if (!it || it.kind === 'series') return send(res, 400, { erro: 'Item não encontrado.' })
        if (it.rascunho && u.pathname === '/api/approve') return send(res, 400, { erro: 'Este post ainda é rascunho: envie para aprovação antes.' })
        const ok = it.kind === 'avulsos' ? C.ws('avulsos', 'aprovados', it.id + '.ok') : path.join(C.ws(it.kind, 'aprovados'), it.id + '.ok')
        if (u.pathname === '/api/approve') { fs.mkdirSync(path.dirname(ok), { recursive: true }); fs.writeFileSync(ok, `${new Date().toISOString()} aprovado no painel\n`) } else if (exists(ok)) fs.unlinkSync(ok)
        return send(res, 200, { ok: true })
      }
      case '/api/publish': {
        const it = findItem(b.kind, b.id)
        if (!it || !it.hasFile) return send(res, 400, { erro: 'Arquivo do post não encontrado: exporte antes.' })
        if (!it.approved) return send(res, 400, { erro: 'Aprove o post antes de publicar.' })
        if (it.published) return send(res, 409, { erro: 'Esse post já foi publicado.' })
        if (!linkedinStatus().connected) return send(res, 400, { erro: 'Conecte o LinkedIn antes.' })
        if (it.caracteres > PUB_LI.LIMITE) return send(res, 400, { erro: `O texto tem ${it.caracteres} caracteres; o LinkedIn aceita até ${PUB_LI.LIMITE}.` })
        if (it.rascunho) return send(res, 400, { erro: 'Este post ainda é rascunho: envie para aprovação antes.' })
        const alvo = it.formato === 'texto' && !it.pasta ? '-' : path.join(C.WS, it.file)
        const r = await run(process.execPath, [path.join(ROOT, 'engine', 'linkedin', 'postar.js'), alvo, legendaDe(it), '--confirmo'], { timeout: 600000 })
        const j = readJSONText(r.out)
        return send(res, r.code === 0 && j && j.ok ? 200 : 500, r.code === 0 && j ? j : { erro: (r.err || r.out).slice(0, 400) })
      }
      case '/api/export': {
        const kind = b.kind
        const r = kind === 'noticias' ? await run(process.execPath, [path.join(ROOT, 'engine', 'noticias', 'exportar.js'), b.id], { timeout: 300000 }) : await run(process.execPath, [path.join(ROOT, 'engine', 'exportar-png.js'), kind, b.id || ''], { timeout: 300000 })
        return send(res, r.code === 0 ? 200 : 500, r.code === 0 ? { ok: true } : { erro: (r.err || r.out).slice(0, 400) })
      }
      case '/api/run': { try { return send(res, 200, startRun(b.id)) } catch (e) { return send(res, 400, { erro: e.message }) } }
      // versão desktop: links abrem no navegador padrão e arquivos do workspace no programa padrão (fora da janela do app)
      case '/api/abrir': {
        const alvo = String(b.url || '')
        if (/^https?:\/\/[^\s"<>]+$/i.test(alvo)) { AG.abrirUrl(alvo); return send(res, 200, { ok: true }) }
        if (alvo.startsWith('/files/')) {
          const p = path.join(C.WS, path.normalize(decodeURIComponent(alvo.slice(7))))
          if (!p.startsWith(C.WS + path.sep) || !exists(p)) return send(res, 404, { erro: 'arquivo não encontrado' })
          AG.abrirUrl(p); return send(res, 200, { ok: true })
        }
        return send(res, 400, { erro: 'endereço não permitido' })
      }
    }
    return send(res, 404, { erro: 'rota não encontrada' })
  } catch (e) { return send(res, 500, { erro: e.message }) }
})
// a linha "Farol: http://..." é lida pela versão desktop para abrir a janela na porta certa
server.on('listening', () => console.log(`Farol: http://127.0.0.1:${porta()}/`))
server.on('error', e => {
  if (e.code === 'EADDRINUSE' && process.env.FAROL_PORTA_LIVRE && server.listening === false && !server._tentouLivre) { server._tentouLivre = true; return server.listen(0, '127.0.0.1') }
  console.error('Farol: não consegui abrir o painel:', e.message); process.exit(1)
})
server.listen(PORT, '127.0.0.1')
