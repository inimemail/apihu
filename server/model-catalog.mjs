export const PRICE_SOURCE_URL = 'https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.json'
export const METADATA_SOURCE_URL = 'https://models.dev/api.json'

export const PLATFORM_DEFINITIONS = [
  { id: 'openai', name: 'OpenAI', short_name: 'AI', provider: 'openai', price_providers: ['openai', 'text-completion-openai'] },
  { id: 'anthropic', name: 'Anthropic', short_name: 'A', provider: 'anthropic', price_providers: ['anthropic', 'bedrock'] },
  { id: 'gemini', name: 'Google Gemini', short_name: 'G', provider: 'google', price_providers: ['gemini', 'vertex_ai-language-models', 'vertex_ai-embedding-models'] },
  { id: 'grok', name: 'xAI Grok', short_name: 'x', provider: 'xai', price_providers: ['xai'] },
  { id: 'deepseek', name: 'DeepSeek', short_name: 'DS', provider: 'deepseek', price_providers: ['deepseek'] },
  { id: 'kimi', name: 'Kimi', short_name: 'K', provider: 'moonshotai', price_providers: ['moonshot'] },
  { id: 'zhipu', name: '智谱 GLM', short_name: 'GLM', provider: 'zhipuai', price_providers: ['zhipu'] },
  { id: 'minimax', name: 'MiniMax', short_name: 'M', provider: 'minimax', price_providers: ['minimax'] },
  { id: 'antigravity', name: 'Antigravity', short_name: 'AG', price_providers: [] },
  { id: 'opencode_go', name: 'OpenCode', short_name: 'OC', provider: 'opencode-go', additional_providers: ['opencode'], price_providers: ['opencode-go'] },
  { id: 'typesafe', name: 'TypeSafe / Jev', short_name: 'J', price_providers: ['typesafe'] },
]

const TOKEN_UNIT = 'USD / 1M tokens'
const PRICE_FIELDS = [
  ['input_price', 'input_cost_per_token', 'input', '输入'],
  ['cache_read_price', 'cache_read_input_token_cost', 'cache_read', '缓存读取'],
  ['cache_write_price', 'cache_creation_input_token_cost', 'cache_write', '缓存写入'],
  ['cache_write_1h_price', 'cache_creation_input_token_cost_above_1hr', 'cache_write_1h', '缓存写入 · 1h'],
  ['output_price', 'output_cost_per_token', 'output', '输出'],
]

function money(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function date(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) ? value : undefined
}

function indexModels(models = {}) {
  return new Map(Object.entries(models).map(([id, model]) => [id.toLowerCase(), model]))
}

function findModel(index, id) {
  return index.get(id.toLowerCase())
}

function rowsFromPrices(prices, includeMissing = true) {
  return PRICE_FIELDS.flatMap(([key, , , label]) => {
    const value = money(prices[key])
    if (value === null && !(includeMissing && (key === 'input_price' || key === 'output_price'))) return []
    return [{ key, label: key === 'cache_write_price' && money(prices.cache_write_1h_price) !== null ? '缓存写入 · 5m' : label, price: value }]
  })
}

function group(label, prices, unit = TOKEN_UNIT) {
  return { label, unit, rows: rowsFromPrices(prices) }
}

function metadataPrices(model = {}) {
  return Object.fromEntries(PRICE_FIELDS.map(([key, , metadataKey]) => [key, money(model.cost?.[metadataKey])]))
}

function tokenPrices(raw = {}) {
  return Object.fromEntries(PRICE_FIELDS.map(([key, source]) => [key, money(raw[source]) === null ? null : Number(raw[source]) * 1_000_000]))
}

function rawTiers(raw) {
  const thresholds = [...new Set(Object.keys(raw).flatMap((key) => {
    const match = key.match(/_above_(\d+)k_tokens$/)
    return match ? [Number(match[1]) * 1000] : []
  }))].sort((a, b) => a - b)
  return thresholds.map((threshold) => ({
    threshold,
    prices: Object.fromEntries(PRICE_FIELDS.map(([key, source]) => {
      const tierKey = source === 'cache_creation_input_token_cost_above_1hr'
        ? `cache_creation_input_token_cost_above_1hr_above_${threshold / 1000}k_tokens`
        : `${source}_above_${threshold / 1000}k_tokens`
      return [key, money(raw[tierKey]) === null ? null : Number(raw[tierKey]) * 1_000_000]
    })),
  }))
}

function metadataTiers(model) {
  return (model.cost?.tiers || []).filter((tier) => tier.tier?.type === 'context' && money(tier.tier.size) > 0)
    .map((tier) => ({ threshold: Number(tier.tier.size), prices: metadataPrices({ cost: tier }) }))
}

