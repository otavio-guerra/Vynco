'use strict'
// Publica um post no seu perfil do LinkedIn pela API oficial. Sem --confirmo, só mostra o que seria publicado.
// Só use --confirmo depois que o post for aprovado no Farol. Formatos e regras: engine/linkedin/publicar.js
// Uso: node postar.js <arquivo | pasta | -> [legenda.txt] [--confirmo] [--so-enviar] [--conta <id>]
//   arquivo .png/.jpg/.gif/.pdf/.pptx/.docx/.mp4 · pasta com imagens (várias imagens) ou com link.json (artigo) · "-" só texto
//   --so-enviar  manda os arquivos para o LinkedIn e para aí (nada é publicado; serve para testar vídeo e imagens)
const { montar, publicar } = require('./publicar.js')

const args = process.argv.slice(2)
const flag = n => args.includes(n)
const valor = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--conta')
const [alvo, legenda] = pos

;(async () => {
  const p = montar(alvo, legenda)
  const r = await publicar(p, { conta: valor('--conta'), confirmar: flag('--confirmo'), soEnviar: flag('--so-enviar'), aviso: m => console.error(m) })
  console.log(JSON.stringify(r, null, 2))
  if (r.ensaio) console.log('Nada foi publicado. Para publicar: acrescente --confirmo')
  if (r.enviado) console.log('Arquivos enviados, nenhum post criado.')
})().catch(e => { console.error('Falhou, nada foi publicado:', e.message); process.exit(1) })
