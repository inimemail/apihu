import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import morgan from 'morgan'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(projectRoot, '.env') })

const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || process.env.APP_PORT || 32874)
const vitePort = Number(process.env.VITE_INTERNAL_PORT || 5175)
const sub2apiBaseURL = normalizeBaseURL(process.env.SUB2API_BASE_URL || 'https://apihu.com/api/v1')
const publicOrigin = (process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`).replace(/\/+$/, '')
const cleanupDelayMs = Number(process.env.CHECKOUT_CLEANUP_DELAY_MS || 90_000)
const orderPollIntervalMs = Number(process.env.CHECKOUT_ORDER_POLL_MS || 5000)
const syncGroupSubscriptions = process.env.CHECKOUT_SYNC_GROUP_SUBSCRIPTIONS !== 'false'
const groupPlanPriceMultiplier = Number(process.env.CHECKOUT_GROUP_PLAN_PRICE_MULTIPLIER || 1)
const groupPlanPriceMin = Number(process.env.CHECKOUT_GROUP_PLAN_PRICE_MIN || 1)
const groupPlanPriceOverrides = parsePriceOverrides(process.env.CHECKOUT_GROUP_PLAN_PRICE_OVERRIDES || '')
const defaultGroupPlanPrices = new Map([
  ['2', 6.99],
  ['3', 24.99],
  ['4', 69.99],
  ['5', 99.99],
  ['6', 139.99],
])

const adminEmail = process.env.SUB2API_ADMIN_EMAIL || ''
const adminPassword = process.env.SUB2API_ADMIN_PASSWORD || ''

const app = express()
const checkoutStore = new Map()
let adminSession = null

app.disable('x-powered-by')
app.use(express.json({ limit: '128kb' }))
app.use(morgan(isProduction ? 'combined' : 'dev'))

app.get('/api/checkout/health', (_req, res) => {
  res.json(ok({
    status: 'ok',
    mode: isProduction ? 'production' : 'development',
    backend: sub2apiBaseURL,
  }))
})

app.get('/api/checkout/catalog', async (_req, res) => {
  try {
    requireAdminConfig()
    const [checkoutInfo, adminPlans, adminGroups] = await Promise.all([
      sub2api('/payment/checkout-info', { method: 'GET' }).catch(() => null),
      withAdmin((token) => sub2api('/admin/payment/plans', { method: 'GET', token })),
      syncGroupSubscriptions
        ? withAdmin((token) => sub2api('/admin/groups/all', { method: 'GET', token })).catch(() => [])
        : Promise.resolve([]),
    ])

    const paymentPlans = normalizePlans(checkoutInfo?.plans?.length ? checkoutInfo.plans : adminPlans)
    const plans = mergePlans(paymentPlans, normalizeSubscriptionGroups(adminGroups, adminPlans))
    res.json(ok({
      balance: {
        id: 'balance',
        kind: 'balance',
        title: '余额充值',
        subtitle: '灵活计费，全平台模型通用',
        description: '充值后创建 API Key 并绑定 OpenAI 或 Claude 额度计费分类即可使用；余额长期有效，适合日常按需调用。',
        min_amount: checkoutInfo?.global_min || 1,
        max_amount: checkoutInfo?.global_max || 0,
        default_amount: Number(process.env.CHECKOUT_DEFAULT_BALANCE_AMOUNT || 20),
        multiplier: checkoutInfo?.balance_recharge_multiplier || 1,
        disabled: Boolean(checkoutInfo?.balance_disabled),
        features: [
          ['适用分类', 'OpenAI / Claude'],
          ['OpenAI', 'Codex / 图像'],
          ['Claude', 'Sonnet / Opus / Haiku'],
          ['扣费方式', '按量计费'],
          ['有效期', '长期有效'],
        ],
      },
      methods: visiblePaymentMethods(checkoutInfo?.methods || {}),
      plans,
      help_text: checkoutInfo?.help_text || '',
      help_image_url: checkoutInfo?.help_image_url || '',
    }))
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/api/checkout/orders', async (req, res) => {
  try {
    const body = req.body || {}
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')
    const paymentType = normalizePaymentType(body.payment_type)
    const orderType = body.order_type === 'subscription' ? 'subscription' : 'balance'
    const requestOrigin = resolveRequestOrigin(req)
    const returnUrl = `${requestOrigin}/payment/result`
    const productId = String(body.product_id || '')

    if (!isValidEmail(email)) throw badRequest('请输入有效邮箱。', 'INVALID_EMAIL')
    if (!paymentType) throw badRequest('请选择支付宝或微信支付。', 'INVALID_PAYMENT_TYPE')

    const existing = await findUserByEmail(email)
    let credential = null
    let userToken = ''
    let user = existing
    let createdByCheckout = false

    if (existing) {
      if (!password.trim()) {
        throw badRequest('这个邮箱已经注册过，请输入账号密码后继续购买。', 'PASSWORD_REQUIRED', {
          account_mode: 'login',
        })
      }
      const loginResult = await loginUser(email, password)
      userToken = loginResult.access_token
      user = loginResult.user || existing
      credential = {
        email,
        isExisting: true,
      }
    } else {
      const generatedPassword = generatePassword()
      user = await withAdmin((token) => createAdminUser(token, email, generatedPassword))
      createdByCheckout = true
      credential = {
        email,
        password: generatedPassword,
        isExisting: false,
      }
      const loginResult = await loginUser(email, generatedPassword)
      userToken = loginResult.access_token
    }

    const payload = await buildCreateOrderPayload({
      orderType,
      productId,
      amount: Number(body.amount || 0),
      paymentType,
      returnUrl,
      isMobile: Boolean(body.is_mobile),
    })

    const order = await sub2api('/payment/orders', {
      method: 'POST',
      token: userToken,
      headers: {
        Origin: requestOrigin,
        Referer: `${requestOrigin}/`,
      },
      body: payload,
    })

    const checkoutId = crypto.randomUUID()
    const state = {
      id: checkoutId,
      email,
      user_id: Number(user?.id || 0),
      created_by_checkout: createdByCheckout,
      credential,
      order,
      product_id: productId,
      order_type: orderType,
      user_token: userToken,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      cleanup_timer: null,
      poll_timer: null,
    }
    checkoutStore.set(checkoutId, state)
    scheduleOrderWatcher(state)

    res.json(ok({
      checkout_id: checkoutId,
      credential,
      order,
    }))
  } catch (error) {
    sendError(res, error)
  }
})

app.get('/api/checkout/orders/:id', async (req, res) => {
  try {
    const state = requireCheckout(req.params.id)
    await refreshCheckoutState(state)
    res.json(ok(publicCheckoutState(state)))
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/api/checkout/orders/:id/check', async (req, res) => {
  try {
    const state = requireCheckout(req.params.id)
    await refreshCheckoutState(state)
    res.json(ok(publicCheckoutState(state)))
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/api/checkout/orders/:id/cancel', async (req, res) => {
  try {
    const state = requireCheckout(req.params.id)
    await cancelCheckoutState(state, 'CANCELLED')
    res.json(ok(publicCheckoutState(state)))
  } catch (error) {
    sendError(res, error)
  }
})

if (isProduction) {
  const distDir = path.join(projectRoot, 'dist')
  app.use(express.static(distDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    root: projectRoot,
    server: {
      middlewareMode: true,
      hmr: {
        port: vitePort,
      },
    },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

app.listen(port, () => {
  console.log(`[api-dz] http://127.0.0.1:${port}`)
  console.log(`[api-dz] sub2api ${sub2apiBaseURL}`)
})

