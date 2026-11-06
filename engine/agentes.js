'use strict'
// Agentes de IA que o Farol sabe usar. Cada um tem um "adaptador": como instalar, entrar, conferir a conta,
// onde ficam as skills, os prompts e os plugins (MCP), e como rodar uma rotina sem ninguém no teclado.
// Tudo o que é sincronizado sai de agent/ (fonte única) e vai para as pastas que cada agente lê dentro do Farol.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, execFile } = require('child_process')
const C = require('./config.js')

const ROOT = C.ROOT, HOME = os.homedir(), IS_WIN = process.platform === 'win32'
const FONTE = path.join(ROOT, 'agent')
const POSTAR = 'node engine/linkedin/postar.js'

// ---------------------------------------------------------------- achar e rodar a linha de comando de cada agente
const PASTAS = () => (process.env.PATH || '').split(path.delimiter).concat([
  path.join(HOME, '.local', 'bin'),
  process.env.APPDATA && path.join(process.env.APPDATA, 'npm'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'GitHubCopilotCLI'),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'nodejs'),
].filter(Boolean))
function achar(nome) {
  for (const d of PASTAS()) for (const n of IS_WIN ? [nome + '.exe', nome + '.cmd'] : [nome]) { const p = path.join(d, n); try { if (fs.statSync(p).isFile()) return p } catch {} }
  return null
}
// no Windows, .cmd (instalados pelo npm) só rodam com shell; aí cada argumento precisa de aspas
const aspas = a => /[\s"&|<>^%]/.test(a) ? '"' + String(a).replace(/"/g, '""') + '"' : String(a)
function preparar(bin, args) {
  const shell = IS_WIN && /\.cmd$/i.test(bin)
  return shell ? { cmd: aspas(bin), args: args.map(aspas), shell: true } : { cmd: bin, args, shell: false }
}
function rodar(bin, args, { stdin, timeout = 30000, cwd = ROOT } = {}) {
  return new Promise(ok => {
    const p = preparar(bin, args)
    const ch = execFile(p.cmd, p.args, { cwd, timeout, windowsHide: true, shell: p.shell, maxBuffer: 8e6 }, (err, out, er) => ok({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(out || ''), err: String(er || '') }))
    if (stdin != null) ch.stdin.end(stdin); else ch.stdin.end()
  })
}
function soltar(bin, args, o = {}) { const p = preparar(bin, args); return spawn(p.cmd, p.args, { cwd: ROOT, windowsHide: true, shell: p.shell, ...o }) }
// abre um console visível (plano B quando o login precisa de terminal)
function console_(titulo, bin, args) {
  const linha = [aspas(bin), ...args.map(aspas)].join(' ')
  if (IS_WIN) spawn('cmd.exe', ['/c', 'start', `"${titulo}"`, 'cmd', '/k', linha], { cwd: ROOT, detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref()
  else spawn('sh', ['-c', linha], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref()
}
const abrirUrl = u => IS_WIN ? spawn('cmd', ['/c', 'start', '', u.replace(/&/g, '^&')], { detached: true, stdio: 'ignore', windowsHide: true }).unref() : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [u], { detached: true, stdio: 'ignore' }).unref()
const lerJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const lerTexto = t => { try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) } catch { return null } }
const escrever = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, 'utf8') }
const fundir = (p, patch) => { const cur = lerJSON(p, {}); const deep = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? deep(a[k] || {}, v) : v; return o }; escrever(p, JSON.stringify(deep(cur, patch), null, 2) + '\n') }

// ---------------------------------------------------------------- adaptadores
// pergunta curta para as rotinas: o agente lê o arquivo de instruções (evita passar textos longos pela linha de comando)
const pedir = arq => `Leia o arquivo ${arq} e siga as instruções dele à risca.`
const npm = pkg => ({ tipo: 'npm', pkg, rotulo: `npm i -g ${pkg}` })

