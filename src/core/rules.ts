import type { CellPos, LevelDef } from './levels'

export type StepError = 'not-start' | 'diagonal' | 'far' | 'crate' | 'hole' | 'repeat' | 'early-end'

export type StepResult = { ok: true; path: CellPos[] } | { ok: false; error: StepError }

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

export function keyOf(pos: CellPos): string {
  return `${pos.x},${pos.y}`
}

export function sameCell(a: CellPos, b: CellPos): boolean {
  return a.x === b.x && a.y === b.y
}

interface LevelIndex {
  kind: Map<string, 'rat' | 'crate'>
  ratCount: number
}

const indexes = new WeakMap<LevelDef, LevelIndex>()

export function indexLevel(level: LevelDef): LevelIndex {
  const cached = indexes.get(level)
  if (cached) return cached
  const kind = new Map<string, 'rat' | 'crate'>()
  let ratCount = 0
  for (const cell of level.cells) {
    kind.set(keyOf(cell), cell.kind)
    if (cell.kind === 'rat') ratCount += 1
  }
  const index = { kind, ratCount }
  indexes.set(level, index)
  return index
}

export function ratCount(level: LevelDef): number {
  return indexLevel(level).ratCount
}

export function step(level: LevelDef, path: CellPos[], next: CellPos): StepResult {
  const index = indexLevel(level)
  if (path.length === 0) {
    if (!sameCell(next, level.start)) return { ok: false, error: 'not-start' }
    return { ok: true, path: [{ x: next.x, y: next.y }] }
  }
  const cur = path[path.length - 1]
  const dx = next.x - cur.x
  const dy = next.y - cur.y
  if (dx === 0 && dy === 0) return { ok: true, path }
  if (dx !== 0 && dy !== 0) return { ok: false, error: 'diagonal' }
  if (Math.abs(dx) + Math.abs(dy) !== 1) return { ok: false, error: 'far' }
  const kind = index.kind.get(keyOf(next))
  if (kind === 'crate') return { ok: false, error: 'crate' }
  if (kind !== 'rat') return { ok: false, error: 'hole' }
  if (path.some((cell) => sameCell(cell, next))) return { ok: false, error: 'repeat' }
  if (sameCell(next, level.end) && path.length + 1 < index.ratCount) return { ok: false, error: 'early-end' }
  return { ok: true, path: [...path, { x: next.x, y: next.y }] }
}

export function extendStroke(
  level: LevelDef,
  path: CellPos[],
  target: CellPos,
): { path: CellPos[]; error: StepError | null } {
  if (path.length === 0) {
    const result = step(level, path, target)
    return result.ok ? { path: result.path, error: null } : { path, error: result.error }
  }
  const cur = path[path.length - 1]
  if (sameCell(cur, target)) return { path, error: null }
  const dx = target.x - cur.x
  const dy = target.y - cur.y
  if (dx !== 0 && dy !== 0) return { path, error: 'diagonal' }
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  let nextPath = path
  let x = cur.x
  let y = cur.y
  while (x !== target.x || y !== target.y) {
    x += sx
    y += sy
    const result = step(level, nextPath, { x, y })
    if (!result.ok) return { path: nextPath, error: result.error }
    nextPath = result.path
  }
  return { path: nextPath, error: null }
}

export function isWon(level: LevelDef, path: CellPos[]): boolean {
  const index = indexLevel(level)
  if (path.length !== index.ratCount || path.length === 0) return false
  if (!sameCell(path[0], level.start)) return false
  if (!sameCell(path[path.length - 1], level.end)) return false
  const seen = new Set<string>()
  for (const cell of path) {
    const key = keyOf(cell)
    if (seen.has(key) || index.kind.get(key) !== 'rat') return false
    seen.add(key)
  }
  return seen.size === index.ratCount
}

export function isStuck(level: LevelDef, path: CellPos[]): boolean {
  if (path.length === 0 || isWon(level, path)) return false
  const cur = path[path.length - 1]
  for (const dir of DIRS) {
    const result = step(level, path, { x: cur.x + dir.x, y: cur.y + dir.y })
    if (result.ok && result.path.length > path.length) return false
  }
  return true
}

export function undoOne(path: CellPos[]): CellPos[] {
  if (path.length <= 1) return []
  return path.slice(0, -1)
}

function completeRoute(level: LevelDef, path: CellPos[], rats: number): CellPos[] | null {
  const visited = new Set(path.map(keyOf))
  let nodes = 0
  function search(current: CellPos[]): boolean {
    nodes += 1
    if (nodes > 6000) return false
    if (current.length === rats) return sameCell(current[current.length - 1], level.end)
    const cur = current[current.length - 1]
    for (const dir of DIRS) {
      const next = { x: cur.x + dir.x, y: cur.y + dir.y }
      const result = step(level, current, next)
      if (!result.ok || result.path.length === current.length) continue
      const key = keyOf(next)
      if (visited.has(key)) continue
      visited.add(key)
      current.push(next)
      if (search(current)) return true
      current.pop()
      visited.delete(key)
    }
    return false
  }
  for (const cell of path) visited.add(keyOf(cell))
  const route = [...path]
  return search(route) ? route : null
}

function remainingRoute(level: LevelDef, path: CellPos[]): CellPos[] {
  if (path.every((cell, i) => level.solution[i] && sameCell(cell, level.solution[i]))) {
    return level.solution.slice(path.length)
  }
  const route = completeRoute(level, path, ratCount(level))
  return route?.slice(path.length) ?? []
}

export function hintNext(level: LevelDef, path: CellPos[]): CellPos | null {
  return remainingRoute(level, path)[0] ?? null
}

export function hintSteps(level: LevelDef, path: CellPos[]): CellPos[] {
  return remainingRoute(level, path)
    .filter(cell => !sameCell(cell, level.start) && !sameCell(cell, level.end))
    .slice(0, 5)
}

export function minClearSeconds(count: number): number {
  return Math.max(0.8, count * 0.25)
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  const min = Math.floor(whole / 60)
  const sec = whole % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
