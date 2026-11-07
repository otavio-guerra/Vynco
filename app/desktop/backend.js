'use strict'
// Backend da versão desktop (Tauri). O Tauri roda o Node que vem dentro do app com este arquivo e:
// 1) copia o motor dos recursos do app para a pasta de trabalho do usuário (Documentos\Farol),
//    sem tocar no que é dele (config/, workspace/ e o que a IA escreveu em dias/ e pautas/);
// 2) põe um "node" na frente do PATH, para as IAs (as rotinas chamam "node engine/..." mesmo sem Node instalado);
// 3) sobe o painel (app/server.js), que avisa a porta numa linha "Farol: http://127.0.0.1:<porta>/" (o Tauri lê e abre a janela).
// O Tauri passa FAROL_RECURSOS (<recursos do app>\farol) e FAROL_HOME (<Documentos>\Farol).
const fs = require('fs')
const path = require('path')

const RECURSOS = path.resolve(process.env.FAROL_RECURSOS || path.join(__dirname, '..', '..'))
const CASA = path.resolve(process.env.FAROL_HOME || RECURSOS)
// onde a IA escreve: uma atualização nunca sobrescreve um arquivo que já existe aqui
const DO_USUARIO = [['engine', 'dailyui', 'dias'], ['engine', 'noticias', 'pautas']].map(p => path.join(...p))

function sincronizar() {
  if (CASA === RECURSOS) return
  fs.mkdirSync(CASA, { recursive: true })
  fs.cpSync(RECURSOS, CASA, {
    recursive: true, force: true, preserveTimestamps: true,
    filter: (de, para) => { const rel = path.relative(RECURSOS, de); return !(DO_USUARIO.some(p => rel.startsWith(p + path.sep)) && fs.existsSync(para)) },
  })
}

function nodeParaAsIas() {
  const bin = path.join(CASA, 'bin'); fs.mkdirSync(bin, { recursive: true })
  const exe = process.execPath.replace(/\\/g, '/')
  fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\nexec "${exe}" "$@"\n`, { mode: 0o755 })   // Git Bash (Claude Code)
  if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'node.cmd'), `@"${process.execPath}" %*\r\n`)   // cmd e PowerShell
  process.env.PATH = bin + path.delimiter + (process.env.PATH || '')
}

try { sincronizar(); nodeParaAsIas() } catch (e) { console.error('Farol: não consegui preparar a pasta de trabalho:', e.message); process.exit(3) }
process.env.FAROL_DESKTOP = '1'      // o painel passa a abrir links e arquivos fora da janela do app
process.env.FAROL_PORTA_LIVRE = '1'  // se a porta 4800 estiver ocupada, usa outra livre
process.chdir(CASA)
require(path.join(CASA, 'app', 'server.js'))
