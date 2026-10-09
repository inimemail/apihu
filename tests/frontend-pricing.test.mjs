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
  assert.deepEqual(groups[0].rows.map((row) => row.label), ['输入', '缓存读取', '缓存写入 · 5m', '缓存写入 · 1h', '输出'])
  assert.deepEqual(groups[0].rows.map((row) => row.price), [3, .3, 3, 6, 15])
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
