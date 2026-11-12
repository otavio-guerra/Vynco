'use strict'
// Atualizações do Vynco sem sair do app.
// - procurar(): lê a versão mais nova publicada no GitHub (API pública, sem login) e compara com a deste app;
// - baixar(): baixa o instalador da versão nova para uma pasta temporária e confere tamanho, assinatura "MZ" e o
//   SHA-256 que o próprio GitHub publica para o arquivo (campo digest). Sem essa conferência, nada é aberto;
// - instalar(): abre o instalador baixado. O Vynco fecha para o instalador trocar os arquivos; os posts, a
//   configuração e o cofre ficam em Documentos\Vynco e não são tocados.
// Só aceita arquivos do repositório oficial (REPO) com o nome do instalador do Vynco.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFileSync } = require('child_process')
const C = require('./config.js')

const REPO = 'otavio-guerra/Vynco'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const BAIXAR_DE = `https://github.com/${REPO}/releases/download/`
const NOME_OK = /^Vynco_\d+\.\d+\.\d+_x64-setup\.exe$/
const PASTA = path.join(os.tmpdir(), 'vynco-atualizacao')
const CACHE = 6 * 3600 * 1000   // procura no máximo a cada 6 horas (a API pública aceita 60 pedidos por hora)

const atual = () => { try { return require(path.join(__dirname, '..', 'package.json')).version } catch { return '0.0.0' } }
const numeros = v => String(v || '').replace(/^v/, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0)
function maisNova(a, b) { const x = numeros(a), y = numeros(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false }

let ULTIMA = null, BAIXA = null   // BAIXA: { fase: 'baixando'|'pronto'|'erro', feito, total, arquivo, versao, erro }

async function procurar({ forcar = false } = {}) {
  if (!forcar && ULTIMA && Date.now() - ULTIMA.t < CACHE) return estado()
  try {
    const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Vynco-app' }, signal: AbortSignal.timeout(15000) })
    if (r.status === 404) { ULTIMA = { t: Date.now(), erro: null, versao: null }; return estado() }
    if (!r.ok) throw new Error(r.status === 403 ? 'o GitHub limitou as consultas por agora; tente de novo em uma hora' : `o GitHub respondeu ${r.status}`)
    const j = await r.json()
    const exe = (j.assets || []).find(a => NOME_OK.test(a.name) && String(a.browser_download_url || '').startsWith(BAIXAR_DE))
    ULTIMA = {
      t: Date.now(), erro: null, versao: String(j.tag_name || '').replace(/^v/, ''), nome: j.name || j.tag_name, publicada: j.published_at,
      notas: String(j.body || '').slice(0, 6000), pagina: String(j.html_url || '').startsWith(`https://github.com/${REPO}/`) ? j.html_url : `https://github.com/${REPO}/releases/latest`,
      exe: exe ? { nome: exe.name, url: exe.browser_download_url, tamanho: exe.size, sha256: /^sha256:[0-9a-f]{64}$/.test(exe.digest || '') ? exe.digest.slice(7) : null } : null,
    }
    C.save({ atualizacao: { procurada: new Date().toISOString() } })
  } catch (e) { ULTIMA = { t: Date.now() - CACHE + 10 * 60000, erro: 'Não consegui procurar agora: ' + (e.name === 'TimeoutError' ? 'sem resposta do GitHub' : e.message) } }
  return estado()
}

function estado() {
  const cfg = C.load().atualizacao || {}, u = ULTIMA || {}
  const nova = !!(u.versao && maisNova(u.versao, atual()))
  return {
    atual: atual(), procurada: cfg.procurada || null, avisar: cfg.avisar !== false, erro: u.erro || null,
    nova: nova ? { versao: u.versao, nome: u.nome, publicada: u.publicada, notas: u.notas, pagina: u.pagina, tamanho: u.exe && u.exe.tamanho, instalavel: !!u.exe } : null,
    download: BAIXA && BAIXA.versao === u.versao ? { fase: BAIXA.fase, feito: BAIXA.feito, total: BAIXA.total, erro: BAIXA.erro || null } : null,
  }
}

async function baixar() {
  const u = ULTIMA
  if (!u || !u.versao || !maisNova(u.versao, atual())) throw new Error('Não há versão nova para baixar.')
  if (!u.exe) throw new Error('Esta versão não trouxe o instalador para Windows. Abra a página da versão.')
  if (BAIXA && BAIXA.versao === u.versao && ['baixando', 'pronto'].includes(BAIXA.fase)) return estado()
  BAIXA = { fase: 'baixando', feito: 0, total: u.exe.tamanho || 0, versao: u.versao }
  ;(async () => {
    try {
      fs.mkdirSync(PASTA, { recursive: true })
      const destino = path.join(PASTA, u.exe.nome), tmp = destino + '.parcial'
      const r = await fetch(u.exe.url, { headers: { 'User-Agent': 'Vynco-app' }, redirect: 'follow', signal: AbortSignal.timeout(15 * 60000) })
      if (!r.ok || !r.body) throw new Error(`o download falhou (${r.status})`)
      const hash = crypto.createHash('sha256'), out = fs.createWriteStream(tmp)
      for await (const parte of r.body) { hash.update(parte); BAIXA.feito += parte.length; if (!out.write(parte)) await new Promise(ok => out.once('drain', ok)) }
      await new Promise((ok, erro) => out.end(e => e ? erro(e) : ok()))
      const cab = Buffer.alloc(2); const fd = fs.openSync(tmp, 'r'); fs.readSync(fd, cab, 0, 2, 0); fs.closeSync(fd)
      if (cab.toString('latin1') !== 'MZ') throw new Error('o arquivo baixado não é um instalador do Windows')
      if (u.exe.tamanho && BAIXA.feito !== u.exe.tamanho) throw new Error('o arquivo veio incompleto')
      const sha = hash.digest('hex')
      if (u.exe.sha256 && sha !== u.exe.sha256) throw new Error('a impressão digital do arquivo não confere com a publicada no GitHub')
      fs.rmSync(destino, { force: true }); fs.renameSync(tmp, destino)
      Object.assign(BAIXA, { fase: 'pronto', arquivo: destino, conferido: !!u.exe.sha256 })
    } catch (e) { Object.assign(BAIXA, { fase: 'erro', erro: 'Não consegui baixar: ' + e.message }) }
  })()
  return estado()
}

// abre o instalador e fecha o Vynco (o app desktop é o processo pai deste Node)
function instalar() {
  if (!BAIXA || BAIXA.fase !== 'pronto' || !BAIXA.arquivo || !fs.existsSync(BAIXA.arquivo)) throw new Error('Baixe a versão nova antes.')
  return new Promise((ok, erro) => {
    const p = spawn(BAIXA.arquivo, [], { detached: true, stdio: 'ignore', windowsHide: false })
    p.once('error', e => erro(new Error(/EACCES|UNKNOWN|blocked|bloque/i.test(e.message + e.code)
      ? 'O Windows não deixou abrir o instalador (o Controle Inteligente de Aplicativos bloqueia programas sem assinatura digital). Abra a página da versão e instale por lá.'
      : 'Não consegui abrir o instalador: ' + e.message)))
    p.once('spawn', () => {
      p.unref(); ok({ ok: true })
      // dá tempo do instalador abrir e fecha o app, para ele poder trocar os arquivos
      setTimeout(() => {
        if (!process.env.VYNCO_DESKTOP) return   // rodando pelo terminal (npm start): só abre o instalador
        try {
          const pai = execFileSync('tasklist', ['/FI', `PID eq ${process.ppid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
          if (/^"vynco\.exe"/i.test(pai.trim())) execFileSync('taskkill', ['/PID', String(process.ppid), '/F'], { windowsHide: true })
        } catch { }
        process.exit(0)
      }, 1500)
    })
  })
}

function preferir({ avisar }) { C.save({ atualizacao: { avisar: !!avisar } }); return estado() }

module.exports = { procurar, estado, baixar, instalar, preferir, atual, maisNova }
