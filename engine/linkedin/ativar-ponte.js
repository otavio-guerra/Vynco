'use strict'
// Liga a ponte do login de um clique (api/linkedin na Vercel) com as chaves do seu app do LinkedIn que já estão no cofre.
// As chaves vão do cofre direto para a Vercel pela entrada padrão: não aparecem na tela nem na linha de comando.
// Precisa da Vercel CLI logada no projeto (vercel whoami). Uso: npm run ponte:ativar
// Depois, no app do LinkedIn (linkedin.com/developers/apps → seu app → Auth), adicione o redirect que o script mostra.
const { execFileSync } = require('child_process')
const C = require('../config.js')
const S = require('../segredos.js')

const PONTE = (C.cfg.linkedin && C.cfg.linkedin.ponte) || 'https://farol-otavio-guerra.vercel.app'
const IS_WIN = process.platform === 'win32'
const vercel = (args, input) => execFileSync(IS_WIN ? 'vercel.cmd' : 'vercel', args, { cwd: C.ROOT, input, encoding: 'utf8', stdio: [input == null ? 'inherit' : 'pipe', 'pipe', 'pipe'], shell: IS_WIN, timeout: 300000 })

;(async () => {
  const app = S.get('linkedin.app')
  if (!app || !app.client_id || !app.client_secret) throw new Error('Não há chaves do seu app do LinkedIn no cofre. Salve-as no Farol (Usar meu próprio app do LinkedIn).')
  try { console.log('Vercel: logado como', vercel(['whoami']).trim()) } catch { throw new Error('A Vercel CLI não está logada. Rode "vercel login" e depois este script de novo.') }

  const vars = { LINKEDIN_CLIENT_ID: app.client_id, LINKEDIN_CLIENT_SECRET: app.client_secret, FAROL_URL: PONTE }
  for (const [nome, valor] of Object.entries(vars)) {
    try { vercel(['env', 'rm', nome, 'production', '--yes'], '') } catch { /* ainda não existia */ }
    vercel(['env', 'add', nome, 'production'], valor)
    console.log(`ok: ${nome}`)
  }
  console.log('Publicando a ponte (vercel deploy --prod)...')
  vercel(['deploy', '--prod', '--yes'], '')
  const r = await fetch(PONTE + '/api/linkedin/ping').then(r => r.json()).catch(() => ({}))
  console.log(r.pronto ? 'Ponte ligada.' : 'A ponte ainda não respondeu "pronto". Confira o deploy na Vercel.')
  console.log(`\nÚltimo passo, no app do LinkedIn (linkedin.com/developers/apps → seu app → Auth → Authorized redirect URLs):\n  ${PONTE}/api/linkedin/callback\n`)
})().catch(e => { console.error('Falhou:', e.message); process.exit(1) })
