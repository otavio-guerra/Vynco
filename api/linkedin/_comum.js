'use strict'
// Ponte de login do LinkedIn do Farol (Vercel). Guarda o Client Secret do app do Farol no servidor,
// para que quem baixa o Farol entre com um botão, sem criar app nem copiar chaves.
// O token vai direto para o Farol do usuário (http://127.0.0.1:<porta>), num fragmento (#) que não passa por servidor nenhum.
const ID = process.env.LINKEDIN_CLIENT_ID, SECRET = process.env.LINKEDIN_CLIENT_SECRET
const base = req => process.env.FAROL_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
const redirect = req => `${base(req)}/api/linkedin/callback`
const pagina = (res, code, titulo, texto) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Farol</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1626;color:#e9edf6;font:16px/1.5 'Segoe UI',system-ui,sans-serif;text-align:center;padding:24px">
<main><h1 style="font-weight:600;margin:0 0 8px">${titulo}</h1><p style="color:#9ba7bf;margin:0">${texto}</p></main></body>`)
}
const porta = p => { p = Number(p); return Number.isInteger(p) && p >= 1024 && p <= 65535 ? p : null }
module.exports = { ID, SECRET, redirect, pagina, porta }
