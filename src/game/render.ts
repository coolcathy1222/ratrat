import { LEVEL_COUNT, LEVELS, type CellPos, type LevelDef } from '../core/levels'
import { ratCount } from '../core/rules'
import { formatTime } from '../core/rules'
import { SPECIES_COLOR, SPECIES_IDS, SPECIES_NAME, type Species } from '../core/species'
import type { SaveData } from '../core/progress'
import type { AssetBook, Sprite } from './assets'
import { PLAY_AREA, STAGE, boardGeom, cellCenter, cellRect, type Rect } from './geom'

export interface Hot extends Rect {
  id: string
}

export interface PlayView {
  level: LevelDef
  path: CellPos[]
  hintCell: CellPos | null
  hintLeft: number
  remaining: number | null
  shake: number
  won: boolean
  winAt: number
  showDrop: boolean
  dropAt: number
  dropSpecies: Species | null
  dropBoosted: boolean
  spawnAt: number
  pops: Record<string, number>
}

export interface Frame {
  ctx: CanvasRenderingContext2D
  now: number
  hots: Hot[]
  assets: AssetBook
  save: SaveData
  pressed: string | null
  screen: 'home' | 'play' | 'dex' | 'rank'
  rankTab: 'total' | 'daily'
  detail: Species | null
  shared: CanvasImageSource | null
  toast: string | null
  settings: boolean
  settingsFromPlay: boolean
  play: PlayView | null
  reward: { title: string; confirm: string } | null
  notice: string
  timeout: boolean
  extraUsed: boolean
  stuck: boolean
}

const FONT = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif'