function normalizeBaseURL(value) {
  return String(value || '').replace(/\/+$/, '')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizePaymentType(value) {
  const method = String(value || '').trim()
  return ['alipay', 'wxpay'].includes(method) ? method : ''
}

function resolveRequestOrigin(req) {
  const origin = normalizeOrigin(req.get('origin'))
  if (origin) return origin

  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim()
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim()
  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return normalizeOrigin(`${proto}://${forwardedHost}`) || publicOrigin
  }

  const host = req.get('host')
  if (host) {
    const proto = req.secure ? 'https' : 'http'
    return normalizeOrigin(`${proto}://${host}`) || publicOrigin
  }

  return publicOrigin
}

function normalizeOrigin(value) {
  if (!value) return ''
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.origin.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function ok(data) {
  return { code: 0, message: 'ok', data }
}

function badRequest(message, reason = 'BAD_REQUEST', metadata = undefined) {
  const error = new Error(message)
  error.status = 400
  error.reason = reason
  error.metadata = metadata
  return error
}

function requireAdminConfig() {
  if (!adminEmail || !adminPassword) {
    throw badRequest('服务端还没有配置管理员账号，无法使用免验证创建和清理账号。', 'ADMIN_NOT_CONFIGURED')
  }
}

async function sub2api(pathname, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${sub2apiBaseURL}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  const failed = !response.ok || (payload && payload.code !== 0)
  if (failed) {
    const error = new Error(payload?.message || `后端请求失败 (${response.status})`)
    error.status = response.status || 500
    error.reason = payload?.reason
    error.details = payload
    throw error
  }
  return payload?.data
}

async function loginUser(email, password) {
  const data = await sub2api('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  if (data?.requires_2fa) {
    throw badRequest('该账号开启了二次验证，当前购买页无法直接登录，请先在后台处理。', 'TWO_FACTOR_REQUIRED')
  }
  if (!data?.access_token) {
    throw badRequest('登录失败，后端没有返回访问令牌。', 'LOGIN_FAILED')
  }
  return data
}

async function withAdmin(fn) {
  const token = await getAdminToken()
  try {
    return await fn(token)
  } catch (error) {
    if (error.status !== 401 && error.reason !== 'UNAUTHORIZED') throw error
    adminSession = null
    return fn(await getAdminToken())
  }
}

async function getAdminToken() {
  requireAdminConfig()
  const now = Date.now()
  if (adminSession?.access_token && adminSession.expires_at > now + 60_000) {
    return adminSession.access_token
  }
  const auth = await loginUser(adminEmail, adminPassword)
  adminSession = {
    access_token: auth.access_token,
    expires_at: now + Number(auth.expires_in || 1800) * 1000,
  }
  return adminSession.access_token
}

async function findUserByEmail(email) {
  return withAdmin(async (token) => {
    const page = await sub2api(`/admin/users?page=1&page_size=10&search=${encodeURIComponent(email)}`, {
      method: 'GET',
      token,
    })
    const items = page?.items || page?.data || []
    return items.find((user) => normalizeEmail(user.email) === email) || null
  })
}

async function createAdminUser(token, email, password) {
  return sub2api('/admin/users', {
    method: 'POST',
    token,
    body: {
      email,
      password,
      username: email.split('@')[0],
      notes: 'api-dz checkout auto-created',
      balance: 0,
      concurrency: 0,
      allowed_groups: [],
    },
  })
}

async function buildCreateOrderPayload(input) {
  const base = {
    payment_type: input.paymentType,
    order_type: input.orderType,
    return_url: input.returnUrl,
    payment_source: 'api-dz-server',
    is_mobile: input.isMobile,
  }

  if (input.orderType === 'balance') {
    if (!input.amount || input.amount <= 0) throw badRequest('请输入有效充值金额。', 'INVALID_AMOUNT')
    return {
      ...base,
      amount: Number(input.amount),
    }
  }

  const planId = Number(input.productId.replace(/^plan-/, ''))
  const groupId = Number(input.productId.replace(/^group-/, ''))
  if (!planId && !groupId) throw badRequest('请选择有效套餐。', 'INVALID_PLAN')
  const plan = planId ? await getPaymentPlan(planId) : await ensurePlanForGroup(groupId)
  return {
    ...base,
    amount: Number(plan.price),
    plan_id: plan.id,
  }
}

async function getPlans() {
  const checkoutInfo = await sub2api('/payment/checkout-info', { method: 'GET' }).catch(() => null)
  if (Array.isArray(checkoutInfo?.plans) && checkoutInfo.plans.length) {
    return mergePlans(normalizePlans(checkoutInfo.plans), await getGroupPlans())
  }
  const raw = await withAdmin((token) => sub2api('/admin/payment/plans', { method: 'GET', token }))
  return mergePlans(normalizePlans(raw), await getGroupPlans(raw))
}

async function getPaymentPlan(planId) {
  const raw = await withAdmin((token) => sub2api('/admin/payment/plans', { method: 'GET', token }))
  const plan = (Array.isArray(raw) ? raw : []).find((item) => Number(item.id) === Number(planId) && item.for_sale !== false)
  if (!plan) throw badRequest('后台套餐不存在或已下架。', 'PLAN_NOT_AVAILABLE')
  const group = await findGroupById(plan.group_id).catch(() => null)
  if (group && isSellableSubscriptionGroup(group)) {
    return {
      ...plan,
      price: resolveGroupPlanPrice(group),
      validity_days: resolveGroupValidityDays(group) || Number(plan.validity_days || 0),
      validity_unit: 'day',
    }
  }
  return plan
}

async function findGroupById(groupId) {
  if (!groupId) return null
  return withAdmin(async (token) => {
    const groups = await sub2api('/admin/groups/all', { method: 'GET', token })
    return (Array.isArray(groups) ? groups : []).find((item) => Number(item.id) === Number(groupId)) || null
  })
}

async function getGroupPlans(existingPlans = null) {
  if (!syncGroupSubscriptions) return []
  const [groups, plans] = await Promise.all([
    withAdmin((token) => sub2api('/admin/groups/all', { method: 'GET', token })).catch(() => []),
    existingPlans ? Promise.resolve(existingPlans) : withAdmin((token) => sub2api('/admin/payment/plans', { method: 'GET', token })).catch(() => []),
  ])
  return normalizeSubscriptionGroups(groups, plans)
}

async function ensurePlanForGroup(groupId) {
  if (!syncGroupSubscriptions || !groupId) throw badRequest('请选择有效套餐。', 'INVALID_PLAN')
  return withAdmin(async (token) => {
    const [groups, plans] = await Promise.all([
      sub2api('/admin/groups/all', { method: 'GET', token }),
      sub2api('/admin/payment/plans', { method: 'GET', token }),
    ])
    const group = (Array.isArray(groups) ? groups : []).find((item) => Number(item.id) === Number(groupId))
    if (!isSellableSubscriptionGroup(group)) throw badRequest('订阅分组不存在或未启用。', 'PLAN_NOT_AVAILABLE')

    const price = resolveGroupPlanPrice(group)
    const validityDays = resolveGroupValidityDays(group)
    const existing = findPlanForGroup(plans, group)
    if (existing) {
      return {
        ...existing,
        price,
        validity_days: validityDays || Number(existing.validity_days || 0),
        validity_unit: 'day',
      }
    }

    return sub2api('/admin/payment/plans', {
      method: 'POST',
      token,
      body: {
        group_id: Number(group.id),
        name: group.name,
        description: group.description || buildGroupSubtitle(group),
        price,
        validity_days: validityDays,
        validity_unit: 'day',
        features: buildGroupFeatureLines(group).join('\n'),
        product_name: group.name,
        for_sale: true,
        sort_order: Number(group.sort_order || 0),
      },
    })
  })
}

function normalizePlans(plans) {
  return (Array.isArray(plans) ? plans : [])
    .filter((plan) => plan && plan.for_sale !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.price || 0) - Number(b.price || 0))
    .map((plan) => {
      const features = normalizePlanFeatures(plan.features)
      return {
        id: Number(plan.id),
        product_id: `plan-${plan.id}`,
        kind: 'subscription',
        title: plan.name || plan.product_name || `${plan.validity_days || ''}天套餐`,
        subtitle: plan.description || buildPlanSubtitle(plan),
        description: plan.description || buildPlanSubtitle(plan),
        price: Number(plan.price || 0),
        price_label: `¥${Number(plan.price || 0).toFixed(2)} / ${formatValidity(plan)}`,
        group_id: Number(plan.group_id || 0),
        group_name: plan.group_name || '',
        group_platform: plan.group_platform || '',
        validity_days: Number(plan.validity_days || 0),
        validity_unit: plan.validity_unit || 'day',
        daily_limit_usd: plan.daily_limit_usd ?? null,
        weekly_limit_usd: plan.weekly_limit_usd ?? null,
        monthly_limit_usd: plan.monthly_limit_usd ?? null,
        supported_model_scopes: plan.supported_model_scopes || [],
        features: features.length ? features : buildFeaturePairs(plan),
        popular: Number(plan.group_id || 0) === 4 || Number(plan.id || 0) === 4,
      }
    })
}

