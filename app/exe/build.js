// Gera dist/Vynco/Vynco.exe (Node SEA) com ícone. Uso: node app/exe/build.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..', '..'), EXE = __dirname
const OUT = path.join(ROOT, 'dist', 'Vynco'); fs.mkdirSync(OUT, { recursive: true })
const edge = ['ProgramFiles(x86)', 'ProgramFiles'].map(k => process.env[k] && path.join(process.env[k], 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(p => p && fs.existsSync(p))

// 1) ícone: SVG -> PNG 256 (Edge headless) -> ICO com PNG embutido
const png = path.join(OUT, '..', 'icone-256.png'), ico = path.join(OUT, '..', 'vynco.ico')
const html = path.join(OUT, '..', 'icone.html')
fs.writeFileSync(html, `<html><body style="margin:0;background:transparent">${fs.readFileSync(path.join(EXE, 'icone.svg'), 'utf8')}</body></html>`)
for (let i = 0; i < 4 && !fs.existsSync(png); i++) { try { execFileSync(edge, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(OUT, '..', 'edge-perfil')}`, '--default-background-color=00000000', '--hide-scrollbars', '--window-size=256,256', `--screenshot=${png}`, require('url').pathToFileURL(html).href], { stdio: 'ignore', timeout: 30000 }) } catch {}; for (let t = 0; t < 40 && !fs.existsSync(png); t++) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},250)']) }
const p = fs.readFileSync(png), h = Buffer.alloc(22)
h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4)
h.writeUInt8(0, 6); h.writeUInt8(0, 7); h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(p.length, 14); h.writeUInt32LE(22, 18)
fs.writeFileSync(ico, Buffer.concat([h, p]))

// 2) executável
const cfg = path.join(OUT, '..', 'sea-config.json')
fs.writeFileSync(cfg, JSON.stringify({ main: path.join(EXE, 'launcher.js'), output: path.join(OUT, 'Vynco.exe'), disableExperimentalSEAWarning: true, useCodeCache: false }))
execFileSync(process.execPath, ['--build-sea', cfg], { stdio: 'inherit' })
console.log('ok:', path.join(OUT, 'Vynco.exe'), 'ícone:', ico)

// 3) ícone e dados do arquivo (opcional: precisa do rcedit, ex. RCEDIT=caminho\rcedit-x64.exe)
const exe = path.join(OUT, 'Vynco.exe'), v = require(path.join(ROOT, 'package.json')).version
if (process.env.RCEDIT && fs.existsSync(process.env.RCEDIT)) {
  execFileSync(process.env.RCEDIT, [exe, '--set-icon', ico, '--set-file-version', v, '--set-product-version', v,
    '--set-version-string', 'ProductName', 'Vynco', '--set-version-string', 'FileDescription', 'Vynco',
    '--set-version-string', 'CompanyName', 'Otavio Guerra', '--set-version-string', 'OriginalFilename', 'Vynco.exe',
    '--set-version-string', 'LegalCopyright', 'MIT'], { stdio: 'inherit' })
  console.log('ícone aplicado')
} else console.log('sem RCEDIT: o exe fica com o ícone padrão do Node')

// 4) sem janela preta de console: muda o subsistema do PE para GUI (2)
const b = fs.readFileSync(exe), pe = b.readUInt32LE(0x3c)
if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('PE inválido')
b.writeUInt16LE(2, pe + 0x5c); fs.writeFileSync(exe, b)
console.log('subsistema GUI')
