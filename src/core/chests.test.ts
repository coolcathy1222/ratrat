import { describe, expect, it } from 'vitest'
import { bankHeist, planHeist, CHESTS, type ChestTier, type Heist } from './heist'
import { defaultSave, normalizeSave } from './progress'
import { LEVELS } from './levels'
import { hintSteps } from './rules'

function settle(thief: Heist['thief'], tier: ChestTier, rolls: number[]) {
  const save = defaultSave()
  save.stock.rice = 12
  const plan: Heist = {thief, levelId: 10, guest: null, cells: {
    a:{kind:'good',id:'rice'}, b:{kind:'good',id:'daisy'}, c:{kind:'tool'}, d:{kind:'chest',tier},
  }}
  const haul = bankHeist(plan, save, () => rolls.shift() ?? .99)
  return {save, haul}
}

describe('settlement and chest inventory', () => {
  it('uses one mutually exclusive tier draw with the same odds on every level', () => {
    for (const level of LEVELS) {
      for (const [roll,tier] of [[0,'ordinary'],[.39999,'ordinary'],[.4,'ornate'],
        [.64999,'ornate'],[.65,'deluxe'],[.79999,'deluxe'],[.8,null],[.99999,null]] as const) {
        const save = defaultSave()
        const plan = planHeist(level,save.dex,()=>roll)
        const boxes = Object.values(plan.cells).filter(p => p.kind === 'chest')
        expect(boxes).toEqual(tier ? [{kind:'chest',tier}] : [])
        expect(save.relics.ranunculus).toBe(0)
        const haul = bankHeist(plan,save,()=>0)
        expect(haul.chest?.tier ?? null).toBe(tier)
        expect(save.relics.ranunculus).toBe(Number(tier !== null))
      }
    }
  })

  it('rolls contents separately using the rarity of the awarded chest', () => {
    for (const [tier, rate] of [['ordinary',.3],['ornate',.5],['deluxe',.7]] as const) {
      expect(CHESTS[tier].chance).toBe(rate)
      for (const [contentRoll,rare] of [[rate-.0001,true],[rate,false]] as const) {
        const {haul,save} = settle('gray',tier,[contentRoll,0])
        expect(haul.chest?.item).toBe(rare ? 'ranunculus' : 'rice')
        expect(save.stock.rice).toBe(rare ? 13 : 14)
        expect(haul.counts.rice).toBe(1)
        expect(normalizeSave(save).relics.ranunculus).toBe(Number(rare))
      }
    }
  })

  it('stores pearls, applies both doubling bonuses and leaves tools single', () => {
    const pearl = settle('gold','deluxe',[.72,.26])
    expect(pearl.haul.chest?.chance).toBeCloseTo(.80)
    expect(normalizeSave(pearl.save).relics.pearl).toBe(1)
    const {save,haul} = settle('cream','deluxe',[0,.51,.14])
    expect(haul.counts).toEqual({rice:4,daisy:4})
    expect(save.stock.rice).toBe(16)
    expect(save.lenses).toBe(1)
    expect(settle('calico','deluxe',[0,.51]).haul.counts).toEqual({rice:2,daisy:4})
  })

  it('takes only from this trip and respects the guard ability and theft roll', () => {
    const hit = settle('gray','deluxe',[0,.9,.349,0])
    expect(hit.haul.chest?.stolen).toBe('rice')
    expect(hit.save.stock.rice).toBe(12)
    for (const [thief,roll] of [['crown',0],['gray',.35]] as const) {
      const safe = settle(thief,'deluxe',[0,.9,roll,0])
      expect(safe.haul.chest?.stolen).toBeNull()
      expect(safe.save.stock.rice).toBe(13)
    }
  })

  it('boosts recruitment only for the scarf mouse', () => {
    for (const thief of ['scarf','gray'] as const) {
      const save = defaultSave()
      const haul = bankHeist({levelId:5, thief, guest:'gold',cells:{a:{kind:'guest',id:'gold'}}},save,()=>.35)
      expect(haul.joined).toBe(thief === 'scarf' ? 'gold' : null)
    }
  })
})

it('guides five movement steps, truncating before the burrow for all levels', () => {
  for (const level of LEVELS) {
    const route = level.solution
    expect(hintSteps(level,[])).toEqual(route.slice(1,6))
    expect(hintSteps(level,route.slice(0,4))).toEqual(route.slice(4,9))
    expect(hintSteps(level,route.slice(0,-3))).toEqual(route.slice(-3,-1))
    expect(hintSteps(level,route.slice(0,-1))).toEqual([])
  }
})
