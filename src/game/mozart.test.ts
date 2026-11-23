import { expect, it } from 'vitest'
import { levelPhrase, recitalMs, recitalPlan } from './mozart'

it('rotates five distinct phrases and finishes the celebration on a whole phrase', () => {
  const firstFive = Array.from({length:5}, (_, i) => levelPhrase(i+1))
  expect(new Set(firstFive.map(p => p.notes.map(([pitch]) => pitch).join(','))).size).toBe(5)
  for (let level=1; level<=45; level++) {
    const p = levelPhrase(level)
    const plan = recitalPlan((level-1)%5)
    const unit = (level-1)%5 === 3 ? 6 : 8
    expect(p).toBe(firstFive[(level-1)%5])
    expect(plan.beats % unit).toBe(0)
    expect(plan.beats / unit).toBeGreaterThanOrEqual(1)
    expect(plan.beats / unit).toBeLessThanOrEqual(2)
    expect(recitalMs(p)).toBe(Math.ceil(plan.beats*60000/p.bpm)+420)
    expect(recitalMs(p)).toBeGreaterThan(plan.beats*60000/p.bpm)
  }
})

import { duets } from './duets'

it('performs both written parts, including the opening chord and measured rests', () => {
  expect(duets.map(duet => duet.beats)).toEqual([7.75,8.25,17,11.5,17])
  expect(duets[1].parts[0].slice(0,3).map(attack => attack[1])).toEqual([8,8,8])
  expect(duets[0].parts.map(part => part[0])).toEqual([
    [0,192,50,62,74,78,81,86], [0,192,38,50,62,66,69,74],
  ])
  for (const [index, duet] of duets.entries()) {
    const phrase = levelPhrase(index+1)
    const plan = recitalPlan(index)
    expect(recitalMs(phrase)).toBe(Math.ceil(plan.beats*60000/phrase.bpm)+420)
    for (const part of duet.parts) {
      expect(part.length).toBeGreaterThan(0)
      for (const [start, duration] of part) {
        expect(duration).toBeGreaterThan(0)
        expect(start+duration).toBeLessThanOrEqual(duet.beats*96)
      }
    }
  }
})
