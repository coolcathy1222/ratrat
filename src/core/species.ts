export const SPECIES_IDS = ['cream', 'gray', 'calico', 'scarf', 'gold', 'crown'] as const

export type Species = (typeof SPECIES_IDS)[number]

export const SPECIES_NAME: Record<Species, string> = {
  cream: '普通米鼠',
  gray: '灰鼠',
  calico: '花枝鼠',
  scarf: '围脖鼠',
  gold: '金鼠',
  crown: '皇冠鼠',
}

export const RARITY: Record<Species, number> = {
  cream: 0,
  gray: 1,
  calico: 2,
  scarf: 3,
  gold: 4,
  crown: 5,
}

export const SPECIES_COLOR: Record<Species, string> = {
  cream: '#F4E2CC',
  gray: '#8E97AB',
  calico: '#E4C3A2',
  scarf: '#6A4636',
  gold: '#E2B15C',
  crown: '#F6F0E4',
}
