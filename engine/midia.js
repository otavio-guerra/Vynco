'use strict'
// Biblioteca de mídia do Vynco: tudo o que pode ir num post. Os arquivos ficam onde estão:
//   workspace/midia/          o que você enviou (e, na Etapa 4, o que os provedores de imagem gerarem)
//   dailyui/, series/, noticias/  o que as rotinas geraram (só leitura aqui)
// workspace/midia/index.json guarda o que não dá para ler do arquivo: texto alternativo, origem, prompt, provedor,
// custo e a imagem "mãe" de uma variação. Também guarda as medidas já lidas, para não abrir o arquivo toda vez.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')

const MB = 1024 * 1024
const DIR = C.ws('midia'), INDEX = path.join(DIR, 'index.json'), LIXEIRA = C.ws('lixeira', 'midia')
const TIPO = { png: 'imagem', jpg: 'imagem', jpeg: 'imagem', gif: 'gif', mp4: 'video', pdf: 'documento', ppt: 'documento', pptx: 'documento', doc: 'documento', docx: 'documento' }
// limites documentados pelo LinkedIn (Images, Videos e Documents API)
const LIMITES = { imagemPixels: 36152320, gifQuadros: 250, videoMin: 75 * 1024, videoMax: 500 * MB, documentoMax: 100 * MB, alt: 4086 }
const FONTES = [['midia', 'envio'], ['dailyui/png', 'dailyui'], ['dailyui/gif', 'dailyui'], ['series/png', 'serie'], ['series/gif', 'serie'], ['noticias/pdf', 'noticias']]

const ext = f => path.extname(f).slice(1).toLowerCase()
const tipoDe = f => TIPO[ext(f)] || null
const rel = abs => path.relative(C.WS, abs).split(path.sep).join('/')
function caminho(r) {   // de "midia/x.png" para o caminho real, sem sair do workspace
  const p = path.resolve(C.WS, String(r || ''))
  if (!p.startsWith(C.WS + path.sep)) throw new Error('arquivo fora do workspace')
  return p
}

function lerIndex() { try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')) } catch { return {} } }
function gravarIndex(o) { fs.mkdirSync(DIR, { recursive: true }); const tmp = INDEX + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o, null, 2), 'utf8'); fs.renameSync(tmp, INDEX) }

// medidas lidas do cabeçalho (PNG, GIF, JPEG) e quadros de um GIF, sem dependências
function medir(abs, t) {
  const fd = fs.openSync(abs, 'r'), b = Buffer.alloc(65536); const n = fs.readSync(fd, b, 0, b.length, 0); fs.closeSync(fd)
  const m = {}
  if (b.readUInt32BE(0) === 0x89504e47) { m.w = b.readUInt32BE(16); m.h = b.readUInt32BE(20) }
  else if (b.toString('latin1', 0, 3) === 'GIF') { m.w = b.readUInt16LE(6); m.h = b.readUInt16LE(8) }
  else if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < n - 9;) {
      if (b[i] !== 0xff) { i++; continue }
      const mk = b[i + 1], len = b.readUInt16BE(i + 2)
      if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) { m.h = b.readUInt16BE(i + 5); m.w = b.readUInt16BE(i + 7); break }
      i += 2 + len
    }
  }
  if (t === 'gif') { const g = fs.readFileSync(abs); let q = 0; for (let i = 0; i < g.length - 2; i++) if (g[i] === 0x21 && g[i + 1] === 0xf9 && g[i + 2] === 0x04) q++; m.q = q || 1 }
  return m
}
function avisos(t, bytes, m) {
  const a = []
  if ((t === 'imagem' || t === 'gif') && m.w && m.w * m.h >= LIMITES.imagemPixels) a.push('imagem grande demais para o LinkedIn (máximo de 36 milhões de pixels)')
  if (t === 'gif' && m.q > LIMITES.gifQuadros) a.push(`GIF com ${m.q} quadros (o LinkedIn aceita até ${LIMITES.gifQuadros})`)
  if (t === 'video' && (bytes < LIMITES.videoMin || bytes > LIMITES.videoMax)) a.push('vídeo fora do limite do LinkedIn (de 75 KB a 500 MB)')
  if (t === 'documento' && bytes > LIMITES.documentoMax) a.push('documento acima de 100 MB')
  return a
}

