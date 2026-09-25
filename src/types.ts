export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECHARGING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUNDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED'

export type OrderType = 'balance' | 'subscription'

export interface ApiEnvelope<T> {
  code: number
  message: string
  reason?: string
  metadata?: Record<string, string>
  data: T
}

export interface PaymentMethod {
  id: 'alipay' | 'wxpay'
  label: string
  limit?: MethodLimit | null
}

export interface MethodLimit {
  currency?: string
  daily_limit: number
  daily_used: number
  daily_remaining: number
  single_min: number
  single_max: number
  fee_rate: number
  available: boolean
}

export interface CatalogBalanceProduct {
  id: string
  kind: 'balance'
  title: string
  subtitle: string
  description: string
  min_amount: number
  max_amount: number
  default_amount: number
  multiplier: number
  disabled: boolean
  features: Array<[string, string]>
}

export interface CatalogPlanProduct {
  id: number
  product_id: string
  kind: 'subscription'
  title: string
  subtitle: string
  description: string
  price: number
  price_label: string
  group_id: number
  group_name: string
  group_platform: string
  validity_days: number
  validity_unit: string
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
  supported_model_scopes?: string[]
  features: Array<[string, string]>
  tier_index?: number
  popular?: boolean
}

export interface ModelPricingItem {
  id: string
  name: string
  release_date?: string
  input_price?: number | null
  cache_read_price?: number | null
  cache_write_price?: number | null
  output_price?: number | null
}

export interface ModelPricingPlatform {
  id: string
  name: string
  short_name?: string
  models: ModelPricingItem[]
}

export interface Product {
  id: string
  kind: OrderType
  platform: 'balance' | 'openai' | 'claude'
  title: string
  subtitle: string
  description?: string
  priceLabel: string
  amount?: number
  planId?: number
  popular?: boolean
  isCustom?: boolean
  features: Array<[string, string]>
}

export interface CatalogResponse {
  balance: CatalogBalanceProduct
  methods: PaymentMethod[]
  plans: CatalogPlanProduct[]
  models?: ModelPricingPlatform[]
  help_text?: string
  help_image_url?: string
}

export interface AccountCredential {
  email: string
  password?: string
  userId?: number
  isExisting?: boolean
}

export interface CreateCheckoutOrderRequest {
  email: string
  password?: string
  product_id: string
  order_type: OrderType
  amount?: number
  payment_type: 'alipay' | 'wxpay'
  is_mobile?: boolean
}

export interface CreateOrderResult {
  order_id: number
  id?: number
  amount: number
  pay_amount: number
  fee_rate: number
  status: string
  result_type?: string
  payment_type?: string
  out_trade_no?: string
  pay_url?: string
  qr_code?: string
  client_secret?: string
  intent_id?: string
  currency?: string
  country_code?: string
  payment_env?: string
  expires_at: string
  payment_mode?: string
  resume_token?: string
}

export interface PaymentOrder {
  id: number
  user_id?: number
  amount: number
  pay_amount: number
  currency?: string
  fee_rate: number
  payment_type: string
  out_trade_no: string
  status: OrderStatus
  order_type: OrderType
  created_at: string
  expires_at: string
  paid_at?: string
  completed_at?: string
  plan_id?: number
}

export interface CreateCheckoutOrderResponse {
  checkout_id: string
  credential: AccountCredential
  order: CreateOrderResult
}

export interface CheckoutOrderState {
  checkout_id: string
  credential: AccountCredential
  order: CreateOrderResult & Partial<PaymentOrder>
  status: OrderStatus | string
  created_by_checkout: boolean
}
