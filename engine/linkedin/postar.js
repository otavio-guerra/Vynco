'use strict'
// Publica um post com legenda no seu perfil do LinkedIn pela API oficial (Posts API): imagem (PNG/JPG), GIF, carrossel (PDF) ou vídeo (MP4).
// Sem --confirmo, só mostra o que seria publicado. Só use --confirmo depois que o post for aprovado no Farol.
// Uso: node postar.js <arquivo.png|gif|pdf|mp4> <legenda.txt> [--confirmo]
const fs = require('fs')
const path = require('path')

const DIR = __dirname
const [img, txt, flag] = process.argv.slice(2)
const C = require('../config.js')
// as chaves do app só são usadas no login; aqui basta o token (vale para a ponte do Farol e para o app próprio)
const cfg = { version: C.cfg.linkedin.version }
const tok = JSON.parse(fs.readFileSync(C.LINKEDIN.token, 'utf8'))
const legenda = fs.readFileSync(txt, 'utf8').trim()

if (Date.now() > tok.expires_at - 86400000) { console.error('O acesso ao LinkedIn venceu (ou vence hoje). Reconecte no Farol (Ajustes).'); process.exit(2) }

// "little text" do LinkedIn: caracteres reservados com barra; #tag vira hashtag de verdade
const RESERV = /[\\|{}@\[\]()<>*_~]/g
const commentary = legenda.split(/(#[\p{L}\p{N}_]+)/u).map(p => p.startsWith('#') && p.length > 1 ? `{hashtag|\\#|${p.slice(1)}}` : p.replace(RESERV, m => '\\' + m).replace(/#/g, '\\#')).join('')

if (flag !== '--confirmo') {
  console.log(JSON.stringify({ ensaio: true, autor: tok.nome, imagem: img, caracteres: legenda.length, inicio: legenda.slice(0, 120) }, null, 2))
  console.log('Nada foi publicado. Para publicar: acrescente --confirmo')
  process.exit(0)
}

const H = { Authorization: `Bearer ${tok.access_token}`, 'LinkedIn-Version': cfg.version || '202610', 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' }
async function subirArquivo(tipo) {
  const ini = await fetch(`https://api.linkedin.com/rest/${tipo}?action=initializeUpload`, { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: tok.author } }) })
  if (!ini.ok) throw new Error('initializeUpload ' + ini.status + ' ' + await ini.text())
  const { value } = await ini.json()
  const up = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: H.Authorization }, body: fs.readFileSync(img) })
  if (!up.ok) throw new Error('upload ' + up.status + ' ' + await up.text())
  return value.image || value.document
}
// vídeo: o LinkedIn devolve partes de até 4 MB; cada PUT devolve um ETag, que vai no finalizeUpload
async function subirVideo() {
  const buf = fs.readFileSync(img)
  const ini = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: tok.author, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } }) })
  if (!ini.ok) throw new Error('initializeUpload ' + ini.status + ' ' + await ini.text())
  const { value } = await ini.json()
  const partes = []
  for (const p of value.uploadInstructions) {
    const up = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: buf.subarray(p.firstByte, p.lastByte + 1) })
    if (!up.ok) throw new Error('upload ' + up.status + ' ' + await up.text())
    partes.push(up.headers.get('etag'))
  }
  const fim = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', { method: 'POST', headers: H, body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds: partes } }) })
  if (!fim.ok) throw new Error('finalizeUpload ' + fim.status + ' ' + await fim.text())
  // espera o LinkedIn processar (até ~2 min) antes de criar o post
  for (let i = 0; i < 24; i++) {
    const st = await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(value.video)}`, { headers: H }).then(r => r.json()).catch(() => ({}))
    if (st.status === 'AVAILABLE') break
    if (st.status === 'PROCESSING_FAILED') throw new Error('o LinkedIn não conseguiu processar o vídeo')
    await new Promise(r => setTimeout(r, 5000))
  }
  return value.video
}

;(async () => {
  // PDF vira carrossel (Documents API); MP4 vira vídeo (Videos API); PNG/JPG/GIF vira imagem (Images API)
  const doc = /\.pdf$/i.test(img), video = /\.mp4$/i.test(img)
  const media = video ? await subirVideo() : await subirArquivo(doc ? 'documents' : 'images')
  const post = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      author: tok.author, commentary, visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { title: doc || video ? legenda.split('\n')[0].slice(0, 100) : path.basename(img), id: media } },
      lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
    }),
  })
  if (!post.ok) throw new Error('posts ' + post.status + ' ' + await post.text())
  const id = post.headers.get('x-restli-id')
  const log = C.PUBLICADOS
  const lista = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : []
  lista.push({ quando: new Date().toISOString(), imagem: path.basename(img), post: id, link: `https://www.linkedin.com/feed/update/${id}/` })
  fs.writeFileSync(log, JSON.stringify(lista, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, post: id, link: `https://www.linkedin.com/feed/update/${id}/` }))
})().catch(e => { console.error('Falhou, nada foi publicado:', e.message); process.exit(1) })