function listar() {
  const idx = lerIndex(); let mudou = false
  const itens = []
  for (const [pasta, origem] of FONTES) {
    const d = C.ws(...pasta.split('/'))
    let nomes = []; try { nomes = fs.readdirSync(d) } catch { continue }
    for (const nome of nomes) {
      const t = tipoDe(nome); if (!t) continue
      const abs = path.join(d, nome), r = rel(abs), st = fs.statSync(abs)
      const meta = idx[r] || {}
      let m = meta._m && meta._m.t === st.mtimeMs ? meta._m : null
      if (!m && (t === 'imagem' || t === 'gif')) { try { m = { ...medir(abs, t), t: st.mtimeMs } } catch { m = { t: st.mtimeMs } } idx[r] = { ...meta, _m: m }; mudou = true }
      m = m || {}
      itens.push({ arquivo: r, nome, tipo: t, bytes: st.size, criado: st.mtimeMs, origem: meta.origem || origem, largura: m.w, altura: m.h, quadros: m.q, alt: meta.alt || '', prompt: meta.prompt, provedor: meta.provedor, custo: meta.custo, mae: meta.mae, avisos: avisos(t, st.size, m), apagavel: pasta === 'midia' })
    }
  }
  if (mudou) gravarIndex(idx)
  return itens.sort((a, b) => b.criado - a.criado)
}

// nome de arquivo seguro e único em workspace/midia (data + nome original)
function nomeNovo(original) {
  const e = ext(original), base = path.basename(original, path.extname(original)).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'arquivo'
  const dia = new Date().toISOString().slice(0, 10)
  let n = `${dia}-${base}.${e}`, k = 2
  while (fs.existsSync(path.join(DIR, n))) n = `${dia}-${base}-${k++}.${e}`
  return n
}
// recebe um arquivo enviado pela tela (stream) e grava na biblioteca
function receber(original, stream, { maxBytes = 600 * MB, meta = {} } = {}) {
  return new Promise((ok, falha) => {
    const t = tipoDe(original)
    if (!t) return falha(new Error('formato não aceito: use PNG, JPG, GIF, MP4, PDF, PPT(X) ou DOC(X)'))
    fs.mkdirSync(DIR, { recursive: true })
    const nome = nomeNovo(original), final = path.join(DIR, nome), tmp = final + '.parte'
    const out = fs.createWriteStream(tmp); let bytes = 0, parou = false
    const desistir = e => { if (parou) return; parou = true; out.destroy(); fs.rm(tmp, { force: true }, () => falha(e)) }
    stream.on('data', c => { bytes += c.length; if (bytes > maxBytes) { desistir(new Error('arquivo grande demais')); stream.destroy() } })
    stream.on('error', desistir); out.on('error', desistir)
    out.on('finish', () => {
      if (parou) return
      fs.renameSync(tmp, final)
      if (Object.keys(meta).length) registrar(rel(final), meta)
      ok(listar().find(i => i.arquivo === rel(final)))
    })
    stream.pipe(out)
  })
}
// grava na biblioteca um arquivo que já está na memória (ex.: imagem baixada de um provedor), com os metadados dele
function guardar(original, buffer, meta = {}) {
  if (!tipoDe(original)) throw new Error('formato não aceito')
  fs.mkdirSync(DIR, { recursive: true })
  const nome = nomeNovo(original), final = path.join(DIR, nome)
  fs.writeFileSync(final, buffer)
  registrar(rel(final), meta)
  return listar().find(i => i.arquivo === rel(final))
}
// metadados de um arquivo (texto alternativo, origem, prompt, provedor, custo, mãe)
function registrar(r, meta) { caminho(r); const idx = lerIndex(); idx[r] = { ...(idx[r] || {}), ...meta }; gravarIndex(idx) }
function definirAlt(r, alt) {
  alt = String(alt || '').trim()
  if (alt.length > LIMITES.alt) throw new Error(`o texto alternativo aceita até ${LIMITES.alt} caracteres`)
  if (!fs.existsSync(caminho(r))) throw new Error('arquivo não encontrado')
  registrar(r, { alt })
}
// só o que você enviou pode sair da biblioteca; vai para a lixeira do workspace (dá para recuperar)
function excluir(r) {
  if (!String(r).startsWith('midia/')) throw new Error('só arquivos enviados por você podem ser excluídos daqui')
  const abs = caminho(r); fs.mkdirSync(LIXEIRA, { recursive: true })
  fs.renameSync(abs, path.join(LIXEIRA, `${Date.now()}-${path.basename(abs)}`))
  const idx = lerIndex(); delete idx[r]; gravarIndex(idx)
}
const altDe = r => (lerIndex()[r] || {}).alt || ''

module.exports = { listar, receber, guardar, registrar, definirAlt, excluir, altDe, caminho, tipoDe, LIMITES, TIPO }
