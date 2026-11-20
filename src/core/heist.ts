import type { LevelDef } from './levels'
import type { SaveData } from './progress'
import { SPECIES_IDS, type Species } from './species'

export const GOODS = {
  rice: ['稻穗', 1, 1], wheat: ['麦子', 1, 1], peanut: ['花生', 2, 1],
  daisy: ['小雏菊', 4, 6], acorn: ['橡果', 5, 6], chestnut: ['栗子', 6, 6],
  cheese: ['黄金奶酪', 9, 11], pine: ['松子', 10, 11], violet: ['野堇花', 12, 11],
  chamomile: ['洋甘菊', 14, 11],
  hazelnut: ['榛子', 16, 16], walnut: ['核桃', 18, 16], almond: ['大杏仁', 21, 16], jade: ['翡翠', 26, 16],
  pentas: ['红色五星花花', 35, 21], ruby: ['红宝石', 42, 21], diamond: ['星钻', 68, 21],
  sapphire: ['蓝宝石', 76, 26],
} as const
export type Good = keyof typeof GOODS
export const GOOD_IDS = Object.keys(GOODS) as Good[]
export const TOOL = '探路镜'
export type Pickup = { kind: 'good'; id: Good } | { kind: 'tool' } | { kind: 'guest'; id: Species }
export interface Heist {
  thief: Species
  cells: Record<string, Pickup>
  guest: Species | null
}
export function planHeist(level: LevelDef, dex: SaveData['dex'], rng = Math.random): Heist {
  const pick = <T>(pool: T[]) => pool[Math.floor(rng() * pool.length)]
  const thief = pick(SPECIES_IDS.filter(id => dex[id] > 0)) ?? 'cream'
  const missing = SPECIES_IDS.filter(id => !dex[id])
  const guest = level.id % 5 === 0 && missing.length ? pick(missing) : null
  const keys = level.solution.slice(1, -1).map(pos => `${pos.x},${pos.y}`)
  const take = () => keys.splice(Math.floor(rng() * keys.length), 1)[0]
  const cells: Heist['cells'] = {}
  if (rng() < 0.5) cells[take()] = { kind: 'tool' }
  if (guest) cells[take()] = { kind: 'guest', id: guest }
  const eligible = GOOD_IDS.filter(id => GOODS[id][2] <= level.id)
  for (const key of keys) cells[key] = { kind: 'good', id: pick(eligible) }
  return { thief, cells, guest }
}

export interface Haul {
  counts: Partial<Record<Good, number>>
  value: number
  tools: number
  joined: Species | null
}

export function bankHeist(plan: Heist, save: SaveData, rng = Math.random): Haul {
  const haul: Haul = {counts: {}, value: 0, tools: 0, joined: null}
  for (const pickup of Object.values(plan.cells)) {
    if (pickup.kind === 'good') {
      haul.counts[pickup.id] = (haul.counts[pickup.id] ?? 0) + 1
      save.stock[pickup.id] = (save.stock[pickup.id] ?? 0) + 1
      haul.value += GOODS[pickup.id][1]
    } else if (pickup.kind === 'tool') {
      haul.tools++
      save.lenses++
    } else if (!save.dex[pickup.id] && rng() < 0.25) {
      save.dex[pickup.id] = 1
      haul.joined = pickup.id
    }
  }
  return haul
}
