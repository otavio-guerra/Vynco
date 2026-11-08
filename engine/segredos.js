'use strict'
// Cofre de segredos do Vynco (token e chaves do LinkedIn, chaves de API de provedores).
// No Windows, tudo fica num único arquivo cifrado com a DPAPI: só o seu usuário, neste computador, consegue abrir.
// Fora do Windows (por enquanto), o arquivo fica em texto com permissão 600, e protegido() devolve false.
// Sem dependências: a DPAPI é chamada pelo PowerShell, com o conteúdo pela entrada padrão (nunca na linha de comando).
//   const S = require('./segredos.js')
//   S.get('linkedin.token')   S.set('linkedin.token', { ... })   S.del('linkedin.token')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const C = require('./config.js')

const IS_WIN = process.platform === 'win32'
const ARQ = C.SEGREDOS
const ENTROPIA = 'vynco-segredos-v1'   // amarra a cifra a este app (outros programas que usam a DPAPI não abrem o arquivo por engano)

function dpapi(modo, b64) {
  const ps = `Add-Type -AssemblyName System.Security; $i=[Console]::In.ReadToEnd().Trim(); $e=[Text.Encoding]::UTF8.GetBytes('${ENTROPIA}'); `
    + `$o=[Security.Cryptography.ProtectedData]::${modo}([Convert]::FromBase64String($i),$e,'CurrentUser'); [Console]::Out.Write([Convert]::ToBase64String($o))`
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { input: b64, windowsHide: true, encoding: 'utf8', timeout: 30000 }).trim()
}
const cifrar = json => IS_WIN ? 'dpapi:' + dpapi('Protect', Buffer.from(json, 'utf8').toString('base64')) : 'texto:' + json
function decifrar(raw) {
  if (raw.startsWith('dpapi:')) return Buffer.from(dpapi('Unprotect', raw.slice(6)), 'base64').toString('utf8')
  if (raw.startsWith('texto:')) return raw.slice(6)
  throw new Error('cofre em formato desconhecido')
}

// a leitura fica guardada na memória enquanto o arquivo não muda (abrir a DPAPI leva ~0,3 s)
let cache = null, versao = null
function ler() {
  migrar()
  let st; try { st = fs.statSync(ARQ) } catch { cache = {}; versao = null; return cache }
  const v = `${st.mtimeMs}:${st.size}`
  if (cache && versao === v) return cache
  cache = JSON.parse(decifrar(fs.readFileSync(ARQ, 'utf8').trim())); versao = v
  return cache
}
function gravar(obj) {
  fs.mkdirSync(path.dirname(ARQ), { recursive: true })
  const tmp = ARQ + '.tmp'
  fs.writeFileSync(tmp, cifrar(JSON.stringify(obj)), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, ARQ)
  const st = fs.statSync(ARQ); cache = obj; versao = `${st.mtimeMs}:${st.size}`
}

const get = (nome, padrao = null) => { const v = ler()[nome]; return v === undefined ? padrao : JSON.parse(JSON.stringify(v)) }
const tem = nome => ler()[nome] !== undefined
function set(nome, valor) { gravar({ ...ler(), [nome]: valor }) }
function del(nome) { const o = { ...ler() }; if (nome in o) { delete o[nome]; gravar(o) } }
const protegido = () => IS_WIN

// migração única: os arquivos antigos em texto puro (config/linkedin.json e config/linkedin-token.json) entram no cofre
// e só são apagados depois de conferir que o cofre devolve exatamente o mesmo conteúdo
let migrado = false
function migrar() {
  if (migrado) return; migrado = true
  const antigos = [['linkedin.app', C.LINKEDIN.config], ['linkedin.token', C.LINKEDIN.token]].filter(([, p]) => fs.existsSync(p))
  if (!antigos.length) return
  let atual = {}
  try { if (fs.existsSync(ARQ)) atual = JSON.parse(decifrar(fs.readFileSync(ARQ, 'utf8').trim())) } catch (e) { console.error('cofre: não consegui abrir o cofre para migrar:', e.message); return }
  const novos = { ...atual }
  for (const [nome, p] of antigos) { try { novos[nome] = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { /* arquivo inválido: fica onde está */ } }
  gravar(novos)
  const volta = JSON.parse(decifrar(fs.readFileSync(ARQ, 'utf8').trim()))
  for (const [nome, p] of antigos) if (novos[nome] && JSON.stringify(volta[nome]) === JSON.stringify(novos[nome])) fs.unlinkSync(p)
}

module.exports = { get, set, del, tem, protegido, ARQ }
