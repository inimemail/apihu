import type { CatalogResponse, PaymentMethod, Product } from './types'
import modelCatalog from './data/model-catalog.json'

export const fallbackPaymentMethods: PaymentMethod[] = [
  { id: 'alipay', label: '支付宝', limit: null },
  { id: 'wxpay', label: '微信支付', limit: null },
]

export const fallbackCatalog: CatalogResponse = {
  balance: {
    id: 'balance',
    kind: 'balance',
    title: '余额充值',
    subtitle: '余额通用于已开通的平台与模型，按量扣费，用多少扣多少。',
    description: '充值后创建 API Key 即可调用已开通模型；余额长期有效，适合按需调用。',
    min_amount: 1,
    max_amount: 0,
    default_amount: 20,
    multiplier: 1,
    disabled: false,
    features: [
      ['适用平台', '全平台模型通用'],
      ['计费方式', '按量扣费'],
      ['有效期', '长期有效'],
    ],
  },
  methods: fallbackPaymentMethods,
  plans: [],
  models: modelCatalog.platforms,
  help_text: '',
  help_image_url: '',
}

const QUICK_RECHARGE_AMOUNTS = [10, 30, 50, 100, 200]

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
    models: Array.isArray(catalog?.models) && catalog.models.length
      ? catalog.models
      : fallbackCatalog.models,
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
    priceLabel: '自定义金额',
    amount: normalized.balance.default_amount || 20,
    isCustom: true,
    features: normalized.balance.features,
  }

  const multiplier = Number(normalized.balance.multiplier || 1) > 0
    ? Number(normalized.balance.multiplier)
    : 1
  const quickProducts = QUICK_RECHARGE_AMOUNTS.map((amount, index) => {
    const credited = roundMoney(amount * multiplier)
    return {
      id: `quick-balance-${amount}`,
      kind: 'balance',
      platform: 'balance',
      title: `¥${amount} 充值`,
      subtitle: `到账 ${formatUsd(credited)}`,
      description: '全平台模型通用，余额长期有效。',
      priceLabel: `¥${amount}`,
      amount,
      popular: index === 3,
      features: [
        ['充值金额', `¥${amount.toFixed(2)}`],
        ['到账额度', formatUsd(credited)],
        ['适用范围', '全平台模型'],
        ['有效期', '长期有效'],
      ],
    } satisfies Product
  })

  return [balance, ...quickProducts]
}

function formatUsd(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`
}

function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100
}
