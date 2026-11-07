'use strict'
// Configuração única do motor. Valores padrão + config/engine.config.json (local, fora do Git).
// Segredos (chaves e token do LinkedIn) ficam no cofre cifrado (engine/segredos.js), nunca em texto puro nem no repositório.
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
// Pasta de dados (configuração, cofre e workspace). No desenvolvimento é a própria pasta do projeto, como sempre foi.
// Na versão instalada, o app aponta FAROL_DATA para a pasta do usuário: atualizar o Vynco nunca apaga o conteúdo de ninguém.
const DATA = path.resolve(process.env.FAROL_DATA || ROOT)
const CONFIG_DIR = path.join(DATA, 'config')
const FILE = path.join(CONFIG_DIR, 'engine.config.json')

const DEFAULTS = {
  // pasta com as imagens usadas nas peças (pixel art, fotos de projeto); o padrão são os exemplos do repositório
  assetsDir: path.join(ROOT, 'examples', 'assets'),
  // onde as peças geradas são salvas (svg, png, pdf, legendas, aprovações, registro de publicações)
  workspaceDir: path.join(DATA, 'workspace'),
  // dia 1 do Daily UI (os desafios contam só dias úteis)
  dailyUiStart: new Date().toISOString().slice(0, 10),
  desigma: {
    exe: '',            // caminho do desigma.exe (editor)
    mcpExe: '',         // caminho do desigma-mcp.exe
    workspace: '',      // pasta que o MCP do desigma enxerga
    project: '',        // o .desigma do projeto (dentro da pasta acima)
  },
  linkedin: { version: '202610', redirectUri: 'http://localhost:8765/callback' },
  app: { port: 4800 },
}

function deep(a, b) { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? deep(a[k] || {}, v) : v; return o }
// caminhos relativos no arquivo de configuração: imagens contam a partir do projeto, o workspace a partir da pasta de dados
const resolver = c => ({ ...c, assetsDir: path.resolve(ROOT, c.assetsDir), workspaceDir: path.resolve(DATA, c.workspaceDir) })
function load() { try { return resolver(deep(DEFAULTS, JSON.parse(fs.readFileSync(FILE, 'utf8')))) } catch { return resolver(deep(DEFAULTS, {})) } }
function save(patch) { const cur = (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { return {} } })(); fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(deep(cur, patch), null, 2), 'utf8'); return load() }

const cfg = load()
const WS = cfg.workspaceDir
const ws = (...p) => { const d = path.join(WS, ...p); return d }
module.exports = {
  ROOT, DATA, CONFIG_DIR, FILE, load, save, cfg,
  ASSETS: cfg.assetsDir, WS, ws,
  // arquivos antigos em texto puro: só são lidos uma vez, para migrar para o cofre (engine/segredos.js)
  LINKEDIN: { config: path.join(CONFIG_DIR, 'linkedin.json'), token: path.join(CONFIG_DIR, 'linkedin-token.json') },
  SEGREDOS: path.join(CONFIG_DIR, 'segredos.dat'),
  PUBLICADOS: path.join(WS, 'publicados.json'),
}
