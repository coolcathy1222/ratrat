import { describe, expect, it } from 'vitest'
import { rarer, rollSpecies } from './drop'
import { LEVELS } from './levels'
import { defaultSave, normalizeSave, noteClear } from './progress'
import { extendStroke, hintNext, isStuck, isWon, minClearSeconds, ratCount, step, undoOne } from './rules'

function playSolution(levelId: number) {
  const level = LEVELS[levelId - 1]
  let path = [] as typeof level.solution
  path = []
  for (const cell of level.solution) {
    const result = step(level, path, cell)
    expect(result.ok, `${level.id} ${cell.x},${cell.y}`).toBe(true)
    if (result.ok) path = result.path
  }
  expect(isWon(level, path)).toBe(true)
  expect(isStuck(level, path)).toBe(false)
  return path
}

describe('levels', () => {
  it('accepts every authored route', () => {
    expect(LEVELS).toHaveLength(15)
    for (const level of LEVELS) {
      const xs = level.cells.map((cell) => cell.x)
      const ys = level.cells.map((cell) => cell.y)
      const area = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1)
      expect(level.cells.length / area).toBeGreaterThan(0.7)
      expect(level.cells.length / area).toBeLessThan(0.95)
      expect(ratCount(level)).toBeGreaterThanOrEqual(22)
      const path = playSolution(level.id)
      expect(path).toHaveLength(ratCount(level))
      expect(hintNext(level, [])).toEqual(level.start)
      expect(hintNext(level, path.slice(0, 2))).toEqual(level.solution[2])
    }
  })

  it('rejects a diagonal shortcut on the tutorial stair', () => {
    const level = LEVELS[0]
    const started = step(level, [], level.start)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const diagonal = level.cells.find(
      (cell) =>
        cell.kind === 'rat' &&
        Math.abs(cell.x - level.start.x) === 1 &&
        Math.abs(cell.y - level.start.y) === 1,
    )
    expect(diagonal).toBeTruthy()
    if (!diagonal) return
    const result = step(level, started.path, diagonal)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('diagonal')
  })

  it('rejects revisiting a rat', () => {
    const level = LEVELS[0]
    let path = step(level, [], level.solution[0])
    expect(path.ok).toBe(true)
    if (!path.ok) return
    path = step(level, path.path, level.solution[1])
    expect(path.ok).toBe(true)
    if (!path.ok) return
    const back = step(level, path.path, level.solution[0])
    expect(back.ok).toBe(false)
    if (!back.ok) expect(back.error).toBe('repeat')
  })

  it('blocks crates and holes', () => {
    const boxed = LEVELS.find((level) => level.cells.some((cell) => cell.kind === 'crate'))
    expect(boxed).toBeTruthy()
    if (!boxed) return
    const crate = boxed.cells.find((cell) => cell.kind === 'crate')
    expect(crate).toBeTruthy()
    if (!crate) return
    let path = [] as typeof boxed.solution
    let blocked = false
    for (const cell of boxed.solution) {
      const result = step(boxed, path, cell)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      path = result.path
      if (Math.abs(cell.x - crate.x) + Math.abs(cell.y - crate.y) !== 1) continue
      const hit = step(boxed, path, crate)
      expect(hit.ok).toBe(false)
      if (!hit.ok) expect(hit.error).toBe('crate')
      blocked = true
      break
    }
    expect(blocked).toBe(true)

    const gap = LEVELS[0]
    let walked = step(gap, [], gap.start)
    expect(walked.ok).toBe(true)
    if (!walked.ok) return
    const occupied = new Set(gap.cells.map((cell) => `${cell.x},${cell.y}`))
    const hole = [
      { x: gap.start.x + 1, y: gap.start.y },
      { x: gap.start.x - 1, y: gap.start.y },
      { x: gap.start.x, y: gap.start.y + 1 },
      { x: gap.start.x, y: gap.start.y - 1 },
    ].find((cell) => !occupied.has(`${cell.x},${cell.y}`))
    expect(hole).toBeTruthy()
    if (!hole) return
    const missed = step(gap, walked.path, hole)
    expect(missed.ok).toBe(false)
    if (!missed.ok) expect(missed.error).toBe('hole')
  })

  it('continues a lifted stroke and fills a straight slide', () => {
    let slid = false
    for (const level of LEVELS) {
      const solution = level.solution
      for (let index = 0; index < solution.length - 2; index += 1) {
        const a = solution[index]
        const b = solution[index + 1]
        const c = solution[index + 2]
        const straight = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
        if (!straight) continue
        let path = [] as typeof solution
        for (const cell of solution.slice(0, index + 1)) {
          const result = step(level, path, cell)
          expect(result.ok).toBe(true)
          if (!result.ok) return
          path = result.path
        }
        const slide = extendStroke(level, path, c)
        expect(slide.error).toBeNull()
        expect(slide.path[slide.path.length - 1]).toEqual(c)
        slid = true
        break
      }
      if (slid) break
    }
    expect(slid).toBe(true)
  })

  it('undoes one step and ignores a too-short clear', () => {
    const level = LEVELS[0]
    const path = playSolution(1)
    expect(undoOne(path)).toHaveLength(path.length - 1)
    expect(undoOne([level.start])).toEqual([])
    expect(minClearSeconds(ratCount(level))).toBeGreaterThan(0)
  })

  it('returns no hint after the path leaves the solution', () => {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]
    let stuckLevel = LEVELS[0]
    let stuckPath = [] as typeof LEVELS[0]['solution']
    for (const level of LEVELS) {
      const solution = level.solution.map((cell) => `${cell.x},${cell.y}`)
      let nodes = 0
      const search = (path: typeof stuckPath): typeof stuckPath | null => {
        nodes += 1
        if (nodes > 2500) return null
        const cur = path[path.length - 1]
        const legal = []
        for (const dir of dirs) {
          const result = step(level, path, { x: cur.x + dir.x, y: cur.y + dir.y })
          if (result.ok && result.path.length > path.length) legal.push(result.path)
        }
        if (legal.length === 0 && path.length > 2 && !isWon(level, path)) return path
        if (path.length >= 8) return null
        legal.sort((a, b) => {
          const left = `${a[a.length - 1].x},${a[a.length - 1].y}`
          const right = `${b[b.length - 1].x},${b[b.length - 1].y}`
          return Number(solution[a.length - 1] === left) - Number(solution[b.length - 1] === right)
        })
        for (const next of legal) {
          const found = search(next)
          if (found) return found
        }
        return null
      }
      const started = step(level, [], level.start)
      if (!started.ok) continue
      const found = search(started.path)
      if (found) {
        stuckLevel = level
        stuckPath = found
        break
      }
    }
    expect(stuckPath.length).toBeGreaterThan(2)
    expect(isStuck(stuckLevel, stuckPath)).toBe(true)
    expect(hintNext(stuckLevel, stuckPath)).toBeNull()
  })
})

describe('drops and progress', () => {
  it('rolls within the table and keeps the rarer rat', () => {
    expect(rollSpecies(false, () => 0)).toBeNull()
    expect(rollSpecies(false, () => 0.85)).toBe('cream')
    expect(rollSpecies(true, () => 0.99)).toBe('crown')
    expect(rarer('cream', 'gold')).toBe('gold')
    expect(rarer('crown', 'gold')).toBe('crown')
  })

  it('resets the daily count on a new Shanghai day and advances the level', () => {
    const save = defaultSave('2026-11-16')
    save.dailyRats = 12
    save.totalRats = 12
    const next = normalizeSave(save, '2026-11-17')
    expect(next.dailyRats).toBe(0)
    expect(next.totalRats).toBe(12)
    expect(next.dailyDate).toBe('2026-11-17')
    noteClear(next, 1)
    expect(next.level).toBe(2)
    noteClear(next, 15)
    expect(next.finished).toBe(true)
    expect(next.level).toBe(15)
    const oldFinish = defaultSave('2026-11-16')
    oldFinish.level = 5
    oldFinish.finished = true
    const migrated = normalizeSave(oldFinish, '2026-11-16')
    expect(migrated.finished).toBe(false)
    expect(migrated.level).toBe(6)
  })
})