function font(size: number, weight = 600): string {
  return `${weight} ${size}px ${FONT}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillRound(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string): void {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.fillStyle = color
  ctx.fill()
}

function hot(frame: Frame, id: string, rect: Rect): void {
  frame.hots.push({ id, ...rect })
}

function paintHead(ctx: CanvasRenderingContext2D, sprite: Sprite | undefined, color: string, x: number, y: number, w: number, h: number): void {
  if (sprite && sprite.width > 0 && sprite.height > 0) {
    const scale = Math.min(w / sprite.width, h / sprite.height)
    const dw = sprite.width * scale
    const dh = sprite.height * scale
    ctx.drawImage(sprite, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    return
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

function button(frame: Frame, id: string, rect: Rect, label: string, fill = '#E36B3C', text = '#FFFDF8'): void {
  hot(frame, id, rect)
  const pressed = frame.pressed === id
  const y = rect.y + (pressed ? 4 : 0)
  if (!pressed) {
    fillRound(frame.ctx, { x: rect.x, y: rect.y + 6, w: rect.w, h: rect.h }, 28, '#C6532C')
  }
  fillRound(frame.ctx, { x: rect.x, y, w: rect.w, h: rect.h }, 28, fill)
  frame.ctx.fillStyle = text
  frame.ctx.font = font(32, 700)
  frame.ctx.textAlign = 'center'
  frame.ctx.textBaseline = 'middle'
  frame.ctx.fillText(label, rect.x + rect.w / 2, y + rect.h / 2)
}

function ghostButton(frame: Frame, id: string, rect: Rect, label: string): void {
  hot(frame, id, rect)
  fillRound(frame.ctx, rect, 28, '#FFF8F1')
  frame.ctx.strokeStyle = '#E4CBB8'
  frame.ctx.lineWidth = 3
  roundRect(frame.ctx, rect.x, rect.y, rect.w, rect.h, 28)
  frame.ctx.stroke()
  frame.ctx.fillStyle = '#6B3A2A'
  frame.ctx.font = font(30, 700)
  frame.ctx.textAlign = 'center'
  frame.ctx.textBaseline = 'middle'
  frame.ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
}

function iconButton(frame: Frame, id: string, x: number, y: number, glyph: 'gear' | 'sound-on' | 'sound-off' | 'back'): void {
  const rect = { x, y, w: 80, h: 80 }
  hot(frame, id, rect)
  const ctx = frame.ctx
  fillRound(ctx, rect, 28, 'rgba(255,248,241,0.92)')
  ctx.save()
  ctx.translate(x + 40, y + 40)
  ctx.strokeStyle = '#6B3A2A'
  ctx.fillStyle = '#6B3A2A'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (glyph === 'back') {
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(-8, 0)
    ctx.moveTo(-8, 0)
    ctx.lineTo(-1, -8)
    ctx.moveTo(-8, 0)
    ctx.lineTo(-1, 8)
    ctx.stroke()
  } else if (glyph === 'gear') {
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12)
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17)
      ctx.stroke()
    }
  } else if (glyph === 'sound-on') {
    ctx.beginPath()
    ctx.moveTo(-10, -4)
    ctx.lineTo(-2, -4)
    ctx.lineTo(6, -12)
    ctx.lineTo(6, 12)
    ctx.lineTo(-2, 4)
    ctx.lineTo(-10, 4)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(6, 0, 10, -0.7, 0.7)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-10, -4)
    ctx.lineTo(-2, -4)
    ctx.lineTo(6, -12)
    ctx.lineTo(6, 12)
    ctx.lineTo(-2, 4)
    ctx.lineTo(-10, 4)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(10, -8)
    ctx.lineTo(18, 8)
    ctx.stroke()
  }
  ctx.restore()
}

function dim(frame: Frame): void {
  frame.ctx.fillStyle = 'rgba(42, 24, 18, 0.46)'
  frame.ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  hot(frame, 'modal:block', { x: 0, y: 0, w: STAGE.w, h: STAGE.h })
}

function card(ctx: CanvasRenderingContext2D, rect: Rect): void {
  fillRound(ctx, { x: rect.x, y: rect.y + 8, w: rect.w, h: rect.h }, 32, 'rgba(120, 70, 48, 0.18)')
  fillRound(ctx, rect, 32, '#FFF8F1')
}

const SPAWN_MS = 360

export function spawnDelay(level: LevelDef, cell: CellPos): number {
  let sx = 0
  let sy = 0
  let count = 0
  for (const item of level.cells) {
    if (item.kind !== 'rat') continue
    sx += item.x
    sy += item.y
    count += 1
  }
  const n = Math.max(1, count)
  return Math.hypot(cell.x - sx / n, cell.y - sy / n) * 120
}

export function spawnSpan(level: LevelDef): number {
  let max = 0
  for (const cell of level.cells) max = Math.max(max, spawnDelay(level, cell))
  return max + SPAWN_MS
}

function appearScale(now: number, at: number, delay: number): number {
  const t = (now - at - delay) / SPAWN_MS
  if (t >= 1) return 1
  if (t <= 0) return 0
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export const CELEBRATE_STEP = 90

export function celebrateMs(cells: number): number {
  return Math.max(1, cells) * CELEBRATE_STEP + 380
}

function celebrateScale(now: number, at: number | undefined): number {
  if (at == null) return 1
  const age = now - at
  if (age < 0 || age > 620) return 1
  return 1 + Math.sin((age / 620) * Math.PI) * 0.38
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, at: number | undefined): void {
  if (at == null) return
  const age = now - at
  if (age < 0 || age > 640) return
  const t = age / 640
  ctx.save()
  ctx.strokeStyle = `rgba(255, 186, 64, ${(1 - t) * 0.95})`
  ctx.lineWidth = 8 * (1 - t) + 2
  ctx.beginPath()
  ctx.arc(x, y, size * (0.42 + t * 0.55), 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - t) * 0.9})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, size * (0.28 + t * 0.4), 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.35
    const dist = size * (0.2 + t * 0.72)
    ctx.fillStyle = i % 2 === 0 ? `rgba(255, 176, 48, ${1 - t})` : `rgba(255, 252, 240, ${1 - t})`
    ctx.beginPath()
    ctx.arc(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, 6 * (1 - t * 0.4), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function popScale(now: number, at: number | undefined): number {
  if (at == null) return 1
  const age = now - at
  if (age < 0 || age > 760) return 1
  const wave = Math.sin((age / 760) * Math.PI)
  return 1 + wave * 0.22
}

function drawHole(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const s = rect.w * 0.78
  const cx = rect.x + rect.w * 0.5
  const cy = rect.y + rect.h * 0.54
  ctx.fillStyle = '#D7A56C'
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.16, s * 0.46, s * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3A2418'
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.02, s * 0.28, s * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#120C09'
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.02, s * 0.16, s * 0.11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#6FA84A'
  ctx.lineWidth = Math.max(2.5, s * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.36, cy + s * 0.08)
  ctx.quadraticCurveTo(cx - s * 0.48, cy - s * 0.28, cx - s * 0.18, cy - s * 0.12)
  ctx.moveTo(cx + s * 0.22, cy + s * 0.06)
  ctx.quadraticCurveTo(cx + s * 0.46, cy - s * 0.32, cx + s * 0.12, cy - s * 0.08)
  ctx.stroke()
}

function drawCheese(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const s = rect.w * 0.72
  const cx = rect.x + rect.w * 0.5
  const cy = rect.y + rect.h * 0.52
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.2)
  ctx.fillStyle = '#F6C445'
  ctx.beginPath()
  ctx.moveTo(-s * 0.58, s * 0.42)
  ctx.lineTo(s * 0.62, s * 0.42)
  ctx.lineTo(s * 0.08, -s * 0.58)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#FFE58A'
  ctx.beginPath()
  ctx.moveTo(-s * 0.38, s * 0.22)
  ctx.lineTo(s * 0.12, s * 0.22)
  ctx.lineTo(-s * 0.06, -s * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#E09A1A'
  ctx.lineWidth = Math.max(2.5, s * 0.045)
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-s * 0.58, s * 0.42)
  ctx.lineTo(s * 0.62, s * 0.42)
  ctx.lineTo(s * 0.08, -s * 0.58)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(196, 122, 20, 0.85)'
  for (const [hx, hy, r] of [
    [-0.08, 0.08, 0.11],
    [0.22, 0.16, 0.07],
    [0.02, -0.22, 0.08],
  ] as const) {
    ctx.beginPath()
    ctx.arc(hx * s, hy * s, r * s, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawRock(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const cx = rect.x + rect.w * 0.5
  const cy = rect.y + rect.h * 0.54
  const s = rect.w * 0.36
  ctx.fillStyle = '#8D98A4'
  ctx.beginPath()
  ctx.moveTo(cx - s * 1.05, cy + s * 0.35)
  ctx.quadraticCurveTo(cx - s * 1.2, cy - s * 0.35, cx - s * 0.25, cy - s * 0.95)
  ctx.quadraticCurveTo(cx + s * 0.35, cy - s * 1.25, cx + s * 0.95, cy - s * 0.25)
  ctx.quadraticCurveTo(cx + s * 1.25, cy + s * 0.35, cx + s * 0.45, cy + s * 0.62)
  ctx.quadraticCurveTo(cx - s * 0.15, cy + s * 0.95, cx - s * 1.05, cy + s * 0.35)
  ctx.fill()
  ctx.fillStyle = '#C9D2DA'
  ctx.beginPath()
  ctx.ellipse(cx - s * 0.28, cy - s * 0.38, s * 0.32, s * 0.18, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#5C6670'
  ctx.lineWidth = Math.max(2, s * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.05, cy - s * 0.05)
  ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.12, cx + s * 0.08, cy + s * 0.38)
  ctx.stroke()
}

function traceRibbon(ctx: CanvasRenderingContext2D, centers: Array<{ x: number; y: number }>): void {
  ctx.beginPath()
  ctx.moveTo(centers[0].x, centers[0].y)
  for (let i = 1; i < centers.length - 1; i++) {
    const prev = centers[i - 1]
    const cur = centers[i]
    const next = centers[i + 1]
    const pull = 0.36
    ctx.lineTo(cur.x + (prev.x - cur.x) * pull, cur.y + (prev.y - cur.y) * pull)
    ctx.quadraticCurveTo(cur.x, cur.y, cur.x + (next.x - cur.x) * pull, cur.y + (next.y - cur.y) * pull)
  }
  const last = centers[centers.length - 1]
  ctx.lineTo(last.x, last.y)
}

function drawBoard(
  frame: Frame,
  level: LevelDef,
  path: CellPos[],
  hint: CellPos | null,
  area: Rect,
  opts: { interactive: boolean; shake: number; won: boolean; winAt: number; spawnAt: number; pops: Record<string, number> },
): void {
  const ctx = frame.ctx
  const geom = boardGeom(level, area)
  const ox = Math.sin(opts.shake * 24) * opts.shake * 10
  const visited = new Set(path.map((cell) => `${cell.x},${cell.y}`))
  const order = new Map(path.map((cell, index) => [`${cell.x},${cell.y}`, index]))
  const bursts: Array<{ x: number; y: number; size: number; at: number | undefined }> = []
  const ready = path.filter((cell) => appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell)) >= 0.98)
  ctx.save()
  ctx.translate(ox, 0)
  for (const cell of level.cells) {
    const born = appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell))
    if (born <= 0) continue
    const rect = cellRect(geom, cell)
    const key = `${cell.x},${cell.y}`
    if (opts.interactive && cell.kind === 'rat' && born > 0.45) hot(frame, `cell:${cell.x}:${cell.y}`, rect)
    const burstAt = opts.won && order.has(key) ? opts.winAt + (order.get(key) ?? 0) * CELEBRATE_STEP : undefined
    const bounce = popScale(frame.now, opts.pops[key]) * celebrateScale(frame.now, burstAt)
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(born * bounce, born * bounce)
    ctx.translate(-cx, -cy)
    ctx.save()
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.w * 0.22)
    ctx.shadowColor = 'rgba(90, 42, 24, 0.16)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 8
    const isStart = cell.x === level.start.x && cell.y === level.start.y
    const isEnd = cell.x === level.end.x && cell.y === level.end.y
    ctx.fillStyle = isStart ? '#E7C7A0' : isEnd ? '#FFF3C4' : '#FFF8F1'
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.clip()
    if (cell.kind === 'crate') {
      ctx.restore()
      drawRock(ctx, rect)
      ctx.restore()
      continue
    }
    if (isStart || isEnd) {
      ctx.restore()
      if (isStart) {
        const art = frame.assets.hole
        if (art && art.width > 0) {
          const pad = rect.w * 0.02
          paintHead(ctx, art, '#C9854A', rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2)
        } else drawHole(ctx, rect)
      } else drawCheese(ctx, rect)
      ctx.restore()
      bursts.push({ x: cx, y: cy, size: rect.w, at: burstAt })
      continue
    }
    const passed = visited.has(key)
    const sprite = passed ? frame.assets.angry[level.theme] : frame.assets.calm[level.theme]
    const pad = rect.w * 0.08
    paintHead(ctx, sprite, SPECIES_COLOR[level.theme], rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2)
    ctx.restore()
    ctx.restore()
    bursts.push({ x: cx, y: cy, size: rect.w, at: burstAt })
  }
  if (ready.length > 1) {
    const centers = ready.map((cell) => cellCenter(geom, cell))
    const width = Math.max(18, geom.cell * 0.22)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.save()
    ctx.shadowColor = 'rgba(120, 72, 48, 0.2)'
    ctx.shadowBlur = 8
    traceRibbon(ctx, centers)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)'
    ctx.lineWidth = width
    ctx.stroke()
    ctx.restore()
  }
  for (const burst of bursts) drawBurst(ctx, burst.x, burst.y, burst.size, frame.now, burst.at)
  if (hint) {
    const rect = cellRect(geom, hint)
    const pulse = 1 + Math.sin(frame.now / 160) * 0.04
    ctx.save()
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2)
    ctx.scale(pulse, pulse)
    ctx.strokeStyle = '#F0A202'
    ctx.lineWidth = 6
    roundRect(ctx, -rect.w / 2 - 6, -rect.h / 2 - 6, rect.w + 12, rect.h + 12, rect.w * 0.24)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawHome(frame: Frame): void {
  const ctx = frame.ctx
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.h)
  sky.addColorStop(0, '#FFF8F1')
  sky.addColorStop(0.42, '#FDE7D4')
  sky.addColorStop(1, '#F3C4A4')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  blob(ctx, 80, 180, 140, 90, 'rgba(255, 214, 176, 0.55)')
  blob(ctx, 640, 90, 160, 100, 'rgba(255, 186, 150, 0.4)')
  blob(ctx, 360, 1260, 480, 140, 'rgba(232, 164, 122, 0.35)')
  iconButton(frame, 'settings', 36, 36, 'gear')
  const head = frame.assets.calm.cream
  paintHead(ctx, head, SPECIES_COLOR.cream, 168, 108, 96, 96)
  ctx.fillStyle = '#5C3328'
  ctx.font = font(68, 800)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('捉鼠鼠', 278, 148)
  ctx.textAlign = 'center'
  ctx.font = font(26, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText('从鼠洞一笔连到奶酪', 360, 214)
  const sheet = { x: 40, y: 256, w: 640, h: 430 }
  fillRound(ctx, { x: sheet.x, y: sheet.y + 8, w: sheet.w, h: sheet.h }, 36, 'rgba(140, 78, 48, 0.12)')
  fillRound(ctx, sheet, 36, 'rgba(255, 250, 245, 0.94)')
  drawBoard(frame, LEVELS[0], [], null, { x: 70, y: 276, w: 580, h: 390 }, {
    interactive: false,
    shake: 0,
    won: false,
    winAt: 0,
    spawnAt: frame.now - 4000,
    pops: {},
  })
  const entries = [
    { id: 'rank:total', label: '总排行榜', mark: '总' },
    { id: 'rank:daily', label: '当日排行榜', mark: '日' },
    { id: 'dex', label: '鼠鼠收藏屋', mark: '藏' },
    { id: 'share', label: '分享给朋友', mark: '享' },
  ]
  entries.forEach((entry, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const rect = { x: 40 + col * 332, y: 716 + row * 124, w: 308, h: 108 }
    hot(frame, entry.id, rect)
    const pressed = frame.pressed === entry.id
    const y = rect.y + (pressed ? 3 : 0)
    if (!pressed) fillRound(ctx, { x: rect.x, y: rect.y + 6, w: rect.w, h: rect.h }, 28, 'rgba(166, 96, 62, 0.16)')
    fillRound(ctx, { x: rect.x, y, w: rect.w, h: rect.h }, 28, '#FFF8F1')
    fillRound(ctx, { x: rect.x + 18, y: y + 26, w: 56, h: 56 }, 18, '#F6D2B4')
    ctx.fillStyle = '#8A3E28'
    ctx.font = font(26, 800)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(entry.mark, rect.x + 46, y + 54)
    ctx.fillStyle = '#5C3328'
    ctx.font = font(28, 700)
    ctx.textAlign = 'left'
    ctx.fillText(entry.label, rect.x + 90, y + 54)
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = '#5C3328'
  ctx.font = font(26, 700)
  ctx.fillText(frame.save.finished ? '十五关都连完了' : `下一关是第 ${frame.save.level} 关`, 360, 992)
  ctx.font = font(22, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText(`已连成 ${frame.save.totalRats} 只`, 360, 1030)
  button(frame, 'start', { x: 80, y: 1076, w: 560, h: 108 }, frame.save.finished ? '再玩一次' : '开始游戏')
}

function drawPlay(frame: Frame, play: PlayView): void {
  const ctx = frame.ctx
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.h)
  sky.addColorStop(0, '#F8D7BE')
  sky.addColorStop(0.5, '#E7B08A')
  sky.addColorStop(1, '#C48462')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  blob(ctx, 90, 220, 180, 120, 'rgba(255, 236, 220, 0.28)')
  blob(ctx, 640, 980, 220, 140, 'rgba(140, 72, 48, 0.12)')
  iconButton(frame, 'settings', 28, 28, 'gear')
  iconButton(frame, 'sound', 612, 28, frame.save.sound ? 'sound-on' : 'sound-off')
  const timed = play.remaining != null
  const capsule = { x: timed ? 148 : 196, y: 32, w: timed ? 424 : 328, h: 76 }
  fillRound(ctx, { x: capsule.x, y: capsule.y + 5, w: capsule.w, h: capsule.h }, 38, 'rgba(120, 62, 36, 0.14)')
  fillRound(ctx, capsule, 38, '#FFF8F1')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.font = font(30, 800)
  ctx.fillStyle = '#4A2A22'
  if (timed && play.remaining != null) {
    ctx.fillText(`第 ${play.level.id} 关`, capsule.x + 128, capsule.y + 38)
    const urgent = play.remaining <= 5
    ctx.fillStyle = urgent ? '#D23B2E' : '#8A4B32'
    const pulse = urgent ? 1 + Math.sin(frame.now / 140) * 0.04 : 1
    ctx.save()
    ctx.translate(capsule.x + 310, capsule.y + 38)
    ctx.scale(pulse, pulse)
    ctx.font = font(30, 800)
    ctx.fillText(formatTime(play.remaining), 0, 0)
    ctx.restore()
  } else {
    ctx.fillText(`第 ${play.level.id} 关`, capsule.x + capsule.w / 2, capsule.y + 38)
  }
  const geom = boardGeom(play.level, PLAY_AREA)
  let minY = Infinity
  let maxY = -Infinity
  for (const cell of play.level.cells) {
    minY = Math.min(minY, cell.y)
    maxY = Math.max(maxY, cell.y)
  }
  const rows = maxY - minY + 1
  const gridBottom = geom.originY + rows * (geom.cell + geom.gap) - geom.gap
  const tray = { x: 24, y: 128, w: 672, h: gridBottom - 128 + 108 }
  fillRound(ctx, { x: tray.x, y: tray.y + 8, w: tray.w, h: tray.h }, 40, 'rgba(120, 64, 40, 0.16)')
  fillRound(ctx, tray, 40, 'rgba(255, 248, 241, 0.72)')
  drawBoard(frame, play.level, play.path, play.hintCell, PLAY_AREA, {
    interactive: !play.won && !frame.settings && !frame.reward && !frame.timeout && !frame.stuck && !play.showDrop,
    shake: play.shake,
    won: play.won,
    winAt: play.winAt,
    spawnAt: play.spawnAt,
    pops: play.pops,
  })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(24, 700)
  ctx.fillStyle = '#6B3A2A'
  ctx.fillText(`已连 ${play.path.length} / ${ratCount(play.level)}`, 360, gridBottom + 40)
  ctx.font = font(20, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText(play.level.tip || '横竖相连，经过的鼠鼠会生气', 360, gridBottom + 74)
  ctx.font = font(16, 600)
  ctx.fillStyle = '#A56A52'
  ctx.fillText('看广告', 190, 1094)
  ghostButton(frame, 'hint', { x: 40, y: 1110, w: 300, h: 100 }, play.hintLeft > 0 ? `提示 ${play.hintLeft}` : '提示')
  button(frame, 'reset', { x: 380, y: 1110, w: 300, h: 100 }, '重置')
}

function drawDex(frame: Frame): void {
  const ctx = frame.ctx
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.h)
  sky.addColorStop(0, '#FFF9F3')
  sky.addColorStop(1, '#F6DCCB')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  iconButton(frame, 'back', 28, 36, 'back')
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(44, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('鼠鼠收藏屋', 360, 78)
  const found = SPECIES_IDS.filter((id) => frame.save.dex[id] > 0).length
  ctx.font = font(24, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText(`已遇到 ${found} / ${SPECIES_IDS.length} 种`, 360, 132)
  SPECIES_IDS.forEach((id, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const rect = { x: 42 + col * 220, y: 190 + row * 340, w: 200, h: 310 }
    hot(frame, `dex:${id}`, rect)
    fillRound(ctx, rect, 28, '#FFF8F1')
    const count = frame.save.dex[id]
    const sprite = count > 0 ? frame.assets.calm[id] : frame.assets.shadow[id]
    paintHead(ctx, sprite, count > 0 ? SPECIES_COLOR[id] : '#CDB5A6', rect.x + 18, rect.y + 24, 164, 180)
    ctx.fillStyle = '#6B3A2A'
    ctx.font = font(26, 700)
    ctx.textAlign = 'center'
    ctx.fillText(count > 0 ? SPECIES_NAME[id] : '？？？', rect.x + rect.w / 2, rect.y + 236)
    ctx.font = font(22, 500)
    ctx.fillStyle = '#8A5644'
    ctx.fillText(count > 0 ? `×${count}` : '未遇到', rect.x + rect.w / 2, rect.y + 272)
  })
}

function drawRank(frame: Frame): void {
  const ctx = frame.ctx
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.h)
  sky.addColorStop(0, '#FFF9F3')
  sky.addColorStop(1, '#F6DCCB')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  iconButton(frame, 'back', 28, 36, 'back')
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(frame.rankTab === 'total' ? '总排行榜' : '当日排行榜', 360, 78)
  const tabs: Array<{ id: string; label: string; on: boolean }> = [
    { id: 'tab:total', label: '总榜', on: frame.rankTab === 'total' },
    { id: 'tab:daily', label: '日榜', on: frame.rankTab === 'daily' },
  ]
  tabs.forEach((tab, index) => {
    const rect = { x: 180 + index * 180, y: 130, w: 160, h: 64 }
    hot(frame, tab.id, rect)
    fillRound(ctx, rect, 32, tab.on ? '#E36B3C' : '#FFF8F1')
    ctx.fillStyle = tab.on ? '#FFFDF8' : '#6B3A2A'
    ctx.font = font(28, 700)
    ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + rect.h / 2)
  })
  fillRound(ctx, { x: 70, y: 230, w: 580, h: 250 }, 32, '#FFF8F1')
  ctx.fillStyle = '#8A5644'
  ctx.font = font(24, 500)
  ctx.fillText('我的成绩', 360, 280)
  ctx.fillStyle = '#E36B3C'
  ctx.font = font(84, 800)
  const score = frame.rankTab === 'total' ? frame.save.totalRats : frame.save.dailyRats
  ctx.fillText(String(score), 360, 360)
  ctx.fillStyle = '#8A5644'
  ctx.font = font(22, 500)
  ctx.fillText(frame.rankTab === 'total' ? '累计连成的只数，重开不计' : '每天 0 点（上海时间）重置', 360, 430)
  ctx.font = font(26, 700)
  ctx.fillStyle = '#6B3A2A'
  ctx.fillText('好友', 360, 540)
  if (frame.shared) {
    try {
      ctx.drawImage(frame.shared, 60, 570, 600, 640)
    } catch {
      ctx.font = font(24, 500)
      ctx.fillStyle = '#8A5644'
      ctx.fillText('好友榜在微信小游戏里查看', 360, 640)
    }
  } else {
    ctx.font = font(24, 500)
    ctx.fillStyle = '#8A5644'
    ctx.fillText('好友榜在微信小游戏里查看', 360, 640)
    ctx.fillText('这里先记下你自己的只数', 360, 684)
  }
}

function drawSettings(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 60, y: 280, w: 600, h: frame.settingsFromPlay ? 700 : 600 }
  card(ctx, rect)
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('设置', 360, rect.y + 70)
  const sound = { x: 110, y: rect.y + 130, w: 500, h: 88 }
  hot(frame, 'settings:sound', sound)
  fillRound(ctx, sound, 24, '#F8EBE1')
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(30, 700)
  ctx.textAlign = 'left'
  ctx.fillText('声音', sound.x + 28, sound.y + 44)
  ctx.textAlign = 'right'
  ctx.fillStyle = frame.save.sound ? '#E36B3C' : '#B08978'
  ctx.fillText(frame.save.sound ? '开' : '关', sound.x + sound.w - 28, sound.y + 44)
  const rules = ['从鼠洞一笔连到奶酪', '只能横着或竖着，每只经过一次', '可以松手，再从停笔处继续']
  ctx.textAlign = 'left'
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(28, 600)
  rules.forEach((line, index) => {
    ctx.fillText(line, 120, rect.y + 280 + index * 56)
  })
  if (frame.settingsFromPlay) {
    ghostButton(frame, 'settings:home', { x: 110, y: rect.y + 470, w: 500, h: 88 }, '回主页')
    button(frame, 'settings:close', { x: 110, y: rect.y + 580, w: 500, h: 88 }, '关闭', '#6B3A2A')
  } else {
    button(frame, 'settings:close', { x: 110, y: rect.y + 470, w: 500, h: 88 }, '关闭', '#6B3A2A')
  }
}

function drawReward(frame: Frame): void {
  if (!frame.reward) return
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 390, w: 580, h: 460 }
  card(ctx, rect)
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(36, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(frame.reward.title, 360, rect.y + 90)
  ctx.font = font(26, 500)
  ctx.fillStyle = '#8A5644'
  wrapText(ctx, frame.notice, 500).forEach((line, index) => ctx.fillText(line, 360, rect.y + 160 + index * 38))
  button(frame, 'reward:ok', { x: 120, y: rect.y + 270, w: 480, h: 88 }, frame.reward.confirm)
  ghostButton(frame, 'reward:cancel', { x: 120, y: rect.y + 374, w: 480, h: 72 }, '取消')
}

function drawFireworks(ctx: CanvasRenderingContext2D, now: number, avoid?: Rect): void {
  const bursts = [
    { x: 120, y: 190, hue: 28, phase: 0, r: 210 },
    { x: 600, y: 160, hue: 350, phase: 420, r: 190 },
    { x: 80, y: 720, hue: 48, phase: 180, r: 180 },
    { x: 640, y: 800, hue: 200, phase: 640, r: 200 },
    { x: 360, y: 120, hue: 16, phase: 860, r: 170 },
    { x: 180, y: 1020, hue: 320, phase: 260, r: 160 },
    { x: 560, y: 1080, hue: 42, phase: 980, r: 180 },
  ]
  for (const burst of bursts) {
    const cycle = 1500
    const age = (now + burst.phase) % cycle
    const t = age / cycle
    const alpha = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88)
    if (t < 0.18) {
      ctx.fillStyle = `hsla(${burst.hue}, 100%, 72%, ${(0.18 - t) * 3})`
      ctx.beginPath()
      ctx.arc(burst.x, burst.y, 16, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2 + burst.phase * 0.002
      const dist = t * burst.r * (0.75 + (i % 3) * 0.12)
      const x = burst.x + Math.cos(ang) * dist
      const y = burst.y + Math.sin(ang) * dist + t * t * 40
      if (avoid && x > avoid.x && x < avoid.x + avoid.w && y > avoid.y && y < avoid.y + avoid.h) continue
      ctx.strokeStyle = `hsla(${burst.hue + (i % 4) * 14}, 95%, 62%, ${alpha})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - Math.cos(ang) * 14, y - Math.sin(ang) * 14)
      ctx.stroke()
      ctx.fillStyle = `hsla(${burst.hue + (i % 4) * 14}, 95%, ${i % 2 ? 70 : 58}%, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, (i % 3 === 0 ? 7 : 4.5) * (1 - t * 0.35), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (let i = 0; i < 28; i++) {
    const fall = (now * 0.12 + i * 90) % 1280
    const x = (i * 97 + Math.sin(now / 280 + i) * 24) % 720
    if (avoid && x > avoid.x && x < avoid.x + avoid.w && fall > avoid.y && fall < avoid.y + avoid.h) continue
    const spin = now / 180 + i
    ctx.save()
    ctx.translate(x, fall)
    ctx.rotate(spin)
    ctx.fillStyle = `hsla(${(i * 37) % 360}, 90%, 62%, 0.9)`
    ctx.fillRect(-5, -2.5, 10, 5)
    ctx.restore()
  }
}

function drawDrop(frame: Frame, play: PlayView): void {
  dim(frame)
  const ctx = frame.ctx
  drawFireworks(ctx, frame.now)
  const species = play.dropSpecies
  const tall = species ? (play.dropBoosted ? 760 : 880) : play.dropBoosted ? 560 : 680
  const rect = { x: 70, y: species ? 200 : 300, w: 580, h: tall }
  const age = Math.max(0, frame.now - play.dropAt)
  const intro = Math.min(1, age / 420)
  const scale = 0.86 + 0.14 * (1 - (1 - intro) ** 3) + Math.sin(Math.min(1, intro) * Math.PI) * 0.035
  ctx.save()
  ctx.translate(360, rect.y + rect.h / 2)
  ctx.scale(scale, scale)
  ctx.translate(-360, -(rect.y + rect.h / 2))
  card(ctx, rect)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#E36B3C'
  ctx.font = font(54, 800)
  ctx.fillText('连成了！', 360, rect.y + 78)
  if (!species) {
    ctx.fillStyle = '#8A5644'
    ctx.font = font(28, 600)
    ctx.fillText('这次没遇到鼠鼠', 360, rect.y + 150)
    ctx.font = font(24, 500)
    ctx.fillText('口袋还是空的，下一关再碰碰', 360, rect.y + 198)
    let y = rect.y + 270
    if (!play.dropBoosted) {
      ghostButton(frame, 'drop:boost', { x: 120, y, w: 480, h: 84 }, '看广告碰碰运气')
      y += 104
    }
    button(frame, 'drop:next', { x: 120, y, w: 480, h: 92 }, play.level.id < LEVEL_COUNT ? '下一关' : '回主页')
    if (play.level.id < LEVEL_COUNT) ghostButton(frame, 'drop:home', { x: 120, y: y + 108, w: 480, h: 80 }, '回主页')
  ctx.restore()
  drawFireworks(ctx, frame.now + 260, { x: rect.x + 36, y: rect.y + 28, w: rect.w - 72, h: rect.h - 56 })
  return
  }
  const count = frame.save.dex[species]
  ctx.fillStyle = '#8A5644'
  ctx.font = font(26, 600)
  ctx.fillText(count <= 1 ? '新朋友和你一起到了' : '又遇到一只鼠鼠', 360, rect.y + 132)
  const headAge = Math.max(0, age - 120)
  const headScale = Math.min(1, headAge / 360)
  const headPop = headScale === 0 ? 0 : 0.7 + 0.3 * (1 - (1 - headScale) ** 3) + Math.sin(headScale * Math.PI) * 0.08
  ctx.save()
  ctx.translate(360, rect.y + 268)
  ctx.scale(headPop, headPop)
  paintHead(ctx, frame.assets.calm[species], SPECIES_COLOR[species], -110, -110, 220, 220)
  ctx.restore()
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.fillText(SPECIES_NAME[species], 360, rect.y + 410)
  let y = rect.y + 470
  if (!play.dropBoosted) {
    ghostButton(frame, 'drop:boost', { x: 120, y, w: 480, h: 84 }, '看广告提高稀有率')
    y += 104
  }
  button(frame, 'drop:next', { x: 120, y, w: 480, h: 92 }, play.level.id < LEVEL_COUNT ? '下一关' : '回主页')
  y += 108
  if (play.level.id < LEVEL_COUNT) ghostButton(frame, 'drop:home', { x: 120, y, w: 480, h: 80 }, '回主页')
  ctx.restore()
  drawFireworks(ctx, frame.now + 260, { x: rect.x + 36, y: rect.y + 28, w: rect.w - 72, h: rect.h - 56 })
}

function drawTimeout(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 390, w: 580, h: 460 }
  card(ctx, rect)
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('时间到了', 360, rect.y + 90)
  ctx.font = font(26, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText(frame.extraUsed ? '这关的加时已经用过' : '可以加 30 秒，或重新开始', 360, rect.y + 160)
  if (!frame.extraUsed) button(frame, 'timeout:ad', { x: 120, y: rect.y + 220, w: 480, h: 88 }, '看广告加时')
  ghostButton(frame, 'timeout:restart', { x: 120, y: rect.y + (frame.extraUsed ? 250 : 330), w: 480, h: 84 }, '重新开始')
}

function drawStuck(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 400, w: 580, h: 440 }
  card(ctx, rect)
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('走不通了', 360, rect.y + 90)
  ctx.font = font(26, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText('可以撤回一步，或重新开始', 360, rect.y + 160)
  button(frame, 'stuck:undo', { x: 120, y: rect.y + 220, w: 480, h: 88 }, '撤回一步')
  ghostButton(frame, 'stuck:reset', { x: 120, y: rect.y + 326, w: 480, h: 80 }, '重新开始')
}

function drawDetail(frame: Frame, species: Species): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 80, y: 280, w: 560, h: 680 }
  card(ctx, rect)
  paintHead(ctx, frame.assets.calm[species], SPECIES_COLOR[species], 170, rect.y + 50, 380, 360)
  ctx.fillStyle = '#6B3A2A'
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(SPECIES_NAME[species], 360, rect.y + 450)
  ctx.font = font(26, 500)
  ctx.fillStyle = '#8A5644'
  ctx.fillText(`遇到 ${frame.save.dex[species]} 次`, 360, rect.y + 510)
  button(frame, 'detail:close', { x: 140, y: rect.y + 560, w: 440, h: 88 }, '关闭', '#6B3A2A')
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawToast(frame: Frame, text: string): void {
  const ctx = frame.ctx
  ctx.font = font(26, 600)
  const width = Math.min(560, ctx.measureText(text).width + 64)
  const rect = { x: (720 - width) / 2, y: 150, w: width, h: 64 }
  fillRound(ctx, rect, 32, 'rgba(62, 34, 24, 0.88)')
  ctx.fillStyle = '#FFF8F1'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 360, rect.y + 32)
}

export function render(frame: Frame): void {
  if (!frame.assets.ready) {
    frame.ctx.fillStyle = '#F8E7D8'
    frame.ctx.fillRect(0, 0, STAGE.w, STAGE.h)
    frame.ctx.fillStyle = '#6B3A2A'
    frame.ctx.font = font(36, 700)
    frame.ctx.textAlign = 'center'
    frame.ctx.textBaseline = 'middle'
    frame.ctx.fillText('鼠鼠赶来了…', 360, 640)
    return
  }
  if (frame.screen === 'home') drawHome(frame)
  else if (frame.screen === 'play' && frame.play) drawPlay(frame, frame.play)
  else if (frame.screen === 'dex') drawDex(frame)
  else drawRank(frame)
  if (frame.detail && frame.screen === 'dex') drawDetail(frame, frame.detail)
  if (frame.settings) drawSettings(frame)
  if (frame.stuck && !frame.reward) drawStuck(frame)
  if (frame.timeout && !frame.reward) drawTimeout(frame)
  if (frame.reward) drawReward(frame)
  if (frame.play?.showDrop && frame.screen === 'play') drawDrop(frame, frame.play)
  if (frame.toast) drawToast(frame, frame.toast)
}
