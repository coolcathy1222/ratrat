import type { SaveData } from '../core/progress'
import { normalizeSave } from '../core/progress'
import type { Platform } from '../platform/types'

const KEY = 'ratrat-save-v1'

export function loadSave(platform: Platform): SaveData {
  try {
    const raw = platform.storageGet(KEY)
    return normalizeSave(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeSave(null)
  }
}

export function storeSave(platform: Platform, save: SaveData): void {
  platform.storageSet(KEY, JSON.stringify(save))
}
