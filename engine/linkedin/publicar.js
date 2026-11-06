'use strict'
// Publicação no LinkedIn pela API oficial (Posts API; versão em config: linkedin.version).
// Formatos (posts orgânicos de pessoa, todos com w_member_social):
//   texto · imagem (PNG/JPG) · GIF (até 250 quadros) · várias imagens (2 a 20) · documento/carrossel (PDF, PPT, DOC)
//   vídeo (MP4, 3 s a 30 min) · artigo (link com título, descrição e miniatura; a API não lê a página sozinha)
// O alvo diz o formato:
//   arquivo .png/.jpg/.gif/.pdf/.pptx/.docx/.mp4  →  um arquivo
//   pasta com imagens (+ legenda.txt)               →  várias imagens (uma imagem só vira post de imagem)
//   pasta com link.json (+ miniatura opcional)      →  artigo   { "url": "...", "titulo": "...", "descricao": "..." }
//   "-" ou nada                                     →  só texto
// Texto alternativo: um arquivo <imagem>.alt.txt ao lado da imagem.
const fs = require('fs')
const path = require('path')
const C = require('../config.js')
const contas = require('./contas.js')

const IMG = /\.(png|jpe?g|gif)$/i, DOC = /\.(pdf|pptx?|docx?)$/i, VID = /\.mp4$/i
const LIMITE = 3000   // caracteres do texto de um post
const MB = 1024 * 1024

const lerTxt = p => { try { return fs.readFileSync(p, 'utf8').trim() } catch { return null } }
const altDe = f => lerTxt(f.replace(/\.[^.]+$/, '.alt.txt')) || undefined

// ---------------------------------------------------------------- montar: do alvo para um post (sem rede)
function montar(alvo, legendaArq) {
  const p = { formato: 'texto', arquivos: [], alts: [], artigo: null, alvo: alvo && alvo !== '-' ? path.resolve(alvo) : null }
  if (p.alvo && fs.statSync(p.alvo).isDirectory()) {
    const nomes = fs.readdirSync(p.alvo).sort()
    const link = path.join(p.alvo, 'link.json')
    const imgs = nomes.filter(n => IMG.test(n)).map(n => path.join(p.alvo, n))
    if (fs.existsSync(link)) {
      const j = JSON.parse(fs.readFileSync(link, 'utf8'))
      const mini = imgs.find(f => /^miniatura\./i.test(path.basename(f))) || imgs[0]
      p.formato = 'artigo'; p.artigo = { url: j.url, titulo: j.titulo || j.title, descricao: j.descricao || j.description || '' }
      if (mini) { p.arquivos = [mini]; p.alts = [altDe(mini)] }
    } else {
      p.formato = imgs.length === 1 ? (/\.gif$/i.test(imgs[0]) ? 'gif' : 'imagem') : 'multi'
      p.arquivos = imgs; p.alts = imgs.map(altDe)
    }
    legendaArq = legendaArq || path.join(p.alvo, 'legenda.txt')
  } else if (p.alvo) {
    p.arquivos = [p.alvo]; p.alts = [IMG.test(p.alvo) ? altDe(p.alvo) : undefined]
    p.formato = /\.gif$/i.test(p.alvo) ? 'gif' : IMG.test(p.alvo) ? 'imagem' : DOC.test(p.alvo) ? 'documento' : VID.test(p.alvo) ? 'video' : null
    if (!p.formato) throw new Error(`formato não suportado: ${path.basename(p.alvo)}`)
  }
  p.legenda = legendaArq ? lerTxt(legendaArq) : null
  if (p.legenda == null) throw new Error('legenda não encontrada' + (legendaArq ? `: ${legendaArq}` : ''))
  p.registro = p.alvo ? path.basename(p.alvo) : path.basename(legendaArq)   // nome usado no histórico (e para não publicar duas vezes)
  return p
}

