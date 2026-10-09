import type {
  ApiEnvelope,
  CatalogResponse,
  CheckoutOrderState,
  CreateCheckoutOrderRequest,
  CreateCheckoutOrderResponse,
  ModelPricingPlatform,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_CHECKOUT_API_BASE_URL || '/api/checkout').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  reason?: string
  metadata?: Record<string, string>

  constructor(message: string, status: number, reason?: string, metadata?: Record<string, string>) {
    super(message)
    this.status = status
    this.reason = reason
    this.metadata = metadata
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Accept-Language', 'zh-CN')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  let payload: ApiEnvelope<T> | null = null
  let parsedJson = true
  try {
    payload = await response.json()
  } catch {
    parsedJson = false
  }

  if (!parsedJson) {
    throw new ApiError(
      '接口没有返回 JSON。请用 npm run dev 启动本项目，不要只开 vite 纯前端服务。',
      response.status || 502,
      'INVALID_API_RESPONSE',
    )
  }

  if (!response.ok || (payload && payload.code !== 0)) {
    throw new ApiError(
      payload?.message || `请求失败 (${response.status})`,
      response.status,
      payload?.reason,
      payload?.metadata,
    )
  }

  if (!payload || payload.data === undefined || payload.data === null) {
    throw new ApiError('接口返回数据为空。', response.status || 502, 'EMPTY_API_RESPONSE')
  }

  return payload.data as T
}

export function getCatalog(): Promise<CatalogResponse> {
  return request<CatalogResponse>('/catalog')
}

export function getModelCatalog(): Promise<{ models: ModelPricingPlatform[] }> {
  return request('/models')
}

export function createCheckoutOrder(input: CreateCheckoutOrderRequest): Promise<CreateCheckoutOrderResponse> {
  return request<CreateCheckoutOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getCheckoutOrder(checkoutId: string): Promise<CheckoutOrderState> {
  return request<CheckoutOrderState>(`/orders/${encodeURIComponent(checkoutId)}`)
}

export function checkCheckoutOrder(checkoutId: string): Promise<CheckoutOrderState> {
  return request<CheckoutOrderState>(`/orders/${encodeURIComponent(checkoutId)}/check`, {
    method: 'POST',
  })
}

export function cancelCheckoutOrder(checkoutId: string): Promise<CheckoutOrderState> {
  return request<CheckoutOrderState>(`/orders/${encodeURIComponent(checkoutId)}/cancel`, {
    method: 'POST',
  })
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.reason) {
      case 'PASSWORD_REQUIRED':
        return '这个邮箱已经注册过，请输入该账号密码后继续购买。'
      case 'ADMIN_NOT_CONFIGURED':
        return '服务端还没有配置管理员账号，暂时无法自动创建新账号。'
      case 'TWO_FACTOR_REQUIRED':
        return '该账号开启了二次验证，购买页无法直接登录。'
      case 'INVALID_PLAN':
      case 'PLAN_NOT_AVAILABLE':
        return '套餐不存在或已下架，请刷新页面后重试。'
      case 'PAYMENT_GATEWAY_ERROR':
        return '支付网关创建订单失败，请检查后台支付渠道配置。'
      case 'TOO_MANY_PENDING':
        return '这个账号有太多待支付订单，请稍后再试。'
      case 'INVALID_API_RESPONSE':
      case 'EMPTY_API_RESPONSE':
        return err.message
      default:
        return err.message || '请求失败'
    }
  }
  return err instanceof Error ? err.message : '请求失败'
}
