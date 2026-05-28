function envValue(key: string, fallback: string): string {
  return String(import.meta.env[key] || fallback)
}

export const siteConfig = {
  brandName: envValue('VITE_BRAND_NAME', 'TokenBa'),
  brandIcon: envValue('VITE_BRAND_ICON', '⚡'),
  siteTitle: envValue('VITE_SITE_TITLE', 'TokenBa 购买'),
  gatewayBaseUrl: envValue('VITE_GATEWAY_BASE_URL', 'https://cn.tokenba.com'),
  gatewayApiUrl: envValue('VITE_GATEWAY_API_URL', 'https://cn.tokenba.com/v1'),
  dashboardUrl: envValue('VITE_DASHBOARD_URL', 'https://tokenba.com/dashboard'),
  chatName: envValue('VITE_CHAT_NAME', 'TokenBa Chat'),
  chatUrl: envValue('VITE_CHAT_URL', 'https://chat.tokenba.com'),
  chatPcImageUrl: envValue('VITE_CHAT_PC_IMAGE_URL', 'https://img.inim.im/file/1779953515956_image.png'),
  chatMobileImageUrl: envValue('VITE_CHAT_MOBILE_IMAGE_URL', 'https://img.inim.im/file/1779953964075_image.png'),
  ccSwitchDownloadUrl: envValue('VITE_CC_SWITCH_DOWNLOAD_URL', 'https://github.com/farion1231/cc-switch/releases/latest'),
}

export const chatHost = (() => {
  try {
    return new URL(siteConfig.chatUrl).host
  } catch {
    return siteConfig.chatUrl
  }
})()
