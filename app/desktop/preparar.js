'use strict'
// Prepara o build desktop (Tauri): copia o Node desta máquina para src-tauri/binaries como o "farol-node" do app.
// O Tauri exige o nome com o "target triple" do Rust: farol-node-<triple>.exe (ex.: x86_64-pc-windows-msvc).
// Roda sozinho em "npm run desktop:dev" e "npm run desktop:build".
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const [maior, menor] = process.versions.node.split('.').map(Number)
// a caixa de permissões (engine/caixa.js) precisa do Node 22.13+; no 25+ ela também bloqueia a rede
if (maior < 22 || (maior === 22 && menor < 13)) { console.error(`O Node ${process.version} não tem a caixa de permissões. Use o Node 22.13 ou mais novo para gerar o app.`); process.exit(1) }

let triplo = 'x86_64-pc-windows-msvc'
try { triplo = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/host: (\S+)/)[1] } catch { console.log('rustc não encontrado: usando', triplo) }
const ext = process.platform === 'win32' ? '.exe' : ''
const destino = path.join(ROOT, 'src-tauri', 'binaries', `farol-node-${triplo}${ext}`)
fs.mkdirSync(path.dirname(destino), { recursive: true })
const igual = fs.existsSync(destino) && fs.statSync(destino).size === fs.statSync(process.execPath).size
if (!igual) fs.copyFileSync(process.execPath, destino)
console.log(`farol-node: Node ${process.version} → ${path.relative(ROOT, destino)}${igual ? ' (já estava)' : ''}`)
