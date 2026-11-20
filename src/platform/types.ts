export type RewardSlot = 'hint' | 'undo' | 'time'

export type ShareResult = 'shared' | 'copied' | 'cancelled'

export interface Platform {
  name: 'web' | 'wechat'
  storageGet(key: string): string | null
  storageSet(key: string, value: string): void
  showReward(slot: RewardSlot): Promise<boolean>
  rewardNotice(): string
  share(text: string): Promise<ShareResult>
  submitScore(total: number, daily: number, date: string): void
  vibrate(): void
  sharedCanvas(): CanvasImageSource | null
  notifyRank(kind: 'total' | 'daily', today: string): void
}
