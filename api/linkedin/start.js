'use strict'
// /api/linkedin/start?state=<hex>&port=<porta do Farol>  →  tela de login do LinkedIn
const { ID, SECRET, redirect, pagina, porta } = require('./_comum.js')
module.exports = (req, res) => {
  const u = new URL(req.url, 'https://farol')
  const state = u.searchParams.get('state') || '', p = porta(u.searchParams.get('port'))
  if (!/^[a-f0-9]{24,64}$/.test(state) || !p) return pagina(res, 400, 'Link inválido', 'Volte ao Farol e clique em Continuar com LinkedIn de novo.')
  if (!ID || !SECRET) return pagina(res, 503, 'Login do LinkedIn indisponível', 'A ponte do Farol ainda não foi configurada. No Farol, use "meu próprio app do LinkedIn".')
  const q = new URLSearchParams({ response_type: 'code', client_id: ID, redirect_uri: redirect(req), state: `${state}.${p}`, scope: 'openid profile w_member_social' })
  res.statusCode = 302; res.setHeader('Location', 'https://www.linkedin.com/oauth/v2/authorization?' + q); res.setHeader('Cache-Control', 'no-store'); res.end()
}
