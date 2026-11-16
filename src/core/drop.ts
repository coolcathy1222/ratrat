import { RARITY, SPECIES_IDS, type Species } from './species'

const NORMAL: Array<[Species | null, number]> = [
  [null, 84],
  ['cream', 9],
  ['gray', 4],
  ['calico', 1.6],
  ['scarf', 0.8],
  ['gold', 0.4],
  ['crown', 0.2],
]

const BOOSTED: Array<[Species | null, number]> = [
  [null, 62],
  ['cream', 14],
  ['gray', 9],
  ['calico', 6],
  ['scarf', 4],
  ['gold', 3],
  ['crown', 2],
]

export function rollSpecies(boosted: boolean, rng: () => number = Math.random): Species | null {
  const table = boosted ? BOOSTED : NORMAL
  const total = table.reduce((sum, [, weight]) => sum + weight, 0)
  let ticket = rng() * total
  for (const [species, weight] of table) {
    ticket -= weight
    if (ticket < 0) return species
  }
  return null
}

export function rarer(a: Species, b: Species): Species {
  return RARITY[a] >= RARITY[b] ? a : b
}

export function emptyDex(): Record<Species, number> {
  const dex = {} as Record<Species, number>
  for (const id of SPECIES_IDS) dex[id] = 0
  return dex
}
