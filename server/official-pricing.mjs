import { load } from 'cheerio'
import { buildModelCatalog, createModel, mergeCatalogs } from './model-catalog.mjs'

export const OFFICIAL_SOURCES = {
  zhipu: 'https://docs.z.ai/guides/overview/pricing.md',
  minimax: 'https://platform.minimax.io/docs/guides/pricing-paygo.md',
  kimi: 'https://platform.kimi.ai/docs/pricing/chat-k3.md',
  deepseek: 'https://api-docs.deepseek.com/quick_start/pricing',
}

function price(text) {
  const value = String(text).replace(/~~.*?~~/g, '')
  if (/^free$/i.test(value.trim())) return 0
  const match = value.match(/\$\s*(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function tables(text) {
  const result = []
  let table = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) { table = null; continue }
    const cells = line.trim().slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, '')))) continue
    if (!table) { table = { columns: cells, rows: [] }; result.push(table) }
    else if (cells.length === table.columns.length) table.rows.push(cells)
  }
  return result
}

function verified(platform, prices, extra = {}) {
  return { source: OFFICIAL_SOURCES[platform].replace(/\.md$/, ''), verified_at: new Date().toISOString().slice(0, 10), prices, ...extra }
}

export function parseOfficialMarkdown(platform, text) {
  if (platform === 'kimi') return parseKimi(text)
  if (!['zhipu', 'minimax'].includes(platform)) throw new Error('Unsupported official price parser')
  const overrides = {}
  const m3 = []
  const standard = platform === 'minimax' ? text.replace(/<Tab title="Priority[^]*?<\/Tab>/g, '') : text
  for (const table of tables(standard)) {
    const column = (name) => table.columns.findIndex((cell) => name.test(cell))
    const input = column(/^input$/i), output = column(/^output$/i)
    if (platform === 'zhipu' && column(/^price$/i) >= 0) {
      for (const row of table.rows) {
        const id = row[0].toLowerCase()
        const unit = id === 'glm-image' || id === 'cogview-4' ? 'USD / 张' : id === 'cogvideox-3' ? 'USD / 段' : id === 'glm-asr-2512' ? 'USD / 1M tokens' : null
        if (!unit) continue
        const value = price(row[column(/^price$/i)])
        if (value === null) throw new Error(`Missing official price for ${id}`)
        overrides[id] = verified(platform, { input_price: null, output_price: null }, { groups: [{ label: '', unit, rows: [{ key: id === 'glm-asr-2512' ? 'input' : 'output', label: id === 'glm-asr-2512' ? '音频输入' : '输出', price: value }] }] })
      }
    }
    if (input < 0 || output < 0) continue
    const read = column(/^(cached input|prompt caching read)$/i)
    const write = column(/^prompt caching write$/i)
    for (const row of table.rows) {
      const id = load(row[0]).text().replace(/\*/g, '').match(/^(glm-|minimax-)[\w.-]+/i)?.[0].toLowerCase()
      if (!id) continue
      const prices = { input_price: price(row[input]), output_price: price(row[output]), cache_read_price: read >= 0 ? price(row[read]) : null,
        cache_write_price: write >= 0 ? price(row[write]) : null, cache_write_1h_price: null }
      if (prices.input_price === null || prices.output_price === null) throw new Error(`Missing official price for ${id}`)
      if (id === 'minimax-m3') { m3.push(prices); continue }
      overrides[id] = verified(platform, prices, { tiers: [] })
    }
  }
  if (m3.length === 2) overrides['minimax-m3'] = verified(platform, m3[0], { tiers: [{ threshold: 512000, prices: m3[1] }] })
  if (Object.keys(overrides).length < 5) throw new Error(`Official ${platform} table format changed`)
  return overrides
}

function parseKimi(text) {
  const overrides = {}
  for (const match of text.matchAll(/rows=\{\[([\s\S]*?)\]\}/g)) {
    const content = match[1].replace(/<>\{"\$"\}(\d+(?:\.\d+)?)<\/>/g, '"$$$1"').replace(/,\s*$/, '')
    const rows = JSON.parse(`[${content}]`)
    for (const row of rows) {
      if (!row[0]?.startsWith('kimi-') || row[1] !== '1M tokens') continue
      let prices
      if (row.length === 8) prices = { input_price: price(row[5]), output_price: price(row[6]), cache_read_price: price(row[4]), cache_write_price: price(row[2]), cache_write_1h_price: price(row[3]) }
      else if (row.length === 6) prices = { input_price: price(row[3]), output_price: price(row[4]), cache_read_price: price(row[2]), cache_write_price: null, cache_write_1h_price: null }
      else throw new Error('Kimi price column layout changed')
      if (prices.input_price === null || prices.output_price === null) throw new Error('Kimi official prices missing')
      overrides[row[0]] = verified('kimi', prices, { tiers: [] })
    }
  }
  if (!overrides['kimi-k3'] || Object.keys(overrides).length < 3) throw new Error('Kimi official table format changed')
  return overrides
}

export function parseDeepSeekHTML(html) {
  const $ = load(html)
  const values = { flash: { off: {}, peak: {} }, pro: { off: {}, peak: {} } }
  let field = ''
  $('table tr').each((_, row) => {
    const cells = $(row).find('td,th').map((_, cell) => $(cell).text().trim()).get()
    const labels = cells.join(' ')
    if (/INPUT TOKENS\s*\(CACHE HIT\)/.test(labels)) field = 'cache_read_price'
    else if (/INPUT TOKENS\s*\(CACHE MISS\)/.test(labels)) field = 'input_price'
    else if (/OUTPUT TOKENS/.test(labels)) field = 'output_price'
    const period = cells.includes('OFF-PEAK') ? 'off' : cells.includes('PEAK') ? 'peak' : null
    if (!field || !period) return
    const prices = cells.map(price).filter((value) => value !== null)
    if (prices.length !== 2) throw new Error('DeepSeek official price columns changed')
    values.flash[period][field] = prices[0]
    values.pro[period][field] = prices[1]
  })
  for (const model of Object.values(values)) for (const period of Object.values(model)) {
    if (Object.keys(period).length !== 3) throw new Error('DeepSeek official price table incomplete')
  }
  const overrides = {}
  for (const id of ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro']) {
    const model = id === 'deepseek-v4-pro' ? values.pro : values.flash
    const groups = [['off', '低峰'], ['peak', '高峰']].map(([period, label]) => ({ label, unit: 'USD / 1M tokens',
      rows: [['input_price', '输入'], ['cache_read_price', '缓存读取'], ['output_price', '输出']].map(([key, title]) => ({ key, label: title, price: model[period][key] })) }))
    overrides[id] = verified('deepseek', { ...model.off, cache_write_price: null, cache_write_1h_price: null }, { groups })
  }
  return overrides
}

async function fetchOfficialText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error(`Official price source HTTP ${response.status}`)
  const chunks = []
  let bytes = 0
  for await (const chunk of response.body) {
    bytes += chunk.length
    if (bytes > 2_000_000) throw new Error('Official price page too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function fetchOfficialOverrides({ fetchText = fetchOfficialText, onError = console.warn } = {}) {
  const results = await Promise.all(Object.entries(OFFICIAL_SOURCES).map(async ([platform, url]) => {
    try {
      const text = await fetchText(url)
      return [platform, platform === 'deepseek' ? parseDeepSeekHTML(text) : parseOfficialMarkdown(platform, text)]
    } catch (error) { onError(`[api-dz] ${platform} official price refresh skipped: ${error.message}`); return null }
  }))
  return Object.fromEntries(results.filter(Boolean))
}

export function applyOfficialOverrides(catalog, overrides) {
  const patches = catalog.map((platform) => ({ ...platform, models: Object.entries(overrides[platform.id] || {}).map(([id, override]) => {
    const known = platform.models.find((model) => model.id.toLowerCase() === id.toLowerCase())
    return { ...known, ...createModel(known?.id || id, {}, {}, override, platform.id), release_date: known?.release_date }
  }) }))
  return mergeCatalogs(catalog, patches)
}

export async function refreshPublicCatalog({ previous, supplements, fetchPricing, fetchMetadata, fetchOfficial = fetchOfficialOverrides, onError = console.warn }) {
  const sources = await Promise.allSettled([fetchPricing(), fetchMetadata(), fetchOfficial()])
  let catalog = previous
  try {
    if (sources[0].status !== 'fulfilled') throw sources[0].reason
    if (sources[1].status !== 'fulfilled') throw sources[1].reason
    const official = previous.map((platform) => ({ ...platform, models: platform.models.filter((model) => model.price_source === 'official') }))
    catalog = mergeCatalogs(previous, buildModelCatalog(sources[0].value, sources[1].value, supplements), official)
  } catch (error) {
    onError(`[api-dz] reference refresh skipped; retaining model directory: ${error.message}`)
  }
  if (sources[2].status === 'fulfilled') catalog = applyOfficialOverrides(catalog, sources[2].value)
  else onError(`[api-dz] official refresh skipped: ${sources[2].reason.message}`)
  return catalog
}