function mergePlans(paymentPlans, groupPlans) {
  const merged = []
  const seenGroups = new Set()
  for (const plan of groupPlans || []) {
    if (plan.group_id) seenGroups.add(Number(plan.group_id))
    merged.push(plan)
  }
  for (const plan of paymentPlans || []) {
    if (plan.group_id && seenGroups.has(Number(plan.group_id))) continue
    merged.push(plan)
  }
  return merged.sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
}

function normalizeSubscriptionGroups(groups, existingPlans = []) {
  const plans = Array.isArray(existingPlans) ? existingPlans : []
  return (Array.isArray(groups) ? groups : [])
    .filter(isSellableSubscriptionGroup)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0))
    .map((group) => {
      const existing = findPlanForGroup(plans, group)
      const price = resolveGroupPlanPrice(group)
      const validityDays = Number(existing?.validity_days || resolveGroupValidityDays(group))
      return {
        id: Number(existing?.id || group.id),
        product_id: existing?.id ? `plan-${existing.id}` : `group-${group.id}`,
        kind: 'subscription',
        title: formatDurationTitle(validityDays),
        subtitle: group.daily_limit_usd ? `日 ${Number(group.daily_limit_usd).toFixed(0)} 美元额度` : buildGroupSubtitle(group),
        description: group.description || buildGroupSubtitle(group),
        price,
        price_label: `¥${price.toFixed(2)} / ${formatDays(validityDays)}`,
        group_id: Number(group.id),
        group_name: group.name,
        group_platform: group.platform || '',
        validity_days: validityDays,
        validity_unit: 'day',
        daily_limit_usd: group.daily_limit_usd ?? null,
        weekly_limit_usd: group.weekly_limit_usd ?? null,
        monthly_limit_usd: group.monthly_limit_usd ?? null,
        supported_model_scopes: group.supported_model_scopes || [],
        features: buildGroupFeaturePairs(group, validityDays),
        popular: Number(group.id || 0) === 5,
      }
    })
}

