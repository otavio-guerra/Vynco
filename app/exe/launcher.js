// Vynco.exe: inicia o painel local e abre numa janela própria (Edge em modo app).
// Também serve de "node" para os scripts do motor: Vynco.exe script.js args...
const path = require('path'), fs = require('fs'), http = require('http')
const { spawn } = require('child_process')
const { createRequire } = require('module')

const ROOT = path.dirname(process.execPath)
const carregar = arq => createRequire(arq)(arq)

// 1) modo script: o servidor chama process.execPath com um .js (publicar, exportar, OAuth)
const alvo = process.argv[2]
if (alvo && /\.c?js$/i.test(alvo)) {
  const arq = path.resolve(alvo)
  process.argv = [process.argv[0], arq, ...process.argv.slice(3)]
  carregar(arq)
  return
}

// 2) modo app (sem console: o que o servidor escreve vai para um log)
const DADOS = path.join(process.env.LOCALAPPDATA || ROOT, 'Vynco'); fs.mkdirSync(DADOS, { recursive: true })
const log = fs.createWriteStream(path.join(DADOS, 'vynco.log'), { flags: 'a' })
console.log = console.info = console.warn = console.error = (...a) => log.write(a.map(String).join(' ') + '\n')
process.on('uncaughtException', e => { log.write(String(e && e.stack || e) + '\n') })
const falha = msg => { spawn('mshta', [`javascript:alert(${JSON.stringify(msg)});close()`], { detached: true, stdio: 'ignore' }).unref(); process.exit(1) }
if (!fs.existsSync(path.join(ROOT, 'app', 'server.js'))) falha('O Vynco.exe precisa ficar dentro da pasta do Vynco, junto das pastas app e engine. Extraia o zip inteiro e abra de novo.')

const C = carregar(path.join(ROOT, 'engine', 'config.js'))
const PORT = +process.env.PORT || C.cfg.app.port || 4800
const URL_ = `http://127.0.0.1:${PORT}/`

const vivo = () => new Promise(ok => http.get(URL_, r => { r.resume(); ok(r.statusCode === 200) }).on('error', () => ok(false)))

function navegador () {
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean)
  const nomes = [['Microsoft', 'Edge', 'Application', 'msedge.exe'], ['Google', 'Chrome', 'Application', 'chrome.exe'], ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe']]
  for (const n of nomes) for (const b of pf) { const p = path.join(b, ...n); if (fs.existsSync(p)) return p }
  return null
}

function janela () {
  const nav = navegador()
  if (!nav) { spawn('cmd', ['/c', 'start', '', URL_], { detached: true, stdio: 'ignore' }).unref(); return null }
  const perfil = path.join(DADOS, 'janela')
  return spawn(nav, [`--app=${URL_}`, `--user-data-dir=${perfil}`, '--window-size=1240,840', '--no-first-run', '--no-default-browser-check', '--disable-background-mode', '--disable-features=Translate,msEdgeStartupBoost'], { stdio: 'ignore' })
}

;(async () => {
  let dono = false
  if (!(await vivo())) {
    process.chdir(ROOT)
    carregar(path.join(ROOT, 'app', 'server.js'))
    dono = true
    for (let i = 0; i < 50 && !(await vivo()); i++) await new Promise(r => setTimeout(r, 100))
  }
  const w = janela()
  // fechar a janela encerra o Vynco (se fomos nós que subimos o servidor)
  if (w) w.on('exit', () => process.exit(0))
  else if (!dono) process.exit(0)
})()
