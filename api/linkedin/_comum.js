'use strict'
// Ponte de login do LinkedIn do Vynco (Vercel). Guarda o Client Secret do app do Vynco no servidor,
// para que quem baixa o Vynco entre com um botão, sem criar app nem copiar chaves.
// O token vai direto para o Vynco do usuário (http://127.0.0.1:<porta>), num fragmento (#) que não passa por servidor nenhum.
const ID = process.env.LINKEDIN_CLIENT_ID, SECRET = process.env.LINKEDIN_CLIENT_SECRET
const base = req => process.env.VYNCO_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
const redirect = req => `${base(req)}/api/linkedin/callback`
// cabeçalhos de segurança em toda resposta da ponte: nada de moldura, de referer (o endereço de volta leva o código do login) nem de script
const seguro = res => {
  res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
}
const pagina = (res, code, titulo, texto) => {
  seguro(res); res.statusCode = code
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vynco</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0C1220;color:#F4F5FA;font:16px/1.5 'Segoe UI',system-ui,sans-serif;text-align:center;padding:24px">
<main><h1 style="font-weight:600;margin:0 0 8px">${titulo}</h1><p style="color:#aab0c8;margin:0">${texto}</p></main></body>`)
}
const porta = p => { p = Number(p); return Number.isInteger(p) && p >= 1024 && p <= 65535 ? p : null }
module.exports = { ID, SECRET, redirect, pagina, porta, seguro }
