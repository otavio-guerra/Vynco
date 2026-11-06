'use strict'
// Contas do LinkedIn conectadas ao Farol (várias pessoas ou perfis na mesma máquina). Tudo fica no cofre cifrado.
//   linkedin.contas = { <sub>: { access_token, expires_at, author, nome, foto, via } }    linkedin.ativa = <sub>
// O token da versão anterior (linkedin.token, uma conta só) vira a primeira conta na primeira leitura.
const S = require('../segredos.js')

const DIA = 864e5
const sub = t => String(t.author || '').replace('urn:li:person:', '')

function todas() {
  let contas = S.get('linkedin.contas'), antigo = S.get('linkedin.token')
  if (!contas && antigo && antigo.access_token) {
    contas = { [sub(antigo)]: antigo }
    S.set('linkedin.contas', contas); S.set('linkedin.ativa', sub(antigo)); S.del('linkedin.token')
  }
  return contas || {}
}
function ativaId() { const c = todas(), a = S.get('linkedin.ativa'); return c[a] ? a : Object.keys(c)[0] || null }
// a conta pedida (ou a ativa), com o token, para publicar
function token(id) { const c = todas(); return c[id || ativaId()] || null }
const valida = t => !!(t && t.access_token && t.expires_at > Date.now())
const diasRestantes = t => t && t.expires_at ? Math.floor((t.expires_at - Date.now()) / DIA) : null

// o que pode ir para a tela (sem token)
function lista() {
  const a = ativaId()
  return Object.entries(todas()).map(([id, t]) => ({ id, nome: t.nome, foto: t.foto || null, expiresAt: t.expires_at, dias: diasRestantes(t), valida: valida(t), via: t.via, ativa: id === a }))
}
function salvar(t) { const id = sub(t); if (!id) throw new Error('conta sem identificador'); S.set('linkedin.contas', { ...todas(), [id]: t }); S.set('linkedin.ativa', id); return id }
function usar(id) { if (!todas()[id]) throw new Error('conta não encontrada'); S.set('linkedin.ativa', id) }
function remover(id) {
  const c = { ...todas() }; id = id || ativaId(); delete c[id]; S.set('linkedin.contas', c)
  if (S.get('linkedin.ativa') === id) { const prox = Object.keys(c)[0]; prox ? S.set('linkedin.ativa', prox) : S.del('linkedin.ativa') }
}

module.exports = { todas, ativaId, token, valida, diasRestantes, lista, salvar, usar, remover }