function isSellableSubscriptionGroup(group) {
  return group
    && group.status !== 'inactive'
    && group.subscription_type === 'subscription'
    && Number(group.id || 0) > 0
}

function findPlanForGroup(plans, group) {
  return (Array.isArray(plans) ? plans : []).find((plan) => {
    if (!plan || plan.for_sale === false) return false
    if (Number(plan.group_id) !== Number(group.id)) return false
    return String(plan.product_name || '').startsWith('api-dz:auto:')
      || String(plan.name || '') === String(group.name || '')
      || String(plan.product_name || '') === String(group.name || '')
  }) || null
}

function resolveGroupValidityDays(group) {
  const configured = Number(group.default_validity_days || 0)
  if (configured > 0) return configured
  const text = `${group.name || ''} ${group.description || ''}`
  const dayMatch = text.match(/(\d+)\s*天/)
  if (dayMatch) return Number(dayMatch[1])
  const monthMatch = text.match(/(\d+)\s*(?:个月|月)/)
  if (monthMatch) return Number(monthMatch[1]) * 30
  return 30
}

function resolveGroupPlanPrice(group) {
  const override = groupPlanPriceOverrides.get(String(group.id))
  if (override && override > 0) return roundMoney(override)
  const defaultPrice = defaultGroupPlanPrices.get(String(group.id))
  if (defaultPrice && defaultPrice > 0) return roundMoney(defaultPrice)
  const namedPrice = extractNamedPrice(group)
  if (namedPrice > 0) return roundMoney(namedPrice)
  const limit = Number(group.monthly_limit_usd || group.weekly_limit_usd || group.daily_limit_usd || 0)
  const normalizedLimit = Number(group.monthly_limit_usd ? limit : group.weekly_limit_usd ? limit * 4 : limit * 30)
  const price = normalizedLimit > 0 ? normalizedLimit * groupPlanPriceMultiplier : groupPlanPriceMin
  return roundMoney(Math.max(groupPlanPriceMin, price))
}

