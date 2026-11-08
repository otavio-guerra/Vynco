'use strict'
// Aprovação assinada: só conta como aprovado (e só vai ao ar) o post cujo texto e arquivos são exatamente os que você aprovou.
// Ao aprovar, o Vynco grava em aprovados/<id>.ok a "impressão" do post (SHA-256 da legenda e de cada arquivo) e uma
// assinatura HMAC dessa impressão com uma chave que fica só no cofre (engine/segredos.js, cifrado com a DPAPI).
// A IA consegue escrever na pasta dos posts, mas não lê o cofre: um .ok criado por ela, ou um post mexido depois
// da aprovação, não passa na conferência.
const fs = require('fs')
const crypto = require('crypto')
const S = require('./segredos.js')

let cacheChave = null
function chave() {
  if (cacheChave) return cacheChave
  let k = S.get('aprovacao.chave')
  if (!k) { k = crypto.randomBytes(32).toString('base64'); S.set('aprovacao.chave', k) }
  return (cacheChave = Buffer.from(k, 'base64'))
}
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')
function shaArquivo(p) {   // em pedaços: vídeos de até 500 MB sem carregar tudo na memória
  const h = crypto.createHash('sha256'), fd = fs.openSync(p, 'r'), buf = Buffer.alloc(1 << 20)
  try { let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n)) } finally { fs.closeSync(fd) }
  return h.digest('hex')
}
const lerLegenda = p => { try { return fs.readFileSync(p) } catch { return Buffer.alloc(0) } }
const arquivosValidos = lista => (lista || []).filter(p => { try { return fs.statSync(p).isFile() } catch { return false } })

// impressão completa (na hora de aprovar e de publicar)
function impressao(legenda, arquivos) {
  return { legenda: sha(lerLegenda(legenda)), arquivos: arquivosValidos(arquivos).map(p => ({ nome: p.split(/[\\/]/).pop(), tam: fs.statSync(p).size, sha: shaArquivo(p) })) }
}
const assinatura = (kind, id, imp) => crypto.createHmac('sha256', chave()).update(JSON.stringify([kind, id, imp])).digest('hex')

function aprovar(ok, kind, id, legenda, arquivos) {
  const imp = impressao(legenda, arquivos)
  fs.mkdirSync(require('path').dirname(ok), { recursive: true })
  fs.writeFileSync(ok, JSON.stringify({ v: 1, quando: new Date().toISOString(), impressao: imp, hmac: assinatura(kind, id, imp) }, null, 2))
}

// confere a aprovação: a assinatura tem que bater e o post não pode ter mudado.
// rápida (lista da fila): legenda inteira e o tamanho de cada arquivo. completa (antes de publicar): o SHA-256 de tudo.
function valida(ok, kind, id, legenda, arquivos, { completa = false } = {}) {
  let r; try { r = JSON.parse(fs.readFileSync(ok, 'utf8')) } catch { return false }
  if (!r || r.v !== 1 || typeof r.hmac !== 'string' || !r.impressao) return false
  let esperado; try { esperado = assinatura(kind, id, r.impressao) } catch { return false }
  if (r.hmac.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(r.hmac), Buffer.from(esperado))) return false
  if (sha(lerLegenda(legenda)) !== r.impressao.legenda) return false
  const atuais = arquivosValidos(arquivos), salvos = r.impressao.arquivos || []
  if (atuais.length !== salvos.length) return false
  return atuais.every((p, k) => {
    const s = salvos[k]; if (!s || s.nome !== p.split(/[\\/]/).pop() || s.tam !== fs.statSync(p).size) return false
    return !completa || shaArquivo(p) === s.sha
  })
}

module.exports = { aprovar, valida }
