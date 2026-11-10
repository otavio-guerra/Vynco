'use strict'
// Limites de uso das IAs, para o medidor do Vynco (como a barra de sessão do Claude).
//  - Claude: GET https://api.anthropic.com/api/oauth/usage com o token do próprio Claude Code (~/.claude/.credentials.json).
//    O token só é lido e só vai para api.anthropic.com; nunca é gravado, mostrado ou renovado aqui.
//    É uma rota não documentada: se mudar, o medidor some e o resto do Vynco segue igual.
//  - ChatGPT (Codex): o próprio Codex grava os limites ("rate_limits") nos registros das sessões (~/.codex/sessions).
//  - Gemini e outras: não expõem o uso. O Vynco mostra a cota conhecida e quantas vezes ele mesmo usou a IA hoje.
const fs = require('fs'), os = require('os'), path = require('path'), https = require('https')

const CACHE = {}   // id → { quando, dados }
const TTL = 3 * 60000

function getJson(url, headers) {
  return new Promise((ok, falha) => {
    const req = https.get(url, { headers, timeout: 12000 }, res => {
      let b = ''; res.setEncoding('utf8'); res.on('data', c => { b += c })
      res.on('end', () => { if (res.statusCode !== 200) { const e = new Error('HTTP ' + res.statusCode); e.status = res.statusCode; return falha(e) } try { ok(JSON.parse(b)) } catch (e) { falha(e) } })
    })
    req.on('timeout', () => req.destroy(new Error('tempo esgotado'))); req.on('error', falha)
  })
}

async function claude() {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  let o; try { o = JSON.parse(fs.readFileSync(path.join(dir, '.credentials.json'), 'utf8')).claudeAiOauth } catch { }
  if (!o || !o.accessToken) return { medidor: false, nota: 'Entre no Claude Code para ver o uso.' }
  try {
    const d = await getJson('https://api.anthropic.com/api/oauth/usage', { Authorization: `Bearer ${o.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'vynco/1.0' })
    const pega = (k, grupo) => { const l = (d.limits || []).find(x => x.group === grupo), f = d[k] || {}, pct = l ? l.percent : f.utilization, at = l ? l.resets_at : f.resets_at; return pct == null ? null : { pct: Math.round(pct), renova: at || null } }
    return { medidor: true, janelas: [['Sessão (5 horas)', pega('five_hour', 'session')], ['Semana', pega('seven_day', 'weekly')]].filter(x => x[1]).map(([rotulo, v]) => ({ rotulo, ...v })) }
  } catch (e) {
    return { medidor: false, nota: e.status === 401 || (o.expiresAt && o.expiresAt < Date.now()) ? 'O login do Claude Code venceu: abra o Claude Code para renovar.' : 'Não consegui ler o uso agora.' }
  }
}

function codex() {
  const raiz = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')
  const arqs = []
  const andar = (d, n = 0) => { if (n > 4) return; let es; try { es = fs.readdirSync(d, { withFileTypes: true }) } catch { return } for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) andar(p, n + 1); else if (e.name.endsWith('.jsonl')) { try { arqs.push([p, fs.statSync(p).mtimeMs]) } catch { } } } }
  andar(raiz)
  arqs.sort((a, b) => b[1] - a[1])
  for (const [p] of arqs.slice(0, 5)) {
    let txt; try { txt = fs.readFileSync(p, 'utf8') } catch { continue }
    const i = txt.lastIndexOf('"rate_limits"'); if (i < 0) continue
    const linha = txt.slice(txt.lastIndexOf('\n', i) + 1, txt.indexOf('\n', i) < 0 ? undefined : txt.indexOf('\n', i))
    let j; try { j = JSON.parse(linha) } catch { continue }
    const rl = (j.payload || j).rate_limits || j.rate_limits; if (!rl) continue
    const quando = Date.parse(j.timestamp || '') || fs.statSync(p).mtimeMs
    const jan = (x, rotulo) => x && x.used_percent != null ? { rotulo, pct: Math.round(x.used_percent), renova: x.resets_at ? new Date(x.resets_at * (x.resets_at < 1e12 ? 1000 : 1)).toISOString() : x.resets_in_seconds != null ? new Date(quando + x.resets_in_seconds * 1000).toISOString() : null } : null
    const janelas = [jan(rl.primary, 'Sessão (5 horas)'), jan(rl.secondary, 'Semana')].filter(Boolean)
    if (janelas.length) return { medidor: true, janelas, nota: 'Do último uso do Codex neste computador.' }
  }
  return { medidor: false, nota: 'O Codex mostra o uso depois da primeira tarefa.' }
}

const SEM_MEDIDOR = {
  gemini: 'Conta Google gratuita: cerca de 1.000 pedidos por dia. O Gemini não informa o uso para outros apps.',
  copilot: 'O GitHub Copilot não informa o uso para outros apps.',
  qwen: 'O Qwen Code não informa o uso para outros apps.',
  opencode: 'O OpenCode depende do modelo escolhido nele.',
}

async function limites(id) {
  const c = CACHE[id]; if (c && Date.now() - c.quando < TTL) return c.dados
  const dados = id === 'claude' ? await claude() : id === 'codex' ? codex() : { medidor: false, nota: SEM_MEDIDOR[id] || 'Esta IA não informa o uso.' }
  CACHE[id] = { quando: Date.now(), dados: { ...dados, lido: new Date().toISOString() } }
  return CACHE[id].dados
}

module.exports = { limites }
