'use strict'
// O LinkedIn volta aqui com ?code. Trocamos pelo token e devolvemos ao Farol do usuário, em 127.0.0.1.
const { ID, SECRET, redirect, pagina, porta } = require('./_comum.js')
module.exports = async (req, res) => {
  const u = new URL(req.url, 'https://farol')
  const [state, pp] = String(u.searchParams.get('state') || '').split('.')
  const p = porta(pp)
  if (!/^[a-f0-9]{24,64}$/.test(state || '') || !p) return pagina(res, 400, 'Link inválido', 'Volte ao Farol e tente de novo.')
  const volta = frag => { res.statusCode = 302; res.setHeader('Location', `http://127.0.0.1:${p}/linkedin/done#` + new URLSearchParams({ state, ...frag })); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.end() }
  if (u.searchParams.get('error')) return volta({ error: u.searchParams.get('error_description') || u.searchParams.get('error') })
  try {
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: u.searchParams.get('code') || '', redirect_uri: redirect(req), client_id: ID, client_secret: SECRET }),
    })
    const t = await r.json()
    if (!t.access_token) return volta({ error: t.error_description || 'O LinkedIn recusou a autorização.' })
    return volta({ access_token: t.access_token, expires_in: String(t.expires_in || 5184000) })
  } catch (e) { return volta({ error: 'Não consegui falar com o LinkedIn agora.' }) }
}