function extractNamedPrice(group) {
  const text = `${group.name || ''} ${group.description || ''}`
  const matches = [
    text.match(/\d+\s*天\s*(\d+(?:\.\d+)?)\s*(?:美刀|美元|刀|usd|USD)/),
    text.match(/(\d+(?:\.\d+)?)\s*(?:美刀|美元|刀|usd|USD)\s*额度/),
  ]
  for (const match of matches) {
    const value = Number(match?.[1] || 0)
    if (value > 0) return value
  }
  return 0
}

function buildGroupSubtitle(group) {
  const parts = []
  if (group.daily_limit_usd) parts.push(`日额度 $${Number(group.daily_limit_usd).toFixed(0)}`)
  if (group.weekly_limit_usd) parts.push(`周额度 $${Number(group.weekly_limit_usd).toFixed(0)}`)
  if (group.monthly_limit_usd) parts.push(`月额度 $${Number(group.monthly_limit_usd).toFixed(0)}`)
  return parts.join(' / ') || `${platformName(group.platform)} 订阅分组`
}

function buildGroupFeaturePairs(group, validityDays = resolveGroupValidityDays(group)) {
  const features = [
    ['分类', platformName(group.platform)],
    ['有效期', formatDays(validityDays)],
  ]
  if (group.daily_limit_usd) features.push(['日额度', `$${Number(group.daily_limit_usd).toFixed(0)}`])
  if (group.weekly_limit_usd) features.push(['周额度', `$${Number(group.weekly_limit_usd).toFixed(0)}`])
  if (group.monthly_limit_usd) features.push(['月额度', `$${Number(group.monthly_limit_usd).toFixed(0)}`])
  if (group.rate_multiplier && Number(group.rate_multiplier) !== 1) features.push(['费率倍数', `${Number(group.rate_multiplier).toFixed(2)}x`])
  return features
}

