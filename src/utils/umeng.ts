import { NativeModules, Platform } from 'react-native'

/** 友盟移动统计原生桥（仅 Android）；未授权前所有上报在原生侧被忽略 */
interface UmengNative {
  grantPrivacy: () => Promise<boolean>
  isPrivacyGranted: () => Promise<boolean>
  onPageStart: (pageName: string) => void
  onPageEnd: (pageName: string) => void
  onEvent: (eventId: string, attributes: Record<string, string | number | boolean>) => void
}

const umeng: UmengNative | null = Platform.OS == 'android'
  ? (NativeModules.UmengAnalytics as UmengNative | undefined) ?? null
  : null

/** 用户同意协议后调用；原生侧幂等，重复调用不会重复初始化 */
export const grantUmengPrivacy = async() => {
  try {
    await umeng?.grantPrivacy()
  } catch (err) {
    console.warn('[umeng] grantPrivacy failed', err)
  }
}

export const isUmengPrivacyGranted = async() => {
  try {
    return (await umeng?.isPrivacyGranted()) ?? false
  } catch {
    return false
  }
}

export const trackPageStart = (pageName: string) => {
  try { umeng?.onPageStart(pageName) } catch { /* ignore */ }
}

export const trackPageEnd = (pageName: string) => {
  try { umeng?.onPageEnd(pageName) } catch { /* ignore */ }
}

export const trackEvent = (eventId: string, attributes: Record<string, string | number | boolean> = {}) => {
  try { umeng?.onEvent(eventId, attributes) } catch { /* ignore */ }
}