function extraPrices(raw) {
  const fields = [
    ['input_cost_per_image_token', '图片输入', 'USD / 1M tokens', 1_000_000],
    ['cache_read_input_image_token_cost', '图片缓存读取', 'USD / 1M tokens', 1_000_000],
    ['output_cost_per_image_token', '图片输出', 'USD / 1M tokens', 1_000_000],
    ['input_cost_per_audio_token', '音频输入', 'USD / 1M tokens', 1_000_000],
    ['cache_read_input_audio_token_cost', '音频缓存读取', 'USD / 1M tokens', 1_000_000],
    ['output_cost_per_audio_token', '音频输出', 'USD / 1M tokens', 1_000_000],
    ['input_cost_per_video_token', '视频输入', 'USD / 1M tokens', 1_000_000],
    ['output_cost_per_video_token', '视频输出', 'USD / 1M tokens', 1_000_000],
    ['input_cost_per_character', '字符输入', 'USD / 1M 字符', 1_000_000],
    ['input_cost_per_second', '音频输入', 'USD / 分钟', 60],
    ['input_cost_per_audio_per_second', '音频输入', 'USD / 秒', 1],
    ['output_cost_per_second', '输出', 'USD / 秒', 1],
  ]
  // Image-per-token models may also carry an estimated per-image cost. Do not
  // present that estimate as a universal price for every quality/resolution.
  if (raw.mode === 'image_generation' && money(raw.output_cost_per_image_token) === null) {
    fields.push(['output_cost_per_image', '图片输出', 'USD / 张', 1])
  }
  const groups = new Map()
  for (const [key, label, unit, scale] of fields) {
    if (money(raw[key]) === null) continue
    if (!groups.has(unit)) groups.set(unit, { label: '其他计价项', unit, rows: [] })
    groups.get(unit).rows.push({ key, label, price: Number(raw[key]) * scale })
  }
  return [...groups.values()]
}

export function createModel(id, raw = {}, metadata = {}, override = {}, platform = '') {
  const hasMetadataPrice = money(metadata.cost?.input) !== null || money(metadata.cost?.output) !== null
  const mode = raw.mode || (metadata.modalities?.output?.includes('video') ? 'video_generation' : metadata.modalities?.output?.includes('image') ? 'image_generation' : 'chat')
  const useMetadata = hasMetadataPrice && !['image_generation', 'video_generation', 'audio_speech', 'audio_transcription', 'realtime'].includes(mode)
  const prices = useMetadata ? metadataPrices(metadata) : tokenPrices(raw)
  // Only retain dedicated cache-write charges. A mirrored field equal to input
  // is not proof of a separate official cache-write fee for these providers.
  if (['kimi', 'zhipu', 'gemini'].includes(platform)) {
    prices.cache_write_price = null
    prices.cache_write_1h_price = null
  }
  if (useMetadata && platform === 'anthropic' && money(raw.cache_creation_input_token_cost_above_1hr) !== null) {
    prices.cache_write_1h_price = Number(raw.cache_creation_input_token_cost_above_1hr) * 1_000_000
  }
  Object.assign(prices, override.prices || {})
  let tiers = useMetadata ? metadataTiers(metadata) : rawTiers(raw)
  if (['kimi', 'zhipu', 'gemini'].includes(platform)) {
    tiers = tiers.map((tier) => ({ ...tier, prices: { ...tier.prices, cache_write_price: null, cache_write_1h_price: null } }))
  }
  if (override.tiers) tiers = override.tiers
  const inclusive = platform === 'grok'
  const baseLabel = tiers.length ? `输入 ${inclusive ? '<' : '≤'} ${tiers[0].threshold / 1000}K` : (mode === 'image_generation' ? '文本' : '')
  const priceGroups = [group(baseLabel, prices)]
  for (const [index, tier] of tiers.entries()) {
    const next = tiers[index + 1]
    const label = next ? `${tier.threshold / 1000}K ${inclusive ? '≤' : '<'} 输入 ${inclusive ? '<' : '≤'} ${next.threshold / 1000}K` : `输入 ${inclusive ? '≥' : '>'} ${tier.threshold / 1000}K`
    priceGroups.push(group(label, { ...prices, ...Object.fromEntries(Object.entries(tier.prices).filter(([, value]) => value !== null)) }))
  }
  if (override.groups) priceGroups.splice(0, priceGroups.length, ...override.groups)
  else priceGroups.push(...extraPrices(raw))
  const isMedia = ['video_generation', 'audio_speech', 'audio_transcription', 'realtime'].includes(mode)
  if (isMedia && prices.input_price === null && prices.output_price === null && priceGroups.length > 1) priceGroups.shift()
  if (prices.input_price === null && prices.output_price === null && priceGroups.length === 1 && mode === 'video_generation') {
    priceGroups[0] = { label: '', unit: 'USD / 秒', rows: [{ key: 'output', label: '输出', price: null }] }
  }
  return {
    id,
    name: id,
    release_date: date(metadata.release_date) || date(override.release_date),
    ...prices,
    price_groups: priceGroups,
    price_source: override.verified_at ? 'official' : 'reference',
    price_source_url: override.source || raw.source || raw.pricing_url,
    verified_at: override.verified_at,
  }
}

