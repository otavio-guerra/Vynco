'use strict'
// Posts montados no editor do Farol. Cada post é uma pasta em workspace/avulsos/<id>/, no formato que o publicar.js entende,
// então a fila, a aprovação e a publicação continuam as mesmas:
//   legenda.txt · 01-foto.png, 02-... (a ordem das mídias) · <mídia>.alt.txt · link.json (artigo) · post.json (título, rascunho, datas)
// As mídias são copiadas da biblioteca para a pasta: apagar algo da biblioteca nunca quebra um post já montado.
const fs = require('fs')
const path = require('path')
const C = require('./config.js')
const M = require('./midia.js')
const { montar, LIMITE } = require('./linkedin/publicar.js')

const AV = C.ws('avulsos'), LIXEIRA = C.ws('lixeira', 'avulsos')
const ID = /^[a-z0-9][a-z0-9-]{0,60}$/
const okDe = id => path.join(AV, 'aprovados', id + '.ok')
const lerJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const semOrdem = n => n.replace(/^\d{2}-/, '')
const ehMidia = n => !!M.tipoDe(n)

function slug(t) {
  const cheio = String(t || 'post').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // até 40 letras, sem cortar a última palavra no meio
  const s = (cheio.length > 40 ? cheio.slice(0, 41).replace(/-[^-]*$/, '') : cheio) || 'post'
  let id = s, k = 2
  while (fs.existsSync(path.join(AV, id))) id = `${s}-${k++}`
  return id
}
function publicado(id) { try { return JSON.parse(fs.readFileSync(C.PUBLICADOS, 'utf8')).some(p => p.imagem === id) } catch { return false } }

function carregar(id) {
  if (!ID.test(id || '')) throw new Error('post inválido')
  const dir = path.join(AV, id); if (!fs.existsSync(dir)) throw new Error('post não encontrado')
  const meta = lerJSON(path.join(dir, 'post.json'), {})
  const nomes = fs.readdirSync(dir).filter(ehMidia).sort()
  const midias = nomes.map(n => ({ arquivo: `avulsos/${id}/${n}`, nome: semOrdem(n), tipo: M.tipoDe(n), alt: (() => { try { return fs.readFileSync(path.join(dir, n.replace(/\.[^.]+$/, '.alt.txt')), 'utf8').trim() } catch { return '' } })() }))
  let formato = 'texto'; try { formato = montar(dir).formato } catch { }
  const link = lerJSON(path.join(dir, 'link.json'))
  return { id, titulo: meta.titulo || id, legenda: (() => { try { return fs.readFileSync(path.join(dir, 'legenda.txt'), 'utf8') } catch { return '' } })(), midias, artigo: link ? { url: link.url, titulo: link.titulo, descricao: link.descricao || '' } : null, formato, rascunho: !!meta.rascunho, aprovado: fs.existsSync(okDe(id)), publicado: publicado(id), criado: meta.criado, atualizado: meta.atualizado }
}

// confere a combinação de mídias antes de gravar (as regras do LinkedIn para um post)
function validar({ legenda, midias, artigo }) {
  const tipos = midias.map(m => M.tipoDe(m.arquivo))
  const imgs = tipos.filter(t => t === 'imagem' || t === 'gif').length, videos = tipos.filter(t => t === 'video').length, docs = tipos.filter(t => t === 'documento').length
  const erros = []
  if (legenda.length > LIMITE) erros.push(`o texto tem ${legenda.length} caracteres (o máximo é ${LIMITE})`)
  if (videos + docs > 1 || ((videos || docs) && imgs)) erros.push('vídeo e documento vão sozinhos no post (sem outras mídias)')
  if (imgs > 20) erros.push('até 20 imagens por post')
  if (artigo && (videos || docs || imgs > 1)) erros.push('um artigo leva só uma imagem (a miniatura)')
  if (artigo && !/^https?:\/\/\S+$/i.test(artigo.url || '')) erros.push('o link do artigo precisa começar com http')
  if (artigo && !String(artigo.titulo || '').trim()) erros.push('o artigo precisa de um título')
  if (!midias.length && !artigo && !legenda.trim()) erros.push('escreva um texto ou adicione uma mídia')
  for (const m of midias) if (m.alt && m.alt.length > M.LIMITES.alt) erros.push(`texto alternativo com mais de ${M.LIMITES.alt} caracteres`)
  if (erros.length) throw new Error(erros.join('; '))
}

