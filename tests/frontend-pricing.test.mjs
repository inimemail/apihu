import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

function loadTypeScript(relativePath) {
  const filename = new URL(relativePath, import.meta.url)
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } })
  const exports = {}
  new Function('exports', 'require', outputText)(exports, createRequire(filename))
  return exports
}

const { formatModelPrice, modelPriceGroups } = loadTypeScript('../src/modelPricing.ts')
const { catalogToProducts, fallbackCatalog } = loadTypeScript('../src/products.ts')

test('small cache prices stay visible and missing prices are not shown as free', () => {
  assert.equal(formatModelPrice(.003), '$0.003')
  assert.equal(formatModelPrice(.000125), '$0.000125')
  assert.equal(formatModelPrice(0), '$0.00')
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(formatModelPrice(value), '\u2014')
})

test('fallback cache pricing preserves separate reads and both write TTLs', () => {
  const groups = modelPriceGroups({ id: 'test', name: 'test', input_price: 3, output_price: 15, cache_read_price: .3, cache_write_price: 3, cache_write_1h_price: 6 })
  assert.deepEqual(groups[0].rows.map((row) => row.label), ['输入', '输出', '缓存读取', '缓存写入 · 5m', '缓存写入 · 1h'])
  assert.deepEqual(groups[0].rows.map((row) => row.price), [3, 15, .3, 3, 6])
})

test('supplementary pricing groups are never displayed, including from cached catalogs', () => {
  const primary = { label: '输入 > 200K', unit: 'USD / 1M tokens', rows: [{ key: 'input_price', label: '输入', price: 2 }, { key: 'output_price', label: '输出', price: 10 }] }
  const extra = { label: '其他计价项', unit: 'USD / 分钟', rows: [{ key: 'input_cost_per_second', label: '音频输入', price: .01 }] }
  const model = { id: 'test', name: 'test', price_groups: [primary, extra] }
  assert.deepEqual(modelPriceGroups(model), [primary])
  assert.equal(model.price_groups.length, 2)
  assert.deepEqual(modelPriceGroups({ ...model, price_groups: [extra] })[0].rows.map((row) => row.price), [null, null])
  for (const platform of fallbackCatalog.models) for (const model of platform.models) {
    assert.ok(modelPriceGroups(model).every((group) => group.label !== '其他计价项'))
  }
})

test('five quick recharges use the same backend multiplier and never subscription plans', () => {
  const products = catalogToProducts({ ...fallbackCatalog, balance: { ...fallbackCatalog.balance, multiplier: 2 }, plans: [{ id: 1, title: '旧套餐' }] })
  assert.equal(products.length, 6)
  assert.equal(products[0].isCustom, true)
  assert.deepEqual(products.slice(1).map((product) => product.amount), [10, 30, 50, 100, 200])
  assert.ok(products.every((product) => product.kind === 'balance'))
  assert.deepEqual(products.slice(1).map((product) => product.subtitle), ['到账 $20.00', '到账 $60.00', '到账 $100.00', '到账 $200.00', '到账 $400.00'])
  assert.ok(products.every((product) => !product.title.includes('旧套餐')))
})

test('mobile navigation labels remain on one line', () => {
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /\.nav a\s*\{[\s\S]*?white-space:\s*nowrap;/)
})
