'use strict'
// Caixa de permissões do Node para os scripts que executam código escrito pela IA
// (engine/dailyui/dias/*.js no Daily UI e engine/noticias/pautas/*.js nos carrosséis).
// Dentro da caixa o script só lê o motor, as imagens e a configuração, só escreve no workspace,
// e não abre outros processos nem a rede. Assim, mesmo um arquivo malicioso escrito pela IA
// (por exemplo, induzida por uma página da web) não consegue abrir o cofre, rodar programas nem publicar.
// Uso, antes de carregar o código da IA:  require('../caixa.js')(__filename)
// Precisa do Node 22.13+ (modelo de permissões estável); no Node 25+ a rede também fica bloqueada.
const path = require('path')
const { spawnSync } = require('child_process')

module.exports = function caixa(arquivo) {
  if (process.permission) return                       // já está dentro da caixa
  if (process.env.VYNCO_SEM_CAIXA === '1') return      // escape manual, só para depurar o motor
  const flags = process.allowedNodeEnvironmentFlags
  let sea = false; try { sea = require('node:sea').isSea() } catch {}
  if (sea || !flags.has('--permission')) { console.error('aviso: este Node não tem a caixa de permissões (precisa do Node 22.13 ou mais novo); rodando sem ela.'); return }
  const C = require('./config.js')
  require('fs').mkdirSync(C.WS, { recursive: true })   // dentro da caixa não dá para criar a pasta-mãe do workspace
  const ler =[...new Set([path.join(C.ROOT, 'engine'), path.join(C.ROOT, 'package.json'), C.ASSETS, C.FILE, C.WS])]
  const args = ['--permission', ...ler.map(p => `--allow-fs-read=${p}`), `--allow-fs-write=${C.WS}`, arquivo, ...process.argv.slice(2)]
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env })
  if (r.error) { console.error('caixa: não consegui iniciar o Node:', r.error.message); process.exit(1) }
  process.exit(r.status ?? 1)
}