// grava (cria ou atualiza) um post. enviar=true tira do rascunho e manda para a fila de aprovação.
function salvar({ id, titulo, legenda = '', midias = [], artigo = null, enviar = false }) {
  legenda = String(legenda).replace(/\r\n/g, '\n')
  midias = midias.map(m => ({ arquivo: String(m.arquivo), alt: String(m.alt || '').trim() }))
  if (artigo && !artigo.url && !artigo.titulo) artigo = null
  validar({ legenda, midias, artigo })
  if (id && !ID.test(id)) throw new Error('post inválido')
  if (id && publicado(id)) throw new Error('este post já foi publicado: duplique o texto num post novo')
  const novo = !id || !fs.existsSync(path.join(AV, id))
  id = novo ? slug(titulo || legenda.split('\n')[0]) : id
  const dir = path.join(AV, id); fs.mkdirSync(dir, { recursive: true })

  // mídias na ordem pedida: primeiro tudo o que já está na pasta vai para nomes temporários, depois para o nome final
  const finais = midias.map((m, k) => ({ ...m, origem: M.caminho(m.arquivo), nome: `${String(k + 1).padStart(2, '0')}-${semOrdem(path.basename(m.arquivo))}` }))
  for (const f of finais) if (path.dirname(f.origem) === dir) { const tmp = path.join(dir, `.mover-${f.nome}`); fs.renameSync(f.origem, tmp); f.origem = tmp }
  for (const f of finais) { const dest = path.join(dir, f.nome); f.origem.startsWith(path.join(dir, '.mover-')) ? fs.renameSync(f.origem, dest) : fs.copyFileSync(f.origem, dest) }
  const quero = new Set(finais.map(f => f.nome))
  for (const n of fs.readdirSync(dir)) if ((ehMidia(n) && !quero.has(n)) || n.endsWith('.alt.txt')) fs.rmSync(path.join(dir, n), { force: true })
  for (const f of finais) if (f.alt) fs.writeFileSync(path.join(dir, f.nome.replace(/\.[^.]+$/, '.alt.txt')), f.alt, 'utf8')

  fs.writeFileSync(path.join(dir, 'legenda.txt'), legenda, 'utf8')
  const link = path.join(dir, 'link.json')
  if (artigo) fs.writeFileSync(link, JSON.stringify({ url: artigo.url.trim(), titulo: String(artigo.titulo).trim(), descricao: String(artigo.descricao || '').trim() }, null, 2), 'utf8')
  else fs.rmSync(link, { force: true })
  const antes = lerJSON(path.join(dir, 'post.json'), {})
  // post novo nasce rascunho; um post que já estava na fila continua lá (só precisa ser aprovado de novo)
  const rascunho = enviar ? false : novo ? true : !!antes.rascunho
  fs.writeFileSync(path.join(dir, 'post.json'), JSON.stringify({ titulo: String(titulo || antes.titulo || legenda.split('\n')[0] || id).slice(0, 80), rascunho, criado: antes.criado || new Date().toISOString(), atualizado: new Date().toISOString() }, null, 2), 'utf8')
  fs.rmSync(okDe(id), { force: true })   // mudou o conteúdo: precisa aprovar de novo
  return carregar(id)
}

// manda um rascunho para a fila (sem mexer no conteúdo)
function enviar(id) {
  const p = path.join(AV, id, 'post.json'); if (!ID.test(id || '') || !fs.existsSync(path.join(AV, id))) throw new Error('post não encontrado')
  const meta = lerJSON(p, {}); fs.writeFileSync(p, JSON.stringify({ ...meta, rascunho: false, atualizado: new Date().toISOString() }, null, 2), 'utf8')
}
// excluir leva a pasta para a lixeira do workspace (dá para recuperar)
function excluir(id) {
  if (!ID.test(id || '')) throw new Error('post inválido')
  if (publicado(id)) throw new Error('posts publicados ficam no histórico')
  const dir = path.join(AV, id); if (!fs.existsSync(dir)) return
  fs.mkdirSync(LIXEIRA, { recursive: true }); fs.renameSync(dir, path.join(LIXEIRA, `${id}-${Date.now()}`)); fs.rmSync(okDe(id), { force: true })
}

module.exports = { carregar, salvar, enviar, excluir, validar }
