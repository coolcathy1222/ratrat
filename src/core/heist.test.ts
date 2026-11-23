import { describe, expect, it } from 'vitest'
import { bankHeist, GOODS, planHeist } from './heist'
import { LEVELS, levelById } from './levels'
import { defaultSave, normalizeSave } from './progress'
import { SPECIES_IDS } from './species'

describe('burrow heists', () => {
  it('grants one starter and migrates a cleared 15-level save without losing its crew', () => {
    expect(Object.values(defaultSave().dex)).toEqual([1,0,0,0,0,0])
    const migrated = normalizeSave({level:15, finished:true, dex:{cream:0, scarf:2}, stock:{rice:7}, lenses:3})
    expect(migrated.level).toBe(16)
    expect(migrated.finished).toBe(false)
    expect(migrated.dex.cream).toBe(1)
    expect(migrated.dex.scarf).toBe(2)
    expect(migrated.stock.rice).toBe(7)
    expect(migrated.lenses).toBe(3)
  })

  it('fills exactly the interior route, respects tiers and separates guests from tools', () => {
    const save = defaultSave()
    save.dex.gray = 1
    for (const level of LEVELS) {
      for (const roll of [0, .49999, .5, .99999]) {
        const plan = planHeist(level,save.dex,()=>roll)
        expect(plan.thief).toBe(roll < .5 ? 'cream' : 'gray')
        const specials = Object.values(plan.cells)
        expect(new Set(Object.keys(plan.cells))).toEqual(new Set(level.solution.slice(1,-1).map(pos=>`${pos.x},${pos.y}`)))
        expect(specials.filter(p=>p.kind==='tool')).toHaveLength(roll < .5 ? 1 : 0)
        expect(specials.filter(p=>p.kind==='guest')).toHaveLength(level.id%5 === 0 ? 1 : 0)
        if(plan.guest) expect(save.dex[plan.guest]).toBe(0)
        for(const item of specials) if(item.kind==='good') {
          expect(GOODS[item.id][2]).toBeLessThanOrEqual(level.id)
          if(roll > .99) expect(GOODS[item.id][2]).toBe(Math.min(26, 1+5*Math.floor((level.id-1)/5)))
        }
      }
    }
  })

  it('credits only the actual haul and rolls once for the encountered guest', () => {
    for (const roll of [.24999,.25]) {
      const save = defaultSave()
      const plan = planHeist(levelById(5),save.dex,()=>0)
      expect(save.stock).toEqual({})
      expect(save.lenses).toBe(0)
      const rolls = [roll, .0, .0, .90]
      const haul = bankHeist(plan,save,()=>rolls.shift() ?? .90)
      expect(save.stock).toEqual(haul.counts)
      expect(haul.value).toBe(levelById(5).solution.length - 5)
      expect(save.lenses).toBe(1)
      expect(save.dex.gray).toBe(roll < .25 ? 1 : 0)
      expect(haul.joined).toBe(roll < .25 ? plan.guest : null)
      const reloaded = normalizeSave(JSON.parse(JSON.stringify(save)))
      expect(reloaded.stock.rice).toBe(haul.counts.rice)
      expect(reloaded.lenses).toBe(1)
    }
  })

  it('never places duplicates after completing the collection', () => {
    const save = defaultSave()
    for (const id of SPECIES_IDS) save.dex[id] = 1
    expect(planHeist(levelById(25),save.dex).guest).toBeNull()
  })
})
