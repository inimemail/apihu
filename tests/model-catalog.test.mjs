import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { buildModelCatalog, catalogFromChannels, createCatalogStore, createModel, mergeCatalogs, normalizeCatalogOverride, restoreCatalogSnapshot } from '../server/model-catalog.mjs'
import { parseDeepSeekHTML, parseOfficialMarkdown, applyOfficialOverrides, refreshPublicCatalog } from '../server/official-pricing.mjs'

const snapshot = JSON.parse(fs.readFileSync(new URL('../src/data/model-catalog.json', import.meta.url), 'utf8'))
const find = (platform, model) => snapshot.platforms.find((item) => item.id === platform).models.find((item) => item.id.toLowerCase() === model.toLowerCase())

test('offline catalog includes all eleven platforms and unique models', () => {
  assert.equal(snapshot.platforms.length, 11)
  assert.ok(snapshot.platforms.reduce((sum, platform) => sum + platform.models.length, 0) >= 390)
  for (const platform of snapshot.platforms) {
    assert.ok(platform.models.length)
    assert.equal(new Set(platform.models.map((model) => model.id.toLowerCase())).size, platform.models.length)
    let previous = Infinity
    for (const model of platform.models) {
      const released = Date.parse(model.release_date || '') || 0
      assert.ok(released <= previous)
      previous = released
      for (const group of model.price_groups) for (const row of group.rows) {
        assert.ok(row.price === null || (Number.isFinite(row.price) && row.price >= 0))
      }
    }
  }
})

test('per-token prices are converted exactly once and free prices are preserved', () => {
  const model = createModel('example', { input_cost_per_token: 0, output_cost_per_token: 0.000002, cache_read_input_token_cost: 3e-9 })
  assert.equal(model.input_price, 0)
  assert.equal(model.output_price, 2)
  assert.equal(model.cache_read_price, .003)
  assert.equal(model.cache_write_price, null)
})

test('cache read and write remain independent', () => {
  const writeOnly = createModel('example', { input_cost_per_token: 1e-6, cache_creation_input_token_cost: 2e-6 })
  const rows = writeOnly.price_groups[0].rows
  assert.ok(rows.some((row) => row.key === 'cache_write_price' && row.price === 2))
  assert.ok(!rows.some((row) => row.key === 'cache_read_price'))
})

test('reference metadata replaces stale mirror rates without rescaling', () => {
  const model = createModel('example', { input_cost_per_token: 9e-6 }, { release_date: '2026-10-01', cost: { input: 2, output: 10 } })
  assert.equal(model.input_price, 2)
  assert.equal(model.release_date, '2026-10-01')
})

test('image, audio and character prices retain their actual units', () => {
  const image = createModel('image', { mode: 'image_generation', input_cost_per_token: 5e-6, input_cost_per_image_token: 8e-6, output_cost_per_image_token: 30e-6, output_cost_per_image: .12 }, { cost: { input: 5, output: 30 } })
  assert.ok(image.price_groups.some((group) => group.rows.some((row) => row.label === '图片输出' && row.price === 30)))
  assert.ok(!image.price_groups.some((group) => group.unit === 'USD / 张'))
  const audio = createModel('audio', { mode: 'audio_transcription', input_cost_per_second: .0001 })
  assert.equal(audio.price_groups[0].unit, 'USD / 分钟')
  assert.equal(audio.price_groups[0].rows[0].price, .006)
  const speech = createModel('speech', { input_cost_per_character: .000015 })
  assert.ok(speech.price_groups.some((group) => group.unit === 'USD / 1M 字符' && group.rows[0].price === 15))
})

test('long context tiers and cache TTL prices are not flattened', () => {
  const m3 = find('minimax', 'minimax-m3')
  assert.equal(m3.input_price, .3)
  assert.equal(m3.price_groups[1].rows.find((row) => row.key === 'input_price').price, .6)
  assert.match(m3.price_groups[1].label, /512K/)
  const k3 = find('kimi', 'kimi-k3')
  assert.equal(k3.cache_write_price, 3)
  assert.equal(k3.cache_write_1h_price, 6)
  assert.equal(find('deepseek', 'deepseek-flash').price_groups[1].rows[0].price, .3)
})

