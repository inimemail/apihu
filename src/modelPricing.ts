import type { ModelPriceGroup, ModelPricingItem } from './types'

export function formatModelPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '—'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}

export function modelPriceGroups(model: ModelPricingItem): ModelPriceGroup[] {
  if (model.price_groups?.length) return model.price_groups
  const rows = [
    { key: 'input', label: '输入', price: model.input_price ?? null },
    { key: 'output', label: '输出', price: model.output_price ?? null },
  ]
  if (model.cache_read_price !== null && model.cache_read_price !== undefined) rows.splice(1, 0, { key: 'cache_read', label: '缓存读取', price: model.cache_read_price })
  if (model.cache_write_price !== null && model.cache_write_price !== undefined) rows.splice(rows.length - 1, 0, { key: 'cache_write', label: model.cache_write_1h_price != null ? '缓存写入 · 5m' : '缓存写入', price: model.cache_write_price })
  if (model.cache_write_1h_price !== null && model.cache_write_1h_price !== undefined) rows.splice(rows.length - 1, 0, { key: 'cache_write_1h', label: '缓存写入 · 1h', price: model.cache_write_1h_price })
  return [{ label: '', unit: 'USD / 1M tokens', rows }]
}