const AGENTES = {
  claude: {
    nome: 'Claude', via: 'Claude Code', bin: 'claude', cor: '#D97757',
    instalar: IS_WIN ? { tipo: 'ps', cmd: 'irm https://claude.ai/install.ps1 | iex', rotulo: 'instalador oficial do Claude Code' } : { tipo: 'sh', cmd: 'curl -fsSL https://claude.ai/install.sh | bash', rotulo: 'instalador oficial do Claude Code' },
    login: ['auth', 'login'],
    async conta(bin) { const r = await rodar(bin, ['auth', 'status', '--json']); const j = lerTexto(r.out); return j && j.loggedIn ? { ok: true, conta: j.email, plano: j.subscriptionType } : { ok: false } },
    instrucoes: 'CLAUDE.md', skills: ['.claude/skills'],
    prompts: n => ({ arq: path.join(ROOT, '.claude', 'commands', n + '.md'), fmt: 'md' }),
    plugins(d) { fundir(path.join(ROOT, '.mcp.json'), { mcpServers: { desigma: { command: d.mcpExe, args: ['--workspace', d.workspace] } } }); fundir(path.join(ROOT, '.claude', 'settings.json'), { enabledMcpjsonServers: ['desigma'] }) },
    trava() { fundir(path.join(ROOT, '.claude', 'settings.json'), { permissions: { deny: [`Bash(${POSTAR}:*)`] } }); return 'O Claude não pode rodar o script de publicação.' },
    rotina: arq => ({ args: ['-p', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Bash(node:*),mcp__desigma', '--disallowedTools', `Bash(${POSTAR}:*)`], stdin: fs.readFileSync(path.join(ROOT, arq), 'utf8') }),
    teste: ['-p', 'Responda apenas: ok'],
  },
  codex: {
    nome: 'ChatGPT', via: 'Codex', bin: 'codex', cor: '#10A37F',
    instalar: npm('@openai/codex'),
    login: ['login'],
    async conta(bin) { const r = await rodar(bin, ['login', 'status']); const t = r.out + r.err; return r.code === 0 && /logged in/i.test(t) ? { ok: true, conta: /api key/i.test(t) ? 'chave de API' : 'conta do ChatGPT' } : { ok: false } },
    instrucoes: 'AGENTS.md', skills: ['.agents/skills'],
    prompts: n => ({ arq: path.join(HOME, '.codex', 'prompts', n + '.md'), fmt: 'md' }),
    async plugins(d, bin) { if ((await rodar(bin, ['mcp', 'get', 'desigma'])).code === 0) return 'já estava ligado'; const r = await rodar(bin, ['mcp', 'add', 'desigma', '--', d.mcpExe, '--workspace', d.workspace]); if (r.code) throw new Error((r.err || r.out).slice(0, 200)) },
    trava: () => 'O Codex roda as rotinas sem rede no terminal: o script de publicação não alcança o LinkedIn.',
    rotina: arq => ({ args: ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '-c', 'tools.web_search=true', pedir(arq)] }),
    teste: ['exec', '--skip-git-repo-check', 'Responda apenas: ok'],
  },
  gemini: {
    nome: 'Gemini', via: 'Gemini CLI', bin: 'gemini', cor: '#4285F4',
    instalar: npm('@google/gemini-cli'),
    // o Gemini CLI abre o login do Google no navegador quando o tipo de login já está escolhido
    antesDoLogin() { const p = path.join(HOME, '.gemini', 'settings.json'), s = lerJSON(p, {}); if (!(s.security && s.security.auth && s.security.auth.selectedType) && !s.selectedAuthType) fundir(p, { security: { auth: { selectedType: 'oauth-personal' } } }) },
    login: ['-p', 'Responda apenas: ok'],
    loginConsole: [],
    async conta() { const ok = fs.existsSync(path.join(HOME, '.gemini', 'oauth_creds.json')) || !!process.env.GEMINI_API_KEY; const g = lerJSON(path.join(HOME, '.gemini', 'google_accounts.json'), {}); return ok ? { ok: true, conta: g.active || 'conta do Google' } : { ok: false } },
    instrucoes: 'GEMINI.md', skills: ['.gemini/skills'],
    prompts: n => ({ arq: path.join(ROOT, '.gemini', 'commands', n + '.toml'), fmt: 'toml' }),
    plugins(d) { fundir(path.join(ROOT, '.gemini', 'settings.json'), { mcpServers: { desigma: { command: d.mcpExe, args: ['--workspace', d.workspace] } } }) },
    trava() { fundir(path.join(ROOT, '.gemini', 'settings.json'), { tools: { exclude: [`run_shell_command(${POSTAR})`] } }); return 'O Gemini não pode rodar o script de publicação.' },
    rotina: arq => ({ args: ['--yolo', '-p', pedir(arq)] }),
    teste: ['-p', 'Responda apenas: ok'],
  },
  // ---- outros (beta): login pelo próprio terminal do agente
  copilot: {
    nome: 'GitHub Copilot', via: 'Copilot CLI', bin: 'copilot', cor: '#8957E5', beta: true,
    instalar: npm('@github/copilot'), login: [], loginConsole: [],
    async conta() { const c = lerJSON(path.join(HOME, '.copilot', 'config.json'), {}); const u = (c.logged_in_users || [])[0] || c.last_logged_in_user; return u ? { ok: true, conta: u.login || 'conta do GitHub' } : { ok: false } },
    instrucoes: '.github/copilot-instructions.md', skills: ['.github/skills'],
    prompts: n => ({ arq: path.join(ROOT, '.github', 'prompts', n + '.prompt.md'), fmt: 'md' }),
    plugins(d) { fundir(path.join(HOME, '.copilot', 'mcp-config.json'), { mcpServers: { desigma: { type: 'local', command: d.mcpExe, args: ['--workspace', d.workspace], tools: ['*'] } } }) },
    trava: () => 'As rotinas rodam com o script de publicação bloqueado (--deny-tool).',
    rotina: arq => ({ args: ['-p', pedir(arq), '--allow-all-tools', '--deny-tool', `shell(${POSTAR})`] }),
    teste: ['-p', 'Responda apenas: ok'],
  },
  qwen: {
    nome: 'Qwen Code', via: 'Qwen Code', bin: 'qwen', cor: '#615CED', beta: true,
    instalar: npm('@qwen-code/qwen-code'), login: [], loginConsole: [],
    async conta() { return fs.existsSync(path.join(HOME, '.qwen', 'oauth_creds.json')) ? { ok: true, conta: 'conta do Qwen' } : { ok: false } },
    instrucoes: 'QWEN.md', skills: ['.qwen/skills'],
    prompts: n => ({ arq: path.join(ROOT, '.qwen', 'commands', n + '.toml'), fmt: 'toml' }),
    plugins(d) { fundir(path.join(ROOT, '.qwen', 'settings.json'), { mcpServers: { desigma: { command: d.mcpExe, args: ['--workspace', d.workspace] } } }) },
    trava() { fundir(path.join(ROOT, '.qwen', 'settings.json'), { tools: { exclude: [`run_shell_command(${POSTAR})`] } }); return 'O Qwen não pode rodar o script de publicação.' },
    rotina: arq => ({ args: ['--yolo', '-p', pedir(arq)] }),
    teste: ['-p', 'Responda apenas: ok'],
  },
  opencode: {
    nome: 'OpenCode', via: 'OpenCode', bin: 'opencode', cor: '#9BA7BF', beta: true,
    instalar: npm('opencode-ai'), login: ['auth', 'login'], loginConsole: ['auth', 'login'],
    async conta() { const a = lerJSON(path.join(HOME, '.local', 'share', 'opencode', 'auth.json'), {}); const k = Object.keys(a || {}); return k.length ? { ok: true, conta: k.join(', ') } : { ok: false } },
    instrucoes: 'AGENTS.md', skills: ['.opencode/skills'],
    prompts: n => ({ arq: path.join(ROOT, '.opencode', 'command', n + '.md'), fmt: 'md' }),
    plugins(d) { fundir(path.join(ROOT, 'opencode.json'), { mcp: { desigma: { type: 'local', command: [d.mcpExe, '--workspace', d.workspace], enabled: true } } }) },
    trava() { fundir(path.join(ROOT, 'opencode.json'), { permission: { bash: { [`${POSTAR}*`]: 'deny' } } }); return 'O OpenCode não pode rodar o script de publicação.' },
    rotina: arq => ({ args: ['run', pedir(arq)] }),
    teste: ['run', 'Responda apenas: ok'],
  },
}
const lista = () => Object.entries(AGENTES).map(([id, a]) => ({ id, nome: a.nome, via: a.via, cor: a.cor, beta: !!a.beta }))

async function status(id) {
  const a = AGENTES[id]; if (!a) throw new Error('agente desconhecido')
  const bin = achar(a.bin)
  if (!bin) return { id, instalado: false, conectado: false }
  const c = await a.conta(bin).catch(() => ({ ok: false }))
  return { id, instalado: true, conectado: !!c.ok, conta: c.conta, plano: c.plano }
}

// ---------------------------------------------------------------- login (instala se faltar, abre o navegador, espera)
const JOBS = {}
function login(id, { console: emConsole = false } = {}) {
  const a = AGENTES[id]; if (!a) throw new Error('agente desconhecido')
  const job = JOBS[id] = { id, fase: 'conferindo', msg: `Conferindo o ${a.via}`, inicio: Date.now(), log: '' }
  ;(async () => {
    try {
      let bin = achar(a.bin)
      if (!bin) {
        Object.assign(job, { fase: 'instalando', msg: `Instalando o ${a.via} (leva um ou dois minutos)` })
        await instalar(a, job)
        bin = achar(a.bin)
        if (!bin) throw new Error(`Instalei o ${a.via}, mas não achei o comando. Feche e abra o Farol de novo.`)
      }
      const ja = await a.conta(bin).catch(() => ({ ok: false }))
      if (ja.ok) return Object.assign(job, { fase: 'ok', msg: `Conectado`, conta: ja.conta })
      a.antesDoLogin && a.antesDoLogin()
      Object.assign(job, { fase: 'abrindo', msg: 'Abrindo o login no navegador' })
      if (emConsole || !a.login.length) console_(`Entrar no ${a.nome}`, bin, a.loginConsole || a.login)
      else {
        const p = soltar(bin, a.login, { stdio: ['pipe', 'pipe', 'pipe'] }); p.stdin.end()
        let abriu = false
        const ler = b => { job.log = (job.log + b).slice(-2000); const m = !abriu && String(b).match(/https:\/\/[^\s"'<>]+/); if (m && /auth|login|oauth|signin|device/i.test(m[0])) { abriu = true; setTimeout(() => job.fase === 'esperando' && abrirUrl(m[0]), 2500) } }
        p.stdout.on('data', ler); p.stderr.on('data', ler); p.on('error', () => {})
        job.proc = p
      }
      Object.assign(job, { fase: 'esperando', msg: 'Esperando você entrar na sua conta' })
      for (let i = 0; i < 100 && JOBS[id] === job && job.fase === 'esperando'; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const c = await a.conta(bin).catch(() => ({ ok: false }))
        if (c.ok) { Object.assign(job, { fase: 'ok', msg: 'Conectado', conta: c.conta }); break }
      }
      if (job.fase === 'esperando') Object.assign(job, { fase: 'erro', msg: 'O login não terminou a tempo. Tente de novo.' })
    } catch (e) { Object.assign(job, { fase: 'erro', msg: e.message }) }
    finally { if (job.proc && job.fase !== 'esperando') { try { job.proc.kill() } catch {} } }
  })()
  return pub(job)
}
const pub = j => j && ({ id: j.id, fase: j.fase, msg: j.msg, conta: j.conta })
const job = id => pub(JOBS[id])
function cancelar(id) { const j = JOBS[id]; if (j) { try { j.proc && j.proc.kill() } catch {} delete JOBS[id] } }

async function instalar(a, job) {
  const i = a.instalar
  let r
  if (i.tipo === 'npm') {
    const npmBin = achar('npm')
    if (!npmBin) throw new Error(`Para instalar o ${a.via} o Farol precisa do Node.js (nodejs.org). Instale e tente de novo.`)
    r = await rodar(npmBin, ['i', '-g', i.pkg], { timeout: 600000 })
  } else if (i.tipo === 'ps') r = await rodar('powershell.exe', ['-NoProfile', '-Command', i.cmd], { timeout: 600000 })
  else r = await rodar('sh', ['-c', i.cmd], { timeout: 600000 })
  job.log = (r.out + r.err).slice(-2000)
  if (r.code) throw new Error(`Não consegui instalar o ${a.via}: ${(r.err || r.out).trim().split('\n').pop().slice(0, 200)}`)
}

// ---------------------------------------------------------------- sincronização (skills, prompts, plugins, trava, teste)
const ROTINAS = { 'daily-ui': { titulo: 'Gerar o Daily UI de hoje', prompt: 'prompts/daily-ui.md' }, 'pauta-noticias': { titulo: 'Montar os carrosséis de notícias', prompt: 'prompts/pauta-noticias.md' } }
const skillsFonte = () => { try { return fs.readdirSync(path.join(FONTE, 'skills')).filter(n => fs.existsSync(path.join(FONTE, 'skills', n, 'SKILL.md'))) } catch { return [] } }
function copiarPasta(de, para) { fs.mkdirSync(para, { recursive: true }); for (const f of fs.readdirSync(de, { withFileTypes: true })) { const a = path.join(de, f.name), b = path.join(para, f.name); f.isDirectory() ? copiarPasta(a, b) : fs.copyFileSync(a, b) } }
const descricao = arq => (fs.readFileSync(path.join(ROOT, arq), 'utf8').split('\n')[0] || '').replace(/^Você vai /, '').slice(0, 120)

let SYNC = null
function sincronizar(id, desigma) {
  const a = AGENTES[id]; if (!a) throw new Error('agente desconhecido')
  if (SYNC && !SYNC.fim) throw new Error('A sincronização já está rodando.')
  const skills = skillsFonte(), rot = Object.entries(ROTINAS)
  const passos = [
    { id: 'conta', rotulo: `Conferindo a sua conta do ${a.nome}` },
    { id: 'instrucoes', rotulo: 'Ensinando as regras do Farol' },
    { id: 'skills', rotulo: `Instalando ${skills.length} skills` },
    { id: 'prompts', rotulo: `Copiando ${rot.length} prompts das rotinas` },
    { id: 'plugins', rotulo: 'Ligando o Desigma (plugin MCP)' },
    { id: 'trava', rotulo: 'Travando a publicação para o agente' },
    { id: 'teste', rotulo: `Testando uma resposta do ${a.nome}` },
  ].map(p => ({ ...p, estado: 'espera', detalhe: '' }))
  SYNC = { agente: id, nome: a.nome, passos, inicio: Date.now(), fim: null, ok: false, resumo: { skills: 0, prompts: 0, plugins: 0 } }
  const S = SYNC
  const passo = async (pid, fn) => {
    const p = passos.find(x => x.id === pid); p.estado = 'rodando'
    const t0 = Date.now()
    try { const d = await fn(); p.estado = d && d.aviso ? 'aviso' : 'ok'; p.detalhe = (d && (d.aviso || d.detalhe)) || '' } catch (e) { p.estado = 'falhou'; p.detalhe = e.message }
    const falta = 450 - (Date.now() - t0); if (falta > 0) await new Promise(r => setTimeout(r, falta))   // dá tempo de ler cada passo
    return p.estado
  }
  ;(async () => {
    const bin = achar(a.bin)
    if (await passo('conta', async () => {
      if (!bin) throw new Error(`O ${a.via} não está instalado.`)
      const c = await a.conta(bin); if (!c.ok) throw new Error('Você ainda não entrou na sua conta.')
      return { detalhe: c.conta }
    }) === 'falhou') { passos.filter(p => p.estado === 'espera').forEach(p => (p.estado = 'pulado')); S.fim = Date.now(); return }

    await passo('instrucoes', () => {
      const base = fs.readFileSync(path.join(FONTE, 'AGENTS.md'), 'utf8')
      escrever(path.join(ROOT, a.instrucoes), `<!-- gerado pelo Farol a partir de agent/AGENTS.md: edite lá e sincronize de novo -->\n${base}`)
      return { detalhe: a.instrucoes }
    })
    await passo('skills', () => {
      for (const dir of a.skills) for (const n of skills) copiarPasta(path.join(FONTE, 'skills', n), path.join(ROOT, dir, n))
      S.resumo.skills = skills.length
      return { detalhe: skills.join(', ') }
    })
    await passo('prompts', () => {
      for (const [rid, r] of rot) {
        const { arq, fmt } = a.prompts('farol-' + rid), corpo = fs.readFileSync(path.join(ROOT, r.prompt), 'utf8')
        escrever(arq, fmt === 'toml' ? `description = ${JSON.stringify(r.titulo)}\nprompt = """\n${corpo.replace(/"""/g, '\\"\\"\\"')}\n"""\n` : `---\ndescription: ${r.titulo}\n---\n\n${corpo}`)
      }
      S.resumo.prompts = rot.length
      return { detalhe: rot.map(([rid]) => '/farol-' + rid).join(', ') }
    })
    await passo('plugins', async () => {
      if (!desigma || !desigma.mcpOk) return { aviso: 'Desigma não encontrado neste computador. Dá para ligar depois em Ajustes.' }
      const r = await a.plugins(desigma, bin); S.resumo.plugins = 1
      return { detalhe: r || 'desigma' }
    })
    await passo('trava', () => ({ detalhe: a.trava() }))
    await passo('teste', async () => {
      const r = await rodar(bin, a.teste, { timeout: 120000 })
      if (r.code !== 0 || !/ok/i.test(r.out)) return { aviso: 'O agente demorou ou não respondeu. As rotinas devem funcionar mesmo assim; se não, sincronize de novo.' }
      return { detalhe: 'respondeu "ok"' }
    })
    C.save({ agente: { id, sincronizado: new Date().toISOString(), desigma: S.resumo.plugins > 0 } })
    S.ok = !passos.some(p => p.estado === 'falhou'); S.fim = Date.now()
  })()
  return estadoSync()
}
const estadoSync = () => SYNC && { agente: SYNC.agente, nome: SYNC.nome, passos: SYNC.passos, fim: SYNC.fim, ok: SYNC.ok, resumo: SYNC.resumo }

// ---------------------------------------------------------------- rotinas (o agente escolhido, sem ninguém no teclado)
function rotina(id, rid) {
  const a = AGENTES[id], r = ROTINAS[rid]; if (!a || !r) throw new Error('rotina ou agente desconhecido')
  const bin = achar(a.bin); if (!bin) throw new Error(`O ${a.via} não está instalado.`)
  const { args, stdin } = a.rotina(r.prompt)
  const p = soltar(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  p.stdin.end(stdin || '')
  return p
}
// comando para o Agendador de Tarefas do Windows
function agendamento(id, rid) {
  const a = AGENTES[id] || AGENTES.claude, r = ROTINAS[rid]
  const { args, stdin } = a.rotina(r.prompt)
  const linha = [a.bin, ...args.map(aspas)].join(' ') + (stdin ? ` < ${r.prompt.replace(/\//g, '\\')}` : '')
  return `schtasks /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:00 /TN "Farol - ${r.titulo}" /TR "cmd /c cd /d ${ROOT} && ${linha.replace(/"/g, '\\"')}"`
}

module.exports = { AGENTES, ROTINAS, lista, status, login, job, cancelar, sincronizar, estadoSync, rotina, agendamento, achar, abrirUrl }