test('configured model overrides merge rather than replace the complete catalog', () => {
  const override = normalizeCatalogOverride('[{"id":"openai","name":"OpenAI","models":[{"id":"custom-model","input_price":1}]}]')
  const merged = mergeCatalogs(snapshot.platforms, override)
  assert.equal(merged.length, 11)
  assert.ok(merged.find((platform) => platform.id === 'openai').models.length > 150)
  assert.equal(normalizeCatalogOverride('bad').length, 0)
  assert.equal(normalizeCatalogOverride('[{"name":"x","models":[{"id":"y","input_price":-1}]}]')[0].models[0].input_price, null)
  const partial = mergeCatalogs(snapshot.platforms, normalizeCatalogOverride('[{"id":"openai","name":"OpenAI","models":[{"id":"gpt-5.4","input_price":7}]}]'))
  const model = partial.find((platform) => platform.id === 'openai').models.find((model) => model.id === 'gpt-5.4')
  assert.equal(model.input_price, 7)
  assert.equal(model.output_price, find('openai', 'gpt-5.4').output_price)
  assert.equal(model.price_groups[0].rows[0].price, 7)
})

test('channel imports add model names without leaking channel prices or wildcards', () => {
  const channels = [{ status: 'active', model_pricing: [{ platform: 'openai', models: ['custom', 'gpt-*'], input_price: 100 }], model_mapping: { openai: { 'client-alias': 'gpt-5.4', 'gpt-5.4': 'gpt-5.4' } } },
    { status: 'inactive', model_mapping: { openai: { 'private-disabled': 'secret' } } }]
  const imported = catalogFromChannels(channels, snapshot.platforms)[0].models
  assert.deepEqual(imported.map((model) => model.id).sort(), ['client-alias', 'custom', 'gpt-5.4'])
  assert.equal(imported.find((model) => model.id === 'custom').input_price, null)
  assert.equal(imported.find((model) => model.id === 'client-alias').input_price, null)
})

test('background refresh coalesces concurrent requests and retains data on failure', async () => {
  let calls = 0, currentTime = 0
  const initial = snapshot.platforms
  const store = createCatalogStore({ initial, intervalMs: 10, now: () => currentTime, onError: () => {}, refresh: async () => { calls++; throw new Error('offline') } })
  assert.equal(store.get(), initial)
  store.get()
  await store.settled()
  assert.equal(calls, 1)
  assert.equal(store.get(), initial)
  currentTime = 11
  store.get()
  await store.settled()
  assert.equal(calls, 2)
})

test('successful background refresh becomes visible', async () => {
  const next = [{ id: 'openai', models: [{ id: 'new' }] }]
  const store = createCatalogStore({ initial: snapshot.platforms, refresh: async () => next })
  store.get()
  assert.equal(await store.settled(), next)
})

test('official markdown parser respects MiniMax permanent discount and tiers', () => {
  const text = `<Tab title="Standard">\n| Model | Input | Output | Prompt caching Read |\n| :- | :- | :- | :- |\n| **MiniMax-M3** ≤512k | ~~\\$0.60~~ \\$0.30 | ~~\\$2.40~~ \\$1.20 | \\$0.06 |\n| **MiniMax-M3** >512k | \\$0.60 | \\$2.40 | \\$0.12 |\n</Tab>\n| Model | Input | Output | Prompt caching Read | Prompt caching Write |\n| :- | :- | :- | :- | :- |\n` + ['M2.7', 'M2.5', 'M2.1', 'M2'].map((id) => `| MiniMax-${id} | $0.30 | $1.20 | $0.06 | $0.375 |`).join('\n')
  const parsed = parseOfficialMarkdown('minimax', text)
  assert.equal(parsed['minimax-m3'].prices.input_price, .3)
  assert.equal(parsed['minimax-m3'].tiers[0].prices.input_price, .6)
  assert.equal(parsed['minimax-m2'].prices.cache_write_price, .375)
  assert.throws(() => parseOfficialMarkdown('minimax', 'Access denied'))
})

test('Kimi parser handles both cache TTL table and cache-hit table', () => {
  const text = 'rows={[ ["kimi-k3", "1M tokens", <>{"$"}3.00</>, <>{"$"}6.00</>, <>{"$"}0.30</>, <>{"$"}3.00</>, <>{"$"}15.00</>, "1M"], ]}\nrows={[ ["kimi-k2.6", "1M tokens", <>{"$"}0.16</>, <>{"$"}0.95</>, <>{"$"}4.00</>, "256K"], ["kimi-k2.7-code", "1M tokens", <>{"$"}0.19</>, <>{"$"}0.95</>, <>{"$"}4.00</>, "256K"], ]}'
  const prices = parseOfficialMarkdown('kimi', text)
  assert.equal(prices['kimi-k3'].prices.cache_write_1h_price, 6)
  assert.equal(prices['kimi-k2.6'].prices.cache_read_price, .16)
  assert.equal(prices['kimi-k2.6'].prices.cache_write_price, null)
})

