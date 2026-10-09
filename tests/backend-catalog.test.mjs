import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = (file) => fileURLToPath(new URL(`fixtures/${file}`, import.meta.url))

test('public model endpoint and checkout work with failed price sources, without subscription writes', async () => {
  const requests = []
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    requests.push({ method: req.method, path: url.pathname })
    let data
    if (url.pathname === '/auth/login') data = { access_token: 'test-token', expires_in: 1800 }
    else if (url.pathname === '/payment/checkout-info') data = { balance_recharge_multiplier: 2, methods: { alipay: { enabled: true }, wxpay: { enabled: true } } }
    else if (url.pathname === '/admin/settings') data = { payment_balance_recharge_multiplier: 2 }
    else if (url.pathname === '/admin/channels') data = { items: [{ status: 'active', model_mapping: { openai: { 'test-gateway-model': 'unused' } } }], total: 1 }
    else { res.writeHead(503); res.end(); return }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ code: 0, data }))
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const upstreamURL = `http://127.0.0.1:${upstream.address().port}`
  const reserve = http.createServer()
  reserve.listen(0, '127.0.0.1')
  await once(reserve, 'listening')
  const port = reserve.address().port
  await new Promise((resolve) => reserve.close(resolve))
  const cacheDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'api-dz-model-test-'))
  const child = spawn(process.execPath, ['--import', new URL('fixtures/local-fetch-only.mjs', import.meta.url).href, 'server/index.mjs', '--production'], {
    cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production',
      SUB2API_BASE_URL: upstreamURL, SUB2API_ADMIN_EMAIL: 'test@localhost.invalid', SUB2API_ADMIN_PASSWORD_FILE: fixture('admin-password.txt'),
      CHECKOUT_MODEL_PRICE_URL: `${upstreamURL}/offline-prices`, CHECKOUT_MODEL_METADATA_URL: `${upstreamURL}/offline-metadata`,
      CHECKOUT_MODEL_CATALOG_JSON: '', CHECKOUT_MODEL_CACHE_DIR: cacheDirectory,
    }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  const childExited = once(child, 'exit')
  child.stdout.on('data', (chunk) => { logs += chunk })
  child.stderr.on('data', (chunk) => { logs += chunk })
  const origin = `http://127.0.0.1:${port}`
  async function waitForJSON(endpoint, accept = () => true) {
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Backend exited before startup:\n${logs}`)
      try {
        const response = await fetch(`${origin}${endpoint}`)
        const value = await response.json()
        if (response.ok && accept(value)) return value
      } catch { /* Wait until the child has opened its listener. */ }
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    throw new Error(`Endpoint did not become ready: ${endpoint}\n${logs}`)
  }
  try {
    const directory = await waitForJSON('/api/checkout/models', (payload) => payload.data.models.some((p) => p.models.some((m) => m.id === 'test-gateway-model')))
    assert.equal(directory.data.models.length, 11)
    assert.ok(directory.data.models.reduce((sum, p) => sum + p.models.length, 0) >= 490)
    const imported = directory.data.models.find((p) => p.id === 'openai').models.find((m) => m.id === 'test-gateway-model')
    assert.equal(imported.input_price, null)
    assert.ok(!JSON.stringify(directory).includes('test-token'))
    const checkout = await waitForJSON('/api/checkout/catalog')
    assert.equal(checkout.data.balance.multiplier, 2)
    assert.deepEqual(checkout.data.plans, [])
    assert.equal(checkout.data.models.length, 11)
    assert.ok(requests.every((req) => req.method === 'GET' || req.path === '/auth/login'))
    assert.ok(!requests.some((req) => req.path.includes('plans') || req.path.includes('orders')))
    const cached = JSON.parse(await fs.readFile(path.join(cacheDirectory, 'model-catalog.json'), 'utf8'))
    assert.equal(cached.platforms.length, 11)
  } finally {
    if (child.exitCode === null) child.kill()
    await childExited
    upstream.closeAllConnections()
    await new Promise((resolve) => upstream.close(resolve))
    await fs.rm(cacheDirectory, { recursive: true, force: true })
  }
})