export function sortCatalog(platforms) {
  return platforms.map((platform) => ({
    ...platform,
    models: [...platform.models].sort((a, b) => (Date.parse(b.release_date || '') || 0) - (Date.parse(a.release_date || '') || 0)
      || a.name.localeCompare(b.name, 'en', { numeric: true })),
  }))
}

export function buildModelCatalog(pricing, metadata, supplements = {}) {
  if (!pricing || Array.isArray(pricing) || !Object.keys(pricing).length || !Object.keys(metadata?.openai?.models || {}).length) throw new Error('Invalid model catalog sources')
  const priceIndex = indexModels(pricing)
  const fallbackIndex = indexModels(supplements.fallback_prices)
  const platforms = PLATFORM_DEFINITIONS.map((platform) => {
    const providerModels = Object.assign({}, ...(platform.additional_providers || []).map((provider) => metadata[provider]?.models || {}), metadata[platform.provider]?.models || {})
    const metaIndex = indexModels(providerModels)
    const seeds = new Map()
    const add = (id) => {
      if (typeof id === 'string' && id.trim() && !id.includes('*')) seeds.set(id.toLowerCase(), id)
    }
    for (const [id, entry] of Object.entries(pricing)) if (platform.price_providers.includes(entry.litellm_provider)) add(id)
    for (const [id, entry] of Object.entries(supplements.fallback_prices || {})) if (platform.price_providers.includes(entry.litellm_provider)) add(id)
    for (const id of Object.keys(providerModels)) add(id)
    for (const id of supplements.models?.[platform.id] || []) add(id)
    for (const id of Object.keys(supplements.overrides?.[platform.id] || {})) add(id)
    return {
      id: platform.id, name: platform.name, short_name: platform.short_name,
      models: [...seeds.values()].map((id) => {
        const alias = supplements.aliases?.[platform.id]?.[id] || (id.endsWith('-thinking') ? id.slice(0, -9) : id)
        const owner = platform.id === 'antigravity' ? (alias.startsWith('claude-') ? metadata.anthropic : metadata.google) : null
        const modelMetadata = findModel(metaIndex, id) || findModel(metaIndex, alias) || findModel(indexModels(owner?.models), alias) || {}
        const raw = findModel(priceIndex, id) || findModel(priceIndex, alias) || findModel(fallbackIndex, id) || findModel(fallbackIndex, alias) || {}
        const overrideIndex = indexModels(supplements.overrides?.[platform.id])
        const override = findModel(overrideIndex, id) || findModel(overrideIndex, alias) || {}
        return createModel(id, raw, modelMetadata, override, platform.id)
      }),
    }
  })
  return sortCatalog(platforms)
}

export function mergeCatalogs(...catalogs) {
  const platforms = new Map()
  for (const catalog of catalogs) for (const platform of catalog || []) {
    if (!platform?.id || !Array.isArray(platform.models)) continue
    const previous = platforms.get(platform.id)
    const models = new Map((previous?.models || []).map((model) => [model.id.toLowerCase(), model]))
    for (const model of platform.models) {
      if (!model?.id || model.id.includes('*')) continue
      const previousModel = models.get(model.id.toLowerCase())
      if (previousModel?.price_source === 'official' && model.price_source === 'official'
        && Date.parse(previousModel.verified_at || '') > Date.parse(model.verified_at || '')) continue
      const merged = { ...previousModel, ...model }
      if (merged.is_price_override) {
        merged.price_groups = [group('', merged)]
        delete merged.verified_at
        delete merged.price_source_url
        delete merged.is_price_override
      }
      models.set(model.id.toLowerCase(), merged)
    }
    platforms.set(platform.id, { ...previous, ...platform, models: [...models.values()] })
  }
  return sortCatalog([...platforms.values()])
}

