import type { ModelPriceGroup, ModelPricingItem } from './types'

export function formatModelPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '—'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}

export function modelPriceGroups(model: ModelPricingItem): ModelPriceGroup[] {
  const primaryGroups = model.price_groups?.filter((group) => group.label.trim() !== '其他计价项')
  if (primaryGroups?.length) return primaryGroups.map((group) => ({ ...group, rows: orderPriceRows(group.rows) }))
  const rows = [
    { key: 'input', label: '输入', price: model.input_price ?? null },
    { key: 'output', label: '输出', price: model.output_price ?? null },
  ]
  if (model.cache_read_price !== null && model.cache_read_price !== undefined) rows.splice(1, 0, { key: 'cache_read', label: '缓存读取', price: model.cache_read_price })
  if (model.cache_write_price !== null && model.cache_write_price !== undefined) rows.splice(rows.length - 1, 0, { key: 'cache_write', label: model.cache_write_1h_price != null ? '缓存写入 · 5m' : '缓存写入', price: model.cache_write_price })
  if (model.cache_write_1h_price !== null && model.cache_write_1h_price !== undefined) rows.splice(rows.length - 1, 0, { key: 'cache_write_1h', label: '缓存写入 · 1h', price: model.cache_write_1h_price })
  return [{ label: '', unit: 'USD / 1M tokens', rows: orderPriceRows(rows) }]
}

function orderPriceRows(rows: ModelPriceGroup['rows']): ModelPriceGroup['rows'] {
  const order: Record<string, number> = { input: 0, input_price: 0, output: 1, output_price: 1, cache_read: 2, cache_read_price: 2, cache_write: 3, cache_write_price: 3, cache_write_1h: 4, cache_write_1h_price: 4 }
  return [...rows].sort((a, b) => (order[a.key] ?? 5) - (order[b.key] ?? 5))
}
