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
export type Pickup = { kind: 'good'; id: Good } | { kind: 'tool' } | { kind: 'chest'; tier: ChestTier } | { kind: 'guest'; id: Species }
export interface Heist {
  levelId: number
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
  const tier = chestTier(rng())
  if (tier) cells[take()] = { kind: 'chest', tier }
  if (rng() < 0.5) cells[take()] = { kind: 'tool' }
  if (guest) cells[take()] = { kind: 'guest', id: guest }
  const eligible = GOOD_IDS.filter(id => GOODS[id][2] <= level.id)
  for (const key of keys) cells[key] = { kind: 'good', id: pick(eligible) }
  return { levelId: level.id, thief, cells, guest }
}

export const CHESTS = {
  ordinary: {name: '普通宝箱', chance: .30, color: '#BA8757'},
  ornate: {name: '华丽宝箱', chance: .50, color: '#709E99'},
  deluxe: {name: '豪华宝箱', chance: .70, color: '#AF85B0'},
} as const
export type ChestTier = keyof typeof CHESTS
export const RELICS = {ranunculus: ['蝴蝶花毛茛', 88], pearl: ['金色珍珠', 128]} as const
export type Relic = keyof typeof RELICS
const RARE_DROPS = ['ranunculus', 'pearl', 'double', 'weasel'] as const
type ChestItem = Good | typeof RARE_DROPS[number]
interface ChestReward {
  tier: ChestTier
  item: ChestItem
  chance: number
  stolen: Good | null
}

function chestTier(roll: number): ChestTier | null {
  if (roll >= .80) return null
  if (roll >= .65) return 'deluxe'
  if (roll >= .40) return 'ornate'
  return 'ordinary'
}

function openChest(tier: ChestTier, plan: Heist, rng: () => number): ChestReward {
  const chance = CHESTS[tier].chance + (plan.thief === 'gold' ? .10 : 0)
  const pool = rng() < chance ? RARE_DROPS : GOOD_IDS.filter(id => GOODS[id][2] <= plan.levelId)
  return {tier, chance, item: pool[Math.floor(rng() * pool.length)], stolen: null}
}
export interface Haul {
  counts: Partial<Record<Good, number>>
  value: number
  tools: number
  joined: Species | null
  talent: string
  chest: ChestReward | null
}
const FLOWERS: Good[] = ['daisy', 'chamomile', 'violet', 'pentas']

export function bankHeist(plan: Heist, save: SaveData, rng = Math.random): Haul {
  const counts: Haul['counts'] = {}
  let tools = 0
  let joined: Species | null = null
  let tier: ChestTier | null = null
  for (const pickup of Object.values(plan.cells)) {
    if (pickup.kind === 'good') counts[pickup.id] = (counts[pickup.id] ?? 0) + 1
    else if (pickup.kind === 'tool') tools++
    else if (pickup.kind === 'chest') tier = pickup.tier
    else if (!save.dex[pickup.id] && rng() < (plan.thief === 'scarf' ? .4 : .25)) joined = pickup.id
  }

  const chest = tier ? openChest(tier, plan, rng) : null
  const item = chest?.item
  let talent = ''
  if (plan.thief === 'calico') {
    let flowers = 0
    for (const id of FLOWERS) {
      const picked = counts[id] ?? 0
      if (picked) { flowers += picked; counts[id] = picked * 2 }
    }
    if (flowers) talent = `采花能手 +${flowers} 朵`
  }
  const luckyDouble = plan.thief === 'cream' && rng() < .15
  if (luckyDouble) {
    const extra = Object.values(counts).reduce((total, qty) => total + qty, 0) * (item === 'double' ? 2 : 1)
    talent = `分粮高手 · 额外入库 ${extra} 件补给`
  }
  if (chest && plan.thief === 'gold') talent = `幸运开箱 · 稀有率 ${Math.round(CHESTS[chest.tier].chance*100)}% → ${Math.round(chest.chance*100)}%`
  if (plan.thief === 'scarf' && plan.guest) talent = '热情招募 · 入队率 25% → 40%'
  const carried = GOOD_IDS.filter(id => counts[id])
  const multiplier = (luckyDouble ? 2 : 1) * (item === 'double' ? 2 : 1)
  for (const id of carried) counts[id] = counts[id]! * multiplier
  if (item === 'weasel' && plan.thief === 'crown') talent = '守袋能手 · 护住补给'
  else if (chest?.item === 'weasel' && carried.length && rng() < .35) {
    const stolen = carried[Math.floor(rng() * carried.length)]
    chest.stolen = stolen
    counts[stolen]! -= 1
  }

  let value = 0
  for (const id of carried) {
    save.stock[id] = (save.stock[id] ?? 0) + counts[id]!
    value += counts[id]! * GOODS[id][1]
  }
  if (item === 'ranunculus' || item === 'pearl') save.relics[item]++
  else if (item && item !== 'double' && item !== 'weasel') save.stock[item] = (save.stock[item] ?? 0) + 1
  save.lenses += tools
  if (joined) save.dex[joined] = 1
  return {counts, value, tools, joined, talent, chest}
}