export function restoreCatalogSnapshot(bundled, cached) {
  const validPrice = (value) => value === null || (typeof value === 'number' && money(value) !== null)
  const validGroup = (priceGroup) => typeof priceGroup?.unit === 'string' && typeof priceGroup.label === 'string'
    && Array.isArray(priceGroup.rows) && priceGroup.rows.every((row) => typeof row?.key === 'string' && typeof row.label === 'string' && validPrice(row.price))
  const validModel = (model) => typeof model?.id === 'string' && typeof model.name === 'string'
    && PRICE_FIELDS.every(([key]) => model[key] === undefined || validPrice(model[key]))
    && Array.isArray(model.price_groups) && model.price_groups.every(validGroup)
  const valid = Array.isArray(cached?.platforms) && cached.platforms.length > 0 && cached.platforms.every((platform) =>
    typeof platform?.id === 'string' && typeof platform.name === 'string' && Array.isArray(platform.models) && platform.models.every(validModel))
  if (!valid) return bundled.platforms
  const latest = Date.parse(cached.updated_at || '') > Date.parse(bundled.updated_at || '')
    ? mergeCatalogs(bundled.platforms, cached.platforms) : mergeCatalogs(cached.platforms, bundled.platforms)
  const ordered = Date.parse(cached.updated_at || '') > Date.parse(bundled.updated_at || '')
    ? [...bundled.platforms, ...cached.platforms] : [...cached.platforms, ...bundled.platforms]
  const verified = ordered.map((platform) => ({
    ...platform, models: platform.models.filter((model) => model.price_source === 'official'),
  }))
  return mergeCatalogs(latest, verified)
}

export function catalogFromChannels(channels, catalog) {
  const byPlatform = new Map(catalog.map((platform) => [platform.id, platform]))
  const result = new Map()
  const add = (platformId, id) => {
    if (!id || id.includes('*')) return
    const platform = byPlatform.get(platformId)
    if (!platform) return
    if (!result.has(platformId)) result.set(platformId, { ...platform, models: [] })
    const known = platform.models.find((model) => model.id.toLowerCase() === id.toLowerCase())
    // Do not publish admin channel prices or guess a price for custom aliases.
    result.get(platformId).models.push(known || createModel(id))
  }
  for (const channel of channels) {
    if (channel.status !== 'active') continue
    for (const pricing of channel.model_pricing || []) for (const id of pricing.models || []) add(pricing.platform, id)
    for (const [platform, mapping] of Object.entries(channel.model_mapping || {})) for (const id of Object.keys(mapping)) add(platform, id)
  }
  return mergeCatalogs([...result.values()])
}

export function normalizeCatalogOverride(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value
    if (!Array.isArray(parsed)) return []
    return parsed.filter((platform) => platform?.name && Array.isArray(platform.models)).map((platform) => ({
      id: String(platform.id || platform.name).toLowerCase().replace(/\s+/g, '-'),
      name: String(platform.name), short_name: platform.short_name,
      models: platform.models.filter((model) => model?.name || model?.id).map((model) => {
        const prices = Object.fromEntries(PRICE_FIELDS.filter(([key]) => Object.hasOwn(model, key)).map(([key]) => [key, money(model[key])]))
        return { id: String(model.id || model.name), name: String(model.name || model.id), ...(date(model.release_date) ? { release_date: date(model.release_date) } : {}), ...prices,
          is_price_override: Object.keys(prices).length > 0, price_source: 'reference' }
      }),
    }))
  } catch {
    return []
  }
}

export function createCatalogStore({ initial, refresh, intervalMs = 86_400_000, onError = console.warn, now = Date.now }) {
  let catalog = initial
  let nextRefresh = 0
  let pending = null
  return {
    get() {
      if (!pending && now() >= nextRefresh) {
        nextRefresh = now() + intervalMs
        pending = Promise.resolve().then(() => refresh(catalog)).then((next) => {
          if (!Array.isArray(next) || !next.some((platform) => platform.models?.length)) throw new Error('Empty model catalog')
          catalog = next
        }).catch((error) => { nextRefresh = now() + Math.min(intervalMs, 300_000); onError(error) }).finally(() => { pending = null })
      }
      return catalog
    },
    async settled() { await pending; return catalog },
  }
}

export async function fetchCatalogJSON(url, { timeoutMs = 12_000, maxBytes = 12_000_000 } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Model source HTTP ${response.status}`)
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Model source too large')
  const chunks = []
  let bytes = 0
  for await (const chunk of response.body) {
    bytes += chunk.length
    if (bytes > maxBytes) throw new Error('Model source too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
