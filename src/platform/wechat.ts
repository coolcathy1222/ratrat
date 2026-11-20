import type { Platform, RewardSlot, ShareResult } from './types'

interface WxAd {
  show(): Promise<void>
  load(): Promise<void>
  onClose(cb: (res: { isEnded?: boolean }) => void): void
  offClose(cb: (res: { isEnded?: boolean }) => void): void
  onError(cb: () => void): void
  offError(cb: () => void): void
}

interface WxApi {
  getFileSystemManager(): {
    readFile(options: { filePath: string; success(result: { data: ArrayBuffer }): void; fail(error: unknown): void }): void
  }
  createWebAudioContext?: () => AudioContext
  createImage?: () => HTMLImageElement
  createCanvas?: () => HTMLCanvasElement
  createRewardedVideoAd?: (opts: { adUnitId: string }) => WxAd
  getStorageSync?: (key: string) => string
  setStorageSync?: (key: string, value: string) => void
  shareAppMessage?: (opts: { title: string }) => void
  vibrateShort?: (opts: { type: string }) => void
  setUserCloudStorage?: (opts: { KVDataList: Array<{ key: string; value: string }> }) => void
  getOpenDataContext?: () => {
    canvas?: HTMLCanvasElement
    postMessage: (data: unknown) => void
  }
  getSystemInfoSync?: () => { windowWidth: number; windowHeight: number; pixelRatio: number }
  onTouchStart?: (cb: (e: WxTouchEvent) => void) => void
  onTouchMove?: (cb: (e: WxTouchEvent) => void) => void
  onTouchEnd?: (cb: (e: WxTouchEvent) => void) => void
  onTouchCancel?: (cb: () => void) => void
  onShow?: (cb: () => void) => void
  onHide?: (cb: () => void) => void
}

interface WxTouchEvent {
  touches: Array<{ clientX: number; clientY: number }>
  changedTouches: Array<{ clientX: number; clientY: number }>
}

/** Fill a slot with a 流量主 rewarded-video ad unit id when one is available. */
const AD_UNITS: Partial<Record<RewardSlot, string>> = {}

function getWx(): WxApi | undefined {
  const host = globalThis as { wx?: WxApi }
  if (host.wx) return host.wx
  try {
    return Function('return typeof wx === "undefined" ? undefined : wx')() as WxApi
  } catch {
    return undefined
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasRealAds(): boolean {
  return Object.values(AD_UNITS).some((id) => !!id)
}

export function createWechatPlatform(): Platform {
  return {
    name: 'wechat',
    storageGet(key) {
      try {
        const value = getWx()?.getStorageSync?.(key)
        return value ? String(value) : null
      } catch {
        return null
      }
    },
    storageSet(key, value) {
      try {
        getWx()?.setStorageSync?.(key, value)
      } catch {
        /* storage unavailable */
      }
    },
    async showReward(slot) {
      const unit = AD_UNITS[slot]
      const createAd = getWx()?.createRewardedVideoAd
      if (!createAd || !unit) {
        await wait(300)
        return true
      }
      return new Promise((resolve) => {
        const ad = createAd({ adUnitId: unit })
        const finish = (ok: boolean) => {
          ad.offClose(onClose)
          ad.offError(onError)
          resolve(ok)
        }
        const onClose = (res: { isEnded?: boolean }) => finish(res?.isEnded !== false)
        const onError = () => finish(false)
        ad.onClose(onClose)
        ad.onError(onError)
        ad.show().catch(() => {
          ad.load().then(() => ad.show()).catch(() => finish(false))
        })
      })
    },
    rewardNotice() {
      return hasRealAds() ? '观看一段短视频后获得。' : '当前没有广告。确认后直接获得。'
    },
    async share(text): Promise<ShareResult> {
      const wx = getWx()
      if (!wx?.shareAppMessage) return 'cancelled'
      wx.shareAppMessage({ title: text })
      return 'shared'
    },
    submitScore(total, daily, date) {
      getWx()?.setUserCloudStorage?.({
        KVDataList: [
          { key: 'total', value: String(total) },
          { key: 'daily', value: String(daily) },
          { key: 'date', value: date },
        ],
      })
    },
    vibrate() {
      getWx()?.vibrateShort?.({ type: 'light' })
    },
    sharedCanvas() {
      try {
        return getWx()?.getOpenDataContext?.().canvas ?? null
      } catch {
        return null
      }
    },
    notifyRank(kind, today) {
      try {
        const open = getWx()?.getOpenDataContext?.()
        if (!open) return
        if (open.canvas) {
          open.canvas.width = 600
          open.canvas.height = 680
        }
        open.postMessage({ type: 'rank', kind, today })
      } catch {
        /* open data context is optional */
      }
    },
  }
}

export type { WxApi, WxTouchEvent }
export { getWx }
