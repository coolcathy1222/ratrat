import { emptyDex } from './drop'
import { LEVEL_COUNT } from './levels'
import { SPECIES_IDS, type Species } from './species'

export interface SaveData {
  sound: boolean
  level: number
  finished: boolean
  dex: Record<Species, number>
  totalRats: number
  dailyRats: number
  dailyDate: string
}

export function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function defaultSave(today = shanghaiDate()): SaveData {
  return {
    sound: true,
    level: 1,
    finished: false,
    dex: emptyDex(),
    totalRats: 0,
    dailyRats: 0,
    dailyDate: today,
  }
}

export function normalizeSave(raw: unknown, today = shanghaiDate()): SaveData {
  const save = defaultSave(today)
  if (!raw || typeof raw !== 'object') return save
  const data = raw as Partial<SaveData>
  save.sound = data.sound !== false
  const level = Number(data.level)
  const rawLevel = Number.isFinite(level) ? Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level))) : 1
  const wasFinished = data.finished === true
  if (wasFinished && rawLevel >= LEVEL_COUNT) {
    save.finished = true
    save.level = LEVEL_COUNT
  } else if (wasFinished) {
    save.finished = false
    save.level = Math.min(LEVEL_COUNT, rawLevel + 1)
  } else {
    save.finished = false
    save.level = rawLevel
  }
  save.totalRats = Math.max(0, Math.floor(Number(data.totalRats) || 0))
  save.dailyDate = typeof data.dailyDate === 'string' ? data.dailyDate : today
  save.dailyRats = save.dailyDate === today ? Math.max(0, Math.floor(Number(data.dailyRats) || 0)) : 0
  save.dailyDate = today
  if (data.dex && typeof data.dex === 'object') {
    for (const id of SPECIES_IDS) {
      save.dex[id] = Math.max(0, Math.floor(Number(data.dex[id]) || 0))
    }
  }
  return save
}

export function noteClear(save: SaveData, levelId: number): void {
  if (levelId >= LEVEL_COUNT) {
    save.finished = true
    save.level = LEVEL_COUNT
    return
  }
  if (save.level === levelId) save.level = levelId + 1
}
