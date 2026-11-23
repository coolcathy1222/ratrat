import { GOOD_IDS, type Relic, type Good } from './heist'
import { LEVEL_COUNT } from './levels'
import { SPECIES_IDS, type Species } from './species'

export interface SaveData {
  relics: Record<Relic, number>
  stock: Partial<Record<Good, number>>
  lenses: number
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
    dex: {cream: 1, gray: 0, calico: 0, scarf: 0, gold: 0, crown: 0},
    stock: {},
    relics: {ranunculus: 0, pearl: 0},
    lenses: 0,
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
  save.dex.cream = Math.max(1, save.dex.cream)
  const quantity = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0
  save.relics.ranunculus = quantity(data.relics?.ranunculus)
  save.relics.pearl = quantity(data.relics?.pearl)
  save.lenses = quantity(data.lenses)
  for (const id of GOOD_IDS) save.stock[id] = quantity(data.stock?.[id])
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
