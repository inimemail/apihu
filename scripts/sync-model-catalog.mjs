import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModelCatalog, fetchCatalogJSON, PRICE_SOURCE_URL, METADATA_SOURCE_URL } from '../server/model-catalog.mjs'
import { fetchOfficialOverrides, OFFICIAL_SOURCES } from '../server/official-pricing.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argument = (name) => args[args.indexOf(name) + 1]
async function source(flag, url) {
  return args.includes(flag) ? JSON.parse(await fs.readFile(argument(flag), 'utf8')) : fetchCatalogJSON(url, { timeoutMs: 30_000 })
}
const [pricing, metadata, supplements] = await Promise.all([
  source('--prices', PRICE_SOURCE_URL), source('--metadata', METADATA_SOURCE_URL),
  fs.readFile(path.join(root, 'data/model-supplements.json'), 'utf8').then(JSON.parse),
])
if (args.includes('--reference')) {
  const reference = path.resolve(argument('--reference'), 'backend/internal')
  const files = { openai: 'pkg/openai/constants.go', anthropic: 'pkg/claude/constants.go', antigravity: 'pkg/antigravity/claude_types.go' }
  for (const [platform, file] of Object.entries(files)) {
    const text = await fs.readFile(path.join(reference, file), 'utf8')
    const section = platform === 'antigravity' ? text.slice(text.indexOf('var claudeModels'), text.indexOf('// ========== Claude API'))
      : text.slice(text.indexOf('var DefaultModels'), text.indexOf('// DefaultModelIDs'))
    supplements.models[platform] = [...new Set([...(supplements.models[platform] || []), ...[...section.matchAll(/ID:\s*"([^"]+)"/g)].map((match) => match[1])])]
  }
  const billing = await fs.readFile(path.join(reference, 'service/billing_service.go'), 'utf8')
  const openCode = await fs.readFile(path.join(reference, 'service/opencode_go.go'), 'utf8')
  const section = openCode.slice(openCode.indexOf('func DefaultOpenCodeGoModelIDs'), openCode.indexOf('func normalizeOpenCodeGoModelID'))
  supplements.models.opencode_go = [...section.matchAll(/"([a-z0-9][\w.-]+)"/g)].map((match) => match[1])
  const ids = [...billing.matchAll(/fallbackPrices\["([^"]+)"\]\s*=/g)].map((match) => match[1])
  for (const [platform, prefix] of Object.entries({ grok: 'grok-', deepseek: 'deepseek-', kimi: 'kimi-', zhipu: 'glm-', minimax: 'minimax-', typesafe: 'jev-' })) {
    supplements.models[platform] = [...new Set([...(supplements.models[platform] || []), ...ids.filter((id) => id.startsWith(prefix))])]
  }
  for (const id of supplements.models.antigravity) {
    if (/^gemini-3\.[678]-flash-(high|low|medium|tiered)$/.test(id)) supplements.aliases.antigravity[id] = id.replace(/-(high|low|medium|tiered)$/, '')
  }
}
if (!args.includes('--skip-official')) {
  const official = await fetchOfficialOverrides({ fetchText: async (url) => {
    const platform = Object.keys(OFFICIAL_SOURCES).find((id) => OFFICIAL_SOURCES[id] === url)
    const flag = `--official-${platform}`
    if (args.includes(flag)) return fs.readFile(argument(flag), 'utf8')
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) throw new Error(`Official price source HTTP ${response.status}`)
    return response.text()
  } })
  for (const [platform, overrides] of Object.entries(official)) supplements.overrides[platform] = { ...supplements.overrides[platform], ...overrides }
}
await fs.writeFile(path.join(root, 'data/model-supplements.json'), `${JSON.stringify(supplements, null, 2)}\n`)
const platforms = buildModelCatalog(pricing, metadata, supplements)
if (platforms.some((platform) => !platform.models.length)) throw new Error('A platform is missing models')
const snapshot = { updated_at: new Date().toISOString(), sources: [PRICE_SOURCE_URL, METADATA_SOURCE_URL, ...Object.values(OFFICIAL_SOURCES)], platforms }
await fs.mkdir(path.join(root, 'src/data'), { recursive: true })
await fs.writeFile(path.join(root, 'src/data/model-catalog.json'), `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(platforms.map((platform) => `${platform.name}: ${platform.models.length}`).join('\n'))
