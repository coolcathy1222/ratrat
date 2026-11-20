import type { CellPos, LevelDef } from '../core/levels'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BoardGeom {
  cell: number
  gap: number
  minX: number
  minY: number
  originX: number
  originY: number
}

export const STAGE = { w: 720, h: 1280 }
export const PLAY_AREA: Rect = { x: 42, y: 240, w: 636, h: 656 }

export function boardGeom(level: LevelDef, area: Rect, maxCell = 156): BoardGeom {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const cell of level.cells) {
    minX = Math.min(minX, cell.x)
    minY = Math.min(minY, cell.y)
    maxX = Math.max(maxX, cell.x)
    maxY = Math.max(maxY, cell.y)
  }
  const cols = maxX - minX + 1
  const rows = maxY - minY + 1
  const gap = 16
  const cell = Math.min(maxCell, (area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows)
  const gridW = cols * cell + gap * (cols - 1)
  const gridH = rows * cell + gap * (rows - 1)
  const spareY = Math.max(0, area.h - gridH)
  return {
    cell,
    gap,
    minX,
    minY,
    originX: area.x + (area.w - gridW) / 2,
    originY: area.y + spareY / 2,
  }
}

export function cellRect(geom: BoardGeom, pos: CellPos): Rect {
  return {
    x: geom.originX + (pos.x - geom.minX) * (geom.cell + geom.gap),
    y: geom.originY + (pos.y - geom.minY) * (geom.cell + geom.gap),
    w: geom.cell,
    h: geom.cell,
  }
}

export function cellCenter(geom: BoardGeom, pos: CellPos): { x: number; y: number } {
  const rect = cellRect(geom, pos)
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function pointAlong(points: Array<{ x: number; y: number }>, t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1 || t <= 0) return points[0]
  if (t >= 1) return points[points.length - 1]
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const len = Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y)
    lengths.push(len)
    total += len
  }
  let dist = Math.min(1, Math.max(0, t)) * total
  for (let i = 1; i < points.length; i++) {
    const len = lengths[i - 1]
    if (dist <= len || i === points.length - 1) {
      const p = len === 0 ? 1 : dist / len
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * p,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * p,
      }
    }
    dist -= len
  }
  return points[points.length - 1]
}
