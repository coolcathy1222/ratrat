import type { Platform, RewardSlot, ShareResult } from './types'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createWebPlatform(): Platform {
  return {
    name: 'web',
    storageGet(key) {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    storageSet(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        /* private mode */
      }
    },
    async showReward(_slot: RewardSlot) {
      await wait(450)
      return true
    },
    rewardNotice() {
      return '网页版不播放真实广告。确认后直接获得。'
    },
    async share(text): Promise<ShareResult> {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: '捉鼠鼠', text })
          return 'shared'
        } catch {
          return 'cancelled'
        }
      }
      try {
        await navigator.clipboard.writeText(text)
        return 'copied'
      } catch {
        return 'cancelled'
      }
    },
    submitScore() {},
    vibrate() {
      navigator.vibrate?.(12)
    },
    sharedCanvas() {
      return null
    },
    notifyRank() {},
  }
}
