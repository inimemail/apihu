import type { CatalogResponse, PaymentMethod, Product } from './types'

export const fallbackPaymentMethods: PaymentMethod[] = [
  { id: 'alipay', label: '支付宝', limit: null },
  { id: 'wxpay', label: '微信支付', limit: null },
]

export const fallbackCatalog: CatalogResponse = {
  balance: {
    id: 'balance',
    kind: 'balance',
    title: '余额充值',
    subtitle: '余额通用于 OpenAI 与 Claude 额度计费模型，按量扣费，用多少扣多少。',
    description: '充值后在后台创建 API Key 并绑定对应额度计费分组即可使用；余额长期有效，适合按需调用。',
    min_amount: 1,
    max_amount: 0,
    default_amount: 20,
    multiplier: 1,
    disabled: false,
    features: [
      ['适用分类', 'OpenAI / Claude'],
      ['支持场景', 'GPT / Codex / Claude'],
      ['计费方式', '按量扣费'],
      ['有效期', '长期有效'],
    ],
  },
  methods: fallbackPaymentMethods,
  plans: [],
  help_text: '',
  help_image_url: '',
}

export function normalizeCatalog(catalog: CatalogResponse | null | undefined): CatalogResponse {
  const methods = Array.isArray(catalog?.methods) && catalog.methods.length
    ? catalog.methods.filter((method) => method?.id === 'alipay' || method?.id === 'wxpay')
    : fallbackPaymentMethods

  return {
    ...fallbackCatalog,
    ...catalog,
    balance: {
      ...fallbackCatalog.balance,
      ...(catalog?.balance || {}),
      features: Array.isArray(catalog?.balance?.features) && catalog.balance.features.length
        ? catalog.balance.features
        : fallbackCatalog.balance.features,
    },
    methods: methods.length ? methods : fallbackPaymentMethods,
    plans: Array.isArray(catalog?.plans) ? catalog.plans : [],
  }
}

export function catalogToProducts(catalog: CatalogResponse | null): Product[] {
  const normalized = normalizeCatalog(catalog)

  const balance: Product = {
    id: normalized.balance.id,
    kind: 'balance',
    platform: 'balance',
    title: normalized.balance.title,
    subtitle: normalized.balance.subtitle,
    description: normalized.balance.description,
    priceLabel: '余额 / 按需充值',
    amount: normalized.balance.default_amount || 20,
    features: normalized.balance.features,
  }

  const plans: Product[] = normalized.plans
    .map((plan) => {
      const validity = formatValidityDays(plan.validity_days)
      const dailyLimit = Number(plan.daily_limit_usd || 0)
      const weeklyLimit = Number(plan.weekly_limit_usd || 0)
      const monthlyLimit = Number(plan.monthly_limit_usd || 0)
      const displayPrice = resolveDisplayPrice(plan)

      return {
        id: plan.group_id ? `group-${plan.group_id}` : plan.product_id,
        kind: 'subscription',
        platform: normalizeProductPlatform(plan.group_platform),
        title: validity,
        subtitle: dailyLimit > 0 ? `日 ${formatUsd(dailyLimit)}额度` : plan.subtitle,
        description: plan.description,
        priceLabel: `¥${displayPrice.toFixed(2)} / ${validity === '30天' ? '1个月' : validity}`,
        amount: displayPrice,
        planId: plan.id,
        popular: Number(plan.group_id || 0) === 5,
        features: [
          ['支持平台', 'OpenAI'],
          ...(dailyLimit > 0 ? [['每日限制', `${dailyLimit.toFixed(2)} 美元`] as [string, string]] : []),
          ...(weeklyLimit > 0 ? [['每周限制', `${weeklyLimit.toFixed(2)} 美元`] as [string, string]] : []),
          ...(monthlyLimit > 0 ? [['每月限制', `${monthlyLimit.toFixed(2)} 美元`] as [string, string]] : []),
        ],
      } satisfies Product
    })
    .sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0))

  return [balance, ...plans]
}

export const modelGroups = {
  openai: [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.2',
    'gpt-image-1',
    'gpt-image-1.5',
    'gpt-image-2',
  ],
  claude: [
    'claude-haiku-4-5-20251001',
    'claude-opus-4-6',
    'claude-opus-4-7',
    'claude-sonnet-4-6',
  ],
}

function normalizeProductPlatform(platform: string): Product['platform'] {
  const value = String(platform || '').toLowerCase()
  if (value === 'anthropic' || value === 'claude') return 'claude'
  return 'openai'
}

function resolveDisplayPrice(plan: { group_id?: number; daily_limit_usd?: number | null; price?: number }): number {
  const byGroup = new Map([
    [2, 6.99],
    [3, 39.99],
    [4, 119.99],
    [5, 169.99],
    [6, 239.99],
  ])
  const groupPrice = byGroup.get(Number(plan.group_id || 0))
  if (groupPrice) return groupPrice

  const dailyLimit = Number(plan.daily_limit_usd || 0)
  if (dailyLimit === 20) return 6.99
  if (dailyLimit === 25) return 39.99
  if (dailyLimit === 30) return 119.99
  if (dailyLimit === 50) return 169.99
  if (dailyLimit === 80) return 239.99
  return Number(plan.price || 0)
}

function formatValidityDays(days: number): string {
  const count = Number(days || 0)
  if (count > 0) return `${count}天`
  return '订阅'
}

function formatUsd(value: number): string {
  return `${Number(value || 0).toFixed(0)} 美元`
}
