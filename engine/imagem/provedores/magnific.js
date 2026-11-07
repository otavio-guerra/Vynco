'use strict'
// Provedor de imagens: Magnific (API REST oficial, antiga Freepik API). Documentação: https://docs.magnific.com
// - Autenticação pelo cabeçalho x-magnific-api-key; a chave fica no cofre do Vynco e nunca vai para a tela nem para a IA.
// - Tudo é assíncrono: o POST devolve um task_id e o Vynco consulta GET <mesmo caminho>/<task_id> até COMPLETED ou FAILED.
//   (O aviso por webhook exige um endereço público; o app desktop não tem, então consulta em intervalos.)
// - Os links das imagens prontas vencem em 30 minutos: quem chama baixa na hora para a biblioteca.
// - A API cobra créditos em toda chamada, à parte da assinatura do site (os planos "ilimitados" valem só no app web).
//
// Interface de um provedor (para somar outros depois sem mudar o resto do Vynco):
//   { id, nome, chaveUrl, nota, recursos, validar(chave), estimar(op, params, origem), iniciar(op, params, chave, imagemBase64), consultar(tarefa, chave) }
const BASE = 'https://api.magnific.com'

const RECURSOS = {
  gerar: {
    titulo: 'Gerar a partir de um texto', modelo: 'Mystic',
    proporcoes: [['social_post_4_5', '4:5 · feed'], ['square_1_1', '1:1'], ['widescreen_16_9', '16:9'], ['social_story_9_16', '9:16 · story'], ['classic_4_3', '4:3'], ['traditional_3_4', '3:4']],
    resolucoes: [['1k', '1K'], ['2k', '2K'], ['4k', '4K']],
    modelos: [['realism', 'Realismo'], ['fluid', 'Fluido'], ['zen', 'Zen'], ['flexible', 'Flexível'], ['super_real', 'Super real'], ['editorial_portraits', 'Retratos editoriais']],
    maxVersoes: 4,
  },
  melhorar: {
    titulo: 'Aumentar e melhorar (Upscaler Creative)',
    fatores: ['2x', '4x', '8x', '16x'], maxPixels: 25.3e6,
    otimizado: [['standard', 'Padrão'], ['soft_portraits', 'Retratos suaves'], ['hard_portraits', 'Retratos marcados'], ['art_n_illustration', 'Arte e ilustração'], ['videogame_assets', 'Assets de jogos'], ['nature_n_landscapes', 'Natureza e paisagens'], ['films_n_photography', 'Cinema e fotografia'], ['3d_renders', 'Renders 3D'], ['science_fiction_n_horror', 'Ficção científica e terror']],
  },
  refinar: { titulo: 'Refinar detalhes (Upscaler Precision)' },
}
const CAMINHO = { gerar: '/v1/ai/mystic', melhorar: '/v1/ai/image-upscaler', refinar: '/v1/ai/image-upscaler-precision' }

// preço do upscale pelo tamanho final, a partir dos exemplos oficiais (docs.magnific.com/pricing): só uma estimativa
const FAIXAS = [[4.0e6, 0.10], [8.3e6, 0.20], [14.8e6, 0.40], [19.7e6, 0.50]]
function estimar(op, p = {}, origem = {}) {
  if (op === 'melhorar' && origem.largura && origem.altura) {
    const f = parseInt(p.scale_factor || '2x'), px = origem.largura * f * origem.altura * f
    const faixa = FAIXAS.find(([max]) => px <= max)
    return faixa ? { valor: faixa[1], moeda: 'EUR', nota: 'estimativa pelos exemplos de preço da documentação' } : { valor: 0.5, moeda: 'EUR', aPartir: true, nota: 'acima dos exemplos da documentação: a partir de €0,50' }
  }
  if (op === 'gerar') return { valor: null, moeda: 'EUR', nota: 'a documentação não publica o preço do Mystic: confira no painel do Magnific' }
  return { valor: null, moeda: 'EUR', nota: 'a documentação não informa o tamanho final nem o preço desta operação' }
}

async function chamar(metodo, caminho, chave, corpo) {
  const r = await fetch(BASE + caminho, { method: metodo, headers: { 'x-magnific-api-key': chave, 'Content-Type': 'application/json', Accept: 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(60000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j.message || (j.invalid_params || []).map(x => `${x.field || x.name}: ${x.reason}`).join('; ')
    const erro = r.status === 401 ? 'A chave do Magnific foi recusada (inválida ou faltando).'
      : r.status === 402 || r.status === 403 ? 'O Magnific recusou: confira os créditos da API e as permissões da chave.'
      : r.status === 429 ? 'Muitas chamadas ao Magnific em pouco tempo. Espere um pouco e tente de novo.'
      : r.status >= 500 ? 'O Magnific está fora do ar agora. Tente de novo em alguns minutos.'
      : `O Magnific não aceitou o pedido: ${msg || 'erro ' + r.status}`
    throw Object.assign(new Error(erro), { status: r.status })
  }
  return j
}

// confere a chave com uma leitura que não gasta créditos (lista de criações recentes)
async function validar(chave) { await chamar('GET', '/v1/creations/recent?per_page=1', chave); return true }

function corpo(op, p, imagem) {
  if (op === 'gerar') return {
    prompt: String(p.prompt || '').slice(0, 4000), resolution: p.resolution || '2k', aspect_ratio: p.aspect_ratio || 'social_post_4_5',
    model: p.model || 'realism', engine: p.engine || 'automatic', creative_detailing: p.creative_detailing ?? 33,
    ...(p.estilo ? { style_reference: p.estilo, adherence: p.adherence ?? 50 } : {}),
  }
  if (op === 'melhorar') return {
    image: imagem, scale_factor: p.scale_factor || '2x', optimized_for: p.optimized_for || 'standard',
    creativity: p.creativity ?? 0, hdr: p.hdr ?? 0, resemblance: p.resemblance ?? 0, fractality: p.fractality ?? 0, engine: p.engine || 'automatic',
    ...(p.prompt ? { prompt: String(p.prompt).slice(0, 1000) } : {}),
  }
  if (op === 'refinar') return { image: imagem, sharpen: p.sharpen ?? 50, smart_grain: p.smart_grain ?? 7, ultra_detail: p.ultra_detail ?? 30 }
  throw new Error('operação desconhecida')
}
async function iniciar(op, p, chave, imagem) {
  const j = await chamar('POST', CAMINHO[op], chave, corpo(op, p, imagem))
  const id = j.data && j.data.task_id
  if (!id) throw new Error('O Magnific não devolveu o número da tarefa.')
  return { tarefa: id, caminho: CAMINHO[op] }
}
async function consultar(t, chave) {
  const j = await chamar('GET', `${t.caminho}/${encodeURIComponent(t.tarefa)}`, chave)
  const d = j.data || {}
  if (d.status === 'COMPLETED') return { estado: 'pronto', urls: d.generated || [] }
  if (d.status === 'FAILED') return { estado: 'falhou', erro: 'O Magnific não conseguiu concluir esta imagem.' }
  return { estado: 'rodando' }
}

module.exports = {
  id: 'magnific', nome: 'Magnific', site: 'https://www.magnific.com', docs: 'https://docs.magnific.com',
  chaveUrl: 'https://www.magnific.com/user/organization/api-keys',
  nota: 'A API cobra créditos à parte da assinatura do site: os planos "ilimitados" valem só no app web do Magnific.',
  recursos: RECURSOS, validar, estimar, iniciar, consultar,
}
