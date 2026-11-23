import { expect, it } from 'vitest'
import { celebrateMs, GATHER_MS, POCKET_MS, POCKET_MOUTH, pocketPosition, pocketOrder, pulsePhase, shellCueBetween, waveDelay } from './celebration'

it('spaces successive tiles evenly and slows each individual bloom near its end', () => {
  const count = 73
  const end = waveDelay(count - 1, count)
  expect(end - waveDelay(count - 2, count)).toBeCloseTo(waveDelay(1, count))
  const duration = celebrateMs(count) - end
  const progress = [0, .25, .5, .75, .99].map(t => pulsePhase(t * duration, 0, true))
  const distances = progress.slice(1).map((value, i) => value - progress[i])
  expect(distances).toEqual([...distances].sort((a, b) => b - a))
  expect(pulsePhase(duration, 0, true)).toBe(-1)
})

it('assigns each tile one distinct drop slot and starts the shells after the cheer', () => {
  const count = 73
  const order = pocketOrder(count, () => .15)
  expect(new Set(order).size).toBe(count)
  expect(Math.min(...order)).toBe(0)
  expect(Math.max(...order)).toBe(count-1)
  expect(order).not.toEqual(pocketOrder(count, () => .8))
  expect(shellCueBetween(-1800, -1)).toBe(false)
  expect(shellCueBetween(-1, 0)).toBe(true)
})

it('gathers the tiles at screen center, scatters them and finishes inside the pocket', () => {
  for (const slot of [0, 5, 15]) {
    const pose = (age: number) => pocketPosition(age,slot,16,150,240,60)
    expect(pose(0)).toMatchObject({x:150,y:240,landed:false})
    expect(pose(GATHER_MS)).toMatchObject({x:360,y:640,landed:false})
    expect(Math.abs(pose(GATHER_MS+650).x-360)).toBeGreaterThan(8)
    expect(pose(POCKET_MS)).toMatchObject({x:POCKET_MOUTH.x,y:POCKET_MOUTH.y+60,landed:true})
  }
})
