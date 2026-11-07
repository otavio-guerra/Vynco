'use strict'
// Autoriza este script a publicar no seu perfil do LinkedIn (OAuth da API oficial). Rode uma vez, e de novo a cada ~60 dias.
// Usa o seu próprio app do LinkedIn (client_id e client_secret salvos pelo Vynco em Ajustes, guardados no cofre cifrado).
// Uso: node auth.js   → abre o navegador; você entra na sua conta e autoriza; o token vai para o cofre (só nesta máquina).
const http = require('http')
const crypto = require('crypto')
const { exec } = require('child_process')

const C = require('../config.js')
const S = require('../segredos.js')
const app = S.get('linkedin.app')
if (!app || !app.client_id || !app.client_secret) { console.error('Faltam o Client ID e o Client Secret: salve-os no Vynco (Usar meu próprio app do LinkedIn).'); process.exit(2) }
const cfg = { ...app, redirect_uri: C.cfg.linkedin.redirectUri }
const redirect = cfg.redirect_uri || 'http://localhost:8765/callback'
const port = +new URL(redirect).port
const state = crypto.randomBytes(16).toString('hex')
const url = 'https://www.linkedin.com/oauth/v2/authorization?' + new URLSearchParams({
  response_type: 'code', client_id: cfg.client_id, redirect_uri: redirect, state, scope: 'openid profile w_member_social',
})

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect)
  if (u.pathname !== new URL(redirect).pathname) { res.end(); return }
  if (u.searchParams.get('state') !== state || !u.searchParams.get('code')) { res.end('Autorização recusada ou inválida. Pode fechar esta aba.'); server.close(); return }
  try {
    const tok = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: redirect, client_id: cfg.client_id, client_secret: cfg.client_secret }),
    }).then(r => r.json())
    if (!tok.access_token) throw new Error(JSON.stringify(tok))
    const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then(r => r.json())
    if (!me || !me.sub) throw new Error('o LinkedIn não devolveu o perfil')
    const out = { access_token: tok.access_token, expires_at: Date.now() + tok.expires_in * 1000, author: `urn:li:person:${me.sub}`, nome: me.name, foto: me.picture || null, via: 'proprio' }
    S.set('linkedin.token', out)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<p>Pronto, ${me.name}. Pode fechar esta aba.</p>`)
    console.log(`ok: autorizado como ${me.name}; vale até ${new Date(out.expires_at).toLocaleDateString('pt-BR')}`)
  } catch (e) {
    res.end('Deu erro ao trocar o código pelo token. Veja o terminal.'); console.error(e.message)
  }
  server.close()
})
server.listen(port, () => {
  console.log('Abrindo o navegador para você autorizar...\n' + url)
  exec(`start "" "${url}"`)
})