test('DeepSeek HTML parser distinguishes peak and off-peak without guessing missing columns', () => {
  const html = '<table>' + [['1M INPUT TOKENS(CACHE HIT)', 'OFF-PEAK', '$0.003', '$0.022'], ['PEAK', '$0.006', '$0.044'], ['1M INPUT TOKENS(CACHE MISS)', 'OFF-PEAK', '$0.15', '$0.66'], ['PEAK', '$0.3', '$1.32'], ['1M OUTPUT TOKENS', 'OFF-PEAK', '$0.6', '$1.98'], ['PEAK', '$1.2', '$3.96']].map((row) => '<tr>' + row.map((value) => `<td>${value}</td>`).join('') + '</tr>').join('') + '</table>'
  const parsed = parseDeepSeekHTML(html)
  assert.equal(parsed['deepseek-v4-pro'].groups[1].rows[2].price, 3.96)
  assert.throws(() => parseDeepSeekHTML('<html>Forbidden</html>'))
})

test('live official prices replace stale reference values and preserve release dates', () => {
  const previous = find('kimi', 'kimi-k3')
  const next = applyOfficialOverrides(snapshot.platforms, { kimi: { 'kimi-k3': { prices: { input_price: 4, output_price: 20 }, verified_at: '2026-10-09' } } })
  const model = next.find((platform) => platform.id === 'kimi').models.find((model) => model.id === 'kimi-k3')
  assert.equal(model.input_price, 4)
  assert.equal(model.release_date, previous.release_date)
  assert.equal(model.price_source, 'official')
})

test('invalid remote source shape is rejected before replacing cache', () => {
  assert.throws(() => buildModelCatalog({}, {}))
})

test('older persisted cache cannot hide new bundled models or newer verified prices', () => {
  const cached = structuredClone(snapshot)
  cached.updated_at = '2026-01-01T00:00:00Z'
  const kimi = cached.platforms.find((platform) => platform.id === 'kimi')
  kimi.models = [createModel('kimi-k3', {}, {}, { verified_at: '2026-01-01', prices: { input_price: 99 } })]
  const restored = restoreCatalogSnapshot(snapshot, cached)
  assert.equal(restored.find((platform) => platform.id === 'kimi').models.length, findPlatform('kimi').models.length)
  assert.equal(restored.find((platform) => platform.id === 'kimi').models.find((model) => model.id === 'kimi-k3').input_price, 3)
  kimi.models[0].verified_at = find('kimi', 'kimi-k3').verified_at
  assert.equal(restoreCatalogSnapshot(snapshot, cached).find((platform) => platform.id === 'kimi').models.find((model) => model.id === 'kimi-k3').input_price, 3)
  assert.equal(restoreCatalogSnapshot(snapshot, { platforms: [{ id: 'broken' }] }), snapshot.platforms)
})

function findPlatform(id) { return snapshot.platforms.find((platform) => platform.id === id) }

test('official updates still apply when a reference source is unavailable', async () => {
  const next = await refreshPublicCatalog({ previous: snapshot.platforms, supplements: {},
    fetchPricing: async () => { throw new Error('offline') }, fetchMetadata: async () => ({}),
    fetchOfficial: async () => ({ kimi: { 'kimi-k3': { verified_at: '2026-10-10', prices: { input_price: 4, output_price: 20 } } } }), onError: () => {},
  })
  assert.equal(next.length, 11)
  assert.equal(next.find((platform) => platform.id === 'kimi').models.find((model) => model.id === 'kimi-k3').input_price, 4)
})

test('Gemini context tiers do not invent cache-write charges', () => {
  const model = createModel('gemini', {}, { cost: { input: 2, output: 12, cache_write: 2, tiers: [{ tier: { type: 'context', size: 200000 }, input: 4, output: 18, cache_write: 4 }] } }, {}, 'gemini')
  assert.ok(model.price_groups.every((group) => !group.rows.some((row) => row.key.startsWith('cache_write'))))
})

test('GLM image and video rates use per-item units rather than token prices', () => {
  const text = '| Model | Input | Output |\n| :- | :- | :- |\n' + ['glm-5.3', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-4.7'].map((id) => `| ${id} | $1 | $2 |`).join('\n')
    + '\n\n| Model | Price |\n| :- | :- |\n| GLM-Image | $0.015 |\n| CogVideoX-3 | $0.2 |'
  const parsed = parseOfficialMarkdown('zhipu', text)
  assert.equal(parsed['glm-image'].groups[0].unit, 'USD / 张')
  assert.equal(parsed['cogvideox-3'].groups[0].unit, 'USD / 段')
})