function buildGroupFeatureLines(group) {
  return buildGroupFeaturePairs(group).map(([label, value]) => `${label}: ${value}`)
}

function normalizePlanFeatures(features) {
  if (Array.isArray(features)) {
    return features
      .map((feature) => Array.isArray(feature) ? feature : splitFeatureLine(feature))
      .filter((feature) => feature[1])
  }
  return String(features || '')
    .split(/\r?\n/)
    .map((feature) => feature.trim())
    .filter(Boolean)
    .map(splitFeatureLine)
}

function buildPlanSubtitle(plan) {
  const limits = []
  if (plan.daily_limit_usd) limits.push(`日额度 $${Number(plan.daily_limit_usd).toFixed(0)}`)
  if (plan.weekly_limit_usd) limits.push(`周额度 $${Number(plan.weekly_limit_usd).toFixed(0)}`)
  if (plan.monthly_limit_usd) limits.push(`月额度 $${Number(plan.monthly_limit_usd).toFixed(0)}`)
  return limits.join(' / ') || '订阅分组套餐'
}

function buildFeaturePairs(plan) {
  const features = [
    ['适用分组', plan.group_name || plan.group_platform || '订阅分组'],
    ['有效期', formatValidity(plan)],
  ]
  if (plan.daily_limit_usd) features.push(['每日额度', `$${Number(plan.daily_limit_usd).toFixed(2)}`])
  if (plan.weekly_limit_usd) features.push(['每周额度', `$${Number(plan.weekly_limit_usd).toFixed(2)}`])
  if (plan.monthly_limit_usd) features.push(['每月额度', `$${Number(plan.monthly_limit_usd).toFixed(2)}`])
  return features
}

function formatValidity(plan) {
  const days = Number(plan.validity_days || 0)
  return formatDays(days) || '套餐周期'
}

function formatDays(days) {
  const count = Number(days || 0)
  if (count >= 30 && count % 30 === 0) return `${count / 30}个月`
  if (count > 0) return `${count}天`
  return '套餐周期'
}

function formatDurationTitle(days) {
  const count = Number(days || 0)
  if (count > 0) return `${count}天`
  return '套餐'
}

function visiblePaymentMethods(methods) {
  return ['alipay', 'wxpay']
    .filter((method) => methods?.[method]?.available !== false)
    .map((method) => ({
      id: method,
      label: method === 'alipay' ? '支付宝' : '微信支付',
      limit: methods?.[method] || null,
    }))
}

function splitFeatureLine(feature) {
  const text = String(feature || '').trim()
  const index = text.search(/[:：]/)
  if (index > 0) {
    return [text.slice(0, index).trim(), text.slice(index + 1).trim()]
  }
  return ['套餐权益', text]
}

function platformName(platform) {
  const names = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini',
    antigravity: 'Antigravity',
  }
  return names[String(platform || '').toLowerCase()] || 'AI'
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function parsePriceOverrides(value) {
  const map = new Map()
  for (const item of String(value || '').split(',')) {
    const [key, rawPrice] = item.split('=')
    const price = Number(rawPrice)
    if (key && price > 0) map.set(key.trim(), price)
  }
  return map
}

function requireCheckout(id) {
  const state = checkoutStore.get(id)
  if (!state) throw badRequest('订单会话不存在或已过期，请重新下单。', 'CHECKOUT_NOT_FOUND')
  return state
}

