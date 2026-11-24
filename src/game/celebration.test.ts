import { expect, it } from 'vitest'
import { bagPose, CLOSE_AT, FLIGHT_MS, STAGGER_MS, celebrateMs, POCKET_MS, POCKET_MOUTH, pocketPosition, pocketOrder, pulsePhase, shellCueBetween, waveDelay } from './celebration'

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

it('scatters from each tile’s own cell before closing and carrying the bag offstage', () => {
  for (const slot of [0,5,15]) {
    const x=100+slot*26, y=240+slot*17
    const pose=(age: number) => pocketPosition(age,slot,16,x,y,60)
    const launch=STAGGER_MS*slot/15
    expect(pose(launch)).toMatchObject({x,y,landed:false})
    expect(pose(launch+130).y).toBeLessThan(y)
    expect(pose(launch+FLIGHT_MS)).toMatchObject({x:POCKET_MOUTH.x,y:POCKET_MOUTH.y+60,landed:true})
  }
  expect(bagPose(CLOSE_AT)).toMatchObject({close:0,lift:0})
  expect(bagPose(CLOSE_AT+400).close).toBeGreaterThan(.8)
  expect(bagPose(POCKET_MS)).toMatchObject({close:1,lift:1})
  expect(bagPose(POCKET_MS).x).toBeGreaterThan(810)
  expect(bagPose(POCKET_MS).heroX).toBeGreaterThan(810)
})