// confere os limites documentados pelo LinkedIn antes de gastar qualquer chamada
function validar(p) {
  const erros = []
  if (p.legenda.length > LIMITE) erros.push(`o texto tem ${p.legenda.length} caracteres (o máximo é ${LIMITE})`)
  if (p.formato === 'texto' && !p.legenda) erros.push('um post só de texto precisa de texto')
  if (p.formato === 'multi' && (p.arquivos.length < 2 || p.arquivos.length > 20)) erros.push(`várias imagens: são de 2 a 20 (há ${p.arquivos.length})`)
  if (p.formato === 'artigo' && !/^https?:\/\//.test(p.artigo.url || '')) erros.push('artigo: link.json precisa de "url" começando com http')
  if (p.formato === 'artigo' && !p.artigo.titulo) erros.push('artigo: link.json precisa de "titulo"')
  for (const f of p.arquivos) {
    const t = fs.statSync(f).size
    if (VID.test(f) && (t < 75 * 1024 || t > 500 * MB)) erros.push(`vídeo: entre 75 KB e 500 MB (${path.basename(f)} tem ${(t / MB).toFixed(1)} MB)`)
    if (DOC.test(f) && t > 100 * MB) erros.push(`documento: até 100 MB (${path.basename(f)})`)
  }
  for (const a of p.alts) if (a && a.length > 4086) erros.push('texto alternativo: até 4.086 caracteres')
  if (erros.length) throw new Error(erros.join('; '))
}

// "little text" do LinkedIn: caracteres reservados com barra; #tag vira hashtag de verdade
const RESERV = /[\\|{}@\[\]()<>*_~]/g
const commentary = t => t.split(/(#[\p{L}\p{N}_]+)/u).map(s => s.startsWith('#') && s.length > 1 ? `{hashtag|\\#|${s.slice(1)}}` : s.replace(RESERV, m => '\\' + m).replace(/#/g, '\\#')).join('')

// ---------------------------------------------------------------- envio dos arquivos
function cliente(tok) {
  const H = { Authorization: `Bearer ${tok.access_token}`, 'LinkedIn-Version': C.cfg.linkedin.version || '202610', 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' }
  const erro = async (onde, r) => new Error(`${onde} ${r.status} ${(await r.text()).slice(0, 300)}`)
  // imagem e documento: initializeUpload → PUT do arquivo
  async function subir(tipo, f) {
    const ini = await fetch(`https://api.linkedin.com/rest/${tipo}?action=initializeUpload`, { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: tok.author } }) })
    if (!ini.ok) throw await erro('initializeUpload', ini)
    const { value } = await ini.json()
    const up = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: H.Authorization }, body: fs.readFileSync(f) })
    if (!up.ok) throw await erro('upload', up)
    return value.image || value.document
  }
  // vídeo: partes de até 4 MB; cada PUT devolve um ETag, que vai no finalizeUpload
  async function subirVideo(f, aviso) {
    const buf = fs.readFileSync(f)
    const ini = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: tok.author, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } }) })
    if (!ini.ok) throw await erro('initializeUpload', ini)
    const { value } = await ini.json()
    const partes = []
    for (const p of value.uploadInstructions) {
      const up = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: buf.subarray(p.firstByte, p.lastByte + 1) })
      if (!up.ok) throw await erro('upload', up)
      partes.push(up.headers.get('etag'))
    }
    const fim = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', { method: 'POST', headers: H, body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds: partes } }) })
    if (!fim.ok) throw await erro('finalizeUpload', fim)
    // espera o LinkedIn processar (até ~3 min) antes de criar o post
    let estado = 'desconhecido'
    for (let i = 0; i < 36; i++) {
      const r = await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(value.video)}`, { headers: H })
      if (r.status === 401 || r.status === 403) { estado = `sem permissão para conferir (${r.status})`; break }
      const st = await r.json().catch(() => ({}))
      estado = st.status || estado
      if (st.status === 'AVAILABLE') break
      if (st.status === 'PROCESSING_FAILED') throw new Error('o LinkedIn não conseguiu processar o vídeo')
      aviso && aviso(`vídeo: ${estado}`)
      await new Promise(r => setTimeout(r, 5000))
    }
    return { urn: value.video, partes: partes.length, estado }
  }
  return { H, erro, subir, subirVideo }
}

// ---------------------------------------------------------------- publicar
// opções: conta (id da conta; padrão a ativa), confirmar (publica de verdade), soEnviar (só manda os arquivos, sem criar post)
async function publicar(p, { conta, confirmar = false, soEnviar = false, aviso } = {}) {
  validar(p)
  const tok = contas.token(conta)
  if (!tok || !tok.access_token) throw new Error('O LinkedIn não está conectado. Conecte no Farol (Ajustes).')
  if (Date.now() > tok.expires_at - 864e5) throw new Error(`O acesso de ${tok.nome} ao LinkedIn venceu (ou vence hoje). Reconecte no Farol (Ajustes).`)
  const resumo = { autor: tok.nome, formato: p.formato, arquivos: p.arquivos.map(f => path.basename(f)), caracteres: p.legenda.length, alt: p.alts.filter(Boolean).length, artigo: p.artigo || undefined, inicio: p.legenda.slice(0, 120) }
  if (!confirmar && !soEnviar) return { ensaio: true, ...resumo }

  const L = cliente(tok)
  const enviados = []
  let content
  if (p.formato === 'imagem' || p.formato === 'gif') { const id = await L.subir('images', p.arquivos[0]); enviados.push(id); content = { media: { id, ...(p.alts[0] ? { altText: p.alts[0] } : {}) } } }
  else if (p.formato === 'multi') { const imgs = []; for (const [i, f] of p.arquivos.entries()) { const id = await L.subir('images', f); enviados.push(id); imgs.push({ id, ...(p.alts[i] ? { altText: p.alts[i] } : {}) }) } content = { multiImage: { images: imgs } } }
  else if (p.formato === 'documento') { const id = await L.subir('documents', p.arquivos[0]); enviados.push(id); content = { media: { id, title: p.legenda.split('\n')[0].slice(0, 100) || path.basename(p.arquivos[0]) } } }
  else if (p.formato === 'video') { const v = await L.subirVideo(p.arquivos[0], aviso); enviados.push(v.urn); resumo.video = v; content = { media: { id: v.urn, title: p.legenda.split('\n')[0].slice(0, 100) || 'vídeo' } } }
  else if (p.formato === 'artigo') { const mini = p.arquivos[0] ? await L.subir('images', p.arquivos[0]) : null; if (mini) enviados.push(mini); content = { article: { source: p.artigo.url, title: p.artigo.titulo, ...(p.artigo.descricao ? { description: p.artigo.descricao } : {}), ...(mini ? { thumbnail: mini } : {}) } } }
  if (soEnviar) return { enviado: true, ...resumo, urns: enviados }

  const r = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST', headers: L.H,
    body: JSON.stringify({
      author: tok.author, commentary: commentary(p.legenda), visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
    }),
  })
  if (!r.ok) throw await L.erro('posts', r)
  const id = r.headers.get('x-restli-id'), link = `https://www.linkedin.com/feed/update/${id}/`
  registrar({ quando: new Date().toISOString(), imagem: p.registro, formato: p.formato, arquivos: resumo.arquivos, post: id, link, autor: tok.author, nome: tok.nome, texto: p.legenda.slice(0, 280), midias: enviados })
  return { ok: true, post: id, link, formato: p.formato }
}

// ---------------------------------------------------------------- histórico local (a API não deixa ler os próprios posts sem aprovação)
// workspace/publicados.json: uma linha por post. "imagem" é o nome do arquivo ou da pasta (o Farol usa para não publicar duas vezes).
function registrar(linha) {
  const lista = historico()
  lista.push(linha)
  fs.mkdirSync(path.dirname(C.PUBLICADOS), { recursive: true })
  const tmp = C.PUBLICADOS + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 2), 'utf8'); fs.renameSync(tmp, C.PUBLICADOS)
}
function historico() { try { return JSON.parse(fs.readFileSync(C.PUBLICADOS, 'utf8')) } catch { return [] } }

module.exports = { montar, validar, publicar, historico, commentary, LIMITE }