function publicCheckoutState(state) {
  return {
    checkout_id: state.id,
    credential: state.credential,
    order: state.order,
    status: state.status,
    created_by_checkout: state.created_by_checkout,
  }
}

function scheduleOrderWatcher(state) {
  clearTimers(state)
  state.poll_timer = setInterval(() => {
    refreshCheckoutState(state).catch((error) => {
      console.warn('[api-dz] order watcher failed:', error.message)
    })
  }, orderPollIntervalMs)
}

async function refreshCheckoutState(state) {
  if (!state?.order?.out_trade_no) return state
  if (['COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(state.status)) return state

  const order = await sub2api('/payment/public/orders/verify', {
    method: 'POST',
    body: { out_trade_no: state.order.out_trade_no },
  })
  state.order = {
    ...state.order,
    ...order,
    order_id: state.order.order_id || order.id,
  }
  state.status = order.status || state.status

  if (state.status === 'COMPLETED') {
    clearTimers(state)
  } else if (['CANCELLED', 'FAILED', 'EXPIRED'].includes(state.status)) {
    clearTimers(state)
    await cleanupGeneratedUserIfNeeded(state)
  } else if (new Date(state.order.expires_at).getTime() < Date.now()) {
    await cancelCheckoutState(state, 'EXPIRED')
  }
  return state
}

async function cancelCheckoutState(state, status = 'CANCELLED') {
  if (!state || ['COMPLETED', 'PAID', 'RECHARGING'].includes(state.status)) return state

  await cancelBackendOrderIfPossible(state)

  state.status = status
  state.order = {
    ...state.order,
    status,
  }
  clearTimers(state)
  await cleanupGeneratedUserIfNeeded(state, { immediate: true })
  return state
}

async function cancelBackendOrderIfPossible(state) {
  const orderId = state?.order?.order_id || state?.order?.id
  if (!orderId || !state.user_token) return null

  return sub2api(`/payment/orders/${orderId}/cancel`, {
    method: 'POST',
    token: state.user_token,
  }).catch((error) => {
    const reason = error?.details?.reason || error?.reason
    const message = String(error?.message || '')
    if (
      reason === 'ORDER_NOT_CANCELLABLE'
      || reason === 'ORDER_NOT_FOUND'
      || reason === 'SERVER_ERROR'
      || message.includes('fetch failed')
    ) {
      console.warn('[api-dz] backend order cancel skipped:', message || reason)
      return null
    }
    throw error
  })
}

async function cleanupGeneratedUserIfNeeded(state, options = {}) {
  if (!state.created_by_checkout || !state.user_id || state.cleaned_up) return
  const status = state.status || state.order?.status
  if (status === 'COMPLETED' || status === 'PAID' || status === 'RECHARGING') return

  const cleanup = async () => {
    try {
      const latestStatus = state.status || state.order?.status
      if (latestStatus === 'COMPLETED' || latestStatus === 'PAID' || latestStatus === 'RECHARGING') return
      await withAdmin((token) => sub2api(`/admin/users/${state.user_id}`, { method: 'DELETE', token }))
      state.cleaned_up = true
      state.credential = state.credential ? { ...state.credential, password: '' } : state.credential
    } catch (error) {
      console.warn('[api-dz] cleanup generated user failed:', error.message)
    }
  }

  if (options.immediate) {
    if (state.cleanup_timer) {
      clearTimeout(state.cleanup_timer)
      state.cleanup_timer = null
    }
    await cleanup()
    return
  }

  if (state.cleanup_timer) return
  state.cleanup_timer = setTimeout(cleanup, Math.max(0, cleanupDelayMs))
}

function clearTimers(state) {
  if (state.poll_timer) {
    clearInterval(state.poll_timer)
    state.poll_timer = null
  }
  if (state.cleanup_timer) {
    clearTimeout(state.cleanup_timer)
    state.cleanup_timer = null
  }
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(14)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function sendError(res, error) {
  const status = Number(error?.status || 500)
  const reason = error?.reason || error?.details?.reason || 'SERVER_ERROR'
  const message = error?.message || '服务器错误'
  res.status(status >= 400 && status < 600 ? status : 500).json({
    code: status >= 500 ? 500 : status,
    message,
    reason,
    metadata: error?.metadata || error?.details?.metadata,
  })
}
