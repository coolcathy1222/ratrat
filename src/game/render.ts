import { LEVEL_COUNT, type CellPos, type LevelDef } from '../core/levels'
import { formatTime, ratCount } from '../core/rules'
import { SPECIES_COLOR, SPECIES_IDS, SPECIES_NAME, SPECIES_PROFILE, type Species } from '../core/species'
import type { SaveData } from '../core/progress'
import type { AssetBook, Sprite } from './assets'
import { PLAY_AREA, STAGE, boardGeom, cellCenter, cellRect, type Rect } from './geom'

import { ink, muted, accent, paper, edge, berry, label, mark, flower, page, rule, type Mark } from './stationery'

import { GOODS, GOOD_IDS, TOOL, type Heist, type Haul } from '../core/heist'
import { lootArt } from './loot-art'
import { nightSky, pulsePhase, tileSparks, waveStep } from './celebration'

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
  plan: Heist
  haul: Haul | null
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
  screen: 'home' | 'play' | 'dex' | 'rank' | 'warehouse'
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

function surface(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string, border = edge, depth = 4): void {
  fillRound(ctx, { ...rect, h: rect.h + depth }, radius, border)
  fillRound(ctx, { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 }, radius - 2, color)
}

function stitches(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.setLineDash([7, 7])
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.stroke()
  ctx.restore()
}

function action(frame: Frame, id: string, rect: Rect, text: string, primary: boolean): void {
  hot(frame, id, rect)
  const pressed = frame.pressed === id
  const face = { ...rect, y: rect.y + (pressed ? 4 : 0) }
  surface(frame.ctx, face, 24, primary ? accent : paper, primary ? ink : edge, pressed ? 0 : 4)
  if (primary) stitches(frame.ctx, {x: face.x + 8, y: face.y + 8, w: face.w - 16, h: face.h - 16}, 18, '#D99B72')
  label(frame.ctx, text, face.x + face.w / 2, face.y + face.h / 2, primary ? 32 : 28, primary ? paper : ink)
}

function button(frame: Frame, id: string, rect: Rect, text: string): void { action(frame, id, rect, text, true) }
function ghostButton(frame: Frame, id: string, rect: Rect, text: string): void { action(frame, id, rect, text, false) }

function iconButton(frame: Frame, id: string, x: number, y: number, glyph: 'gear' | 'sound-on' | 'sound-off' | 'back'): void {
  const rect = { x, y, w: 80, h: 80 }
  hot(frame, id, rect)
  const ctx = frame.ctx
  const offset = frame.pressed === id ? 3 : 0
  surface(ctx, { ...rect, y: y + offset }, 27, paper, edge, offset ? 0 : 3)
  ctx.save()
  ctx.translate(x + 40, y + 40 + offset)
  ctx.scale(1.18, 1.18)
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
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
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16
      const radius = step % 4 < 2 ? 15 : 12
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius
      if (step === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = paper
    ctx.beginPath()
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2)
    ctx.fill()
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
  frame.ctx.fillStyle = 'rgba(35, 51, 41, 0.55)'
  frame.ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  hot(frame, 'modal:block', { x: 0, y: 0, w: STAGE.w, h: STAGE.h })
}

function card(ctx: CanvasRenderingContext2D, rect: Rect): void {
  surface(ctx, rect, 34, paper, '#CBAE90', 7)
  stitches(ctx, { x: rect.x + 10, y: rect.y + 10, w: rect.w - 20, h: rect.h - 20 }, 26, '#DECAAB')
  fillRound(ctx, {x: 312, y: rect.y - 20, w: 96, h: 42}, 16, accent)
  flower(ctx, 360, rect.y, 14)
}

const SPAWN_MS = 490

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
  return Math.hypot(cell.x - sx / n, cell.y - sy / n) * 148
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
  const c1 = 2.0
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
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
  const order = new Map(path.map((cell, index) => [`${cell.x},${cell.y}`, index]))
  const bursts: Array<{ x: number; y: number; phase: number; seed: number }> = []
  const step = waveStep(path.length)
  const ready = path.filter((cell) => appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell)) >= 0.98)
  ctx.save()
  ctx.translate(ox, 0)
  if (ready.length > 1) {
    const centers = ready.map((cell) => cellCenter(geom, cell))
    const width = Math.max(18, geom.cell * 0.22)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.save()
    ctx.globalAlpha = 1
    ctx.shadowColor = 'rgba(120, 72, 48, 0.2)'
    ctx.shadowBlur = 3
    traceRibbon(ctx, centers)
    ctx.strokeStyle = '#FFFADE'
    ctx.lineWidth = width
    ctx.stroke()
    ctx.strokeStyle = '#B9664C'
    ctx.lineWidth = width * .48
    ctx.stroke()
    ctx.restore()
  }
  for (const cell of level.cells) {
    const born = appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell))
    if (born <= 0) continue
    const rect = cellRect(geom, cell)
    const key = `${cell.x},${cell.y}`
    if (opts.interactive && cell.kind === 'rat' && born > 0.45) hot(frame, `cell:${cell.x}:${cell.y}`, rect)
    const index = order.get(key)
    const at = opts.won && index != null ? opts.winAt + index * step : opts.pops[key]
    const phase = index != null ? pulsePhase(frame.now, at, opts.won) : -1
    const lift = phase < 0 ? 0 : Math.sin(Math.PI * phase) * (1 - phase)
    const spring = phase < 0 ? 0 : Math.sin(phase * Math.PI * 2) * (1 - phase)
    const seed = cell.x * 7 + cell.y * 11
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    ctx.save()
    const settling = Math.max(0, 1 - born)
    ctx.globalAlpha = Math.min(1, born * 1.6)
    ctx.translate(cx, cy + settling * rect.h * .32 - lift * rect.h * (opts.won ? .04 : .14))
    ctx.rotate((settling * .14 + (opts.won ? 0 : lift * .11)) * (seed % 2 ? 1 : -1))
    if (opts.won) ctx.scale(born * (1 + lift * .13), born * (1 + lift * .13))
    else ctx.scale(born * (1 - spring * .08), born * (1 + spring * .15))
    ctx.translate(-cx, -cy)
    ctx.save()
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.w * 0.22)
    ctx.shadowColor = 'rgba(90, 42, 24, 0.16)'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 3
    const isStart = cell.x === level.start.x && cell.y === level.start.y
    const isEnd = cell.x === level.end.x && cell.y === level.end.y
    const revealed = opts.won && at != null && frame.now >= at
    ctx.fillStyle = revealed ? (phase >= 0 ? '#DBECA6' : '#EEF1CF') : isStart ? '#E7C79B' : isEnd ? '#F8DF93' : index != null ? '#FFF1C9' : paper
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.clip()
    if (index != null) {
      const inset = 2.5
      roundRect(ctx, rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2, rect.w * .19)
      ctx.strokeStyle = revealed ? '#82A254' : '#C77842'
      ctx.lineWidth = Math.max(2, rect.w * .047)
      ctx.stroke()
    } else {
      stitches(ctx, {x: rect.x + 4, y: rect.y + 4, w: rect.w - 8, h: rect.h - 8}, rect.w * .18, '#D2CEAD')
    }
    if (cell.kind === 'crate') {
      ctx.restore()
      drawRock(ctx, rect)
      ctx.restore()
      continue
    }
    const pickup = frame.play!.plan.cells[key]
    const who = isStart ? frame.play!.plan.thief : pickup?.kind === 'guest' ? pickup.id : null
    if (who) {
      paintHead(ctx, frame.assets.calm[who], SPECIES_COLOR[who], rect.x+4, rect.y+3, rect.w-8, rect.h-8)
      if (!isStart) label(ctx, '★', rect.x + rect.w * .78, rect.y + rect.h * .24, rect.w * .24, berry)
    } else if (isEnd) {
      if (frame.assets.hole) paintHead(ctx, frame.assets.hole, ink, rect.x+4,rect.y+4,rect.w-8,rect.h-8)
      else drawHole(ctx, rect)
    } else if (pickup) {
      const atlas = revealed ? frame.assets.scenes.supplies : frame.assets.scenes.suppliesPlain
      lootArt(ctx, atlas, pickup.kind === 'good' ? pickup.id : 'lens', cx, cy, rect.w * .88)
    }
    ctx.restore()
    ctx.restore()
    if (phase >= 0) bursts.push({ x: cx, y: cy - lift * rect.h * .2, phase, seed })
  }
  for (const burst of bursts) tileSparks(ctx, burst.x, burst.y, geom.cell, burst.phase, burst.seed, opts.won)
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

function drawHome(frame: Frame): void {
  const ctx = frame.ctx
  page(ctx)
  fillRound(ctx, {x: 36, y: 32, w: 58, h: 58}, 20, accent)
  mark(ctx, 'paw', 65, 62, 1.12, paper)
  label(ctx, '田野行动小分队', 108, 48, 24, ink, 'left')
  label(ctx, 'FIELD SQUAD', 109, 78, 16, muted, 'left')
  iconButton(frame, 'settings', 604, 22, 'gear')
  rule(ctx, 36, 116, 684)
  label(ctx, '鼠鼠大作战', 38, 164, 72, ink, 'left', 900)
  label(ctx, '一笔收齐补给，带小队回家。', 42, 232, 25, muted, 'left', 500)
  ctx.save()
  ctx.translate(594, 166)
  ctx.rotate(-.10)
  fillRound(ctx, {x: -72, y: -31, w: 144, h: 62}, 14, '#EAD2AB')
  stitches(ctx, {x: -67, y: -26, w: 134, h: 52}, 10, '#B99469')
  label(ctx, '一笔益智', 0, 0, 24, '#77563D')
  ctx.restore()

  surface(ctx, {x: 36, y: 266, w: 648, h: 457}, 20, paper)
  if (frame.assets.scenes.team) {
    ctx.save()
    roundRect(ctx, 46, 276, 628, 405, 13)
    ctx.clip()
    fillRound(ctx,{x:46,y:276,w:628,h:405},13,'#FBEDD6')
    paintHead(ctx,frame.assets.scenes.team,paper,46,276,628,405)
    ctx.restore()
  } else {
    SPECIES_IDS.forEach((id, index) => paintHead(ctx, frame.assets.calm[id], SPECIES_COLOR[id],
      60 + (index % 3) * 202, 280 + Math.floor(index / 3) * 188, 192, 178))
  }
  mark(ctx, 'sun', 72, 702, .76, berry)
  label(ctx, '出发前，先拍张合照', 98, 701, 22, ink, 'left')
  label(ctx, 'FIELD ALBUM    /    01', 655, 701, 17, muted, 'right')
  button(frame, 'start', {x: 36, y: 744, w: 648, h: 96}, frame.save.finished ? '再玩一次' : frame.save.level > 1 ? '继续游戏' : '开始游戏')
  mark(ctx, 'arrow', 635, frame.pressed === 'start' ? 796 : 792, 1.15, paper)
  label(ctx, frame.save.finished ? '全部关卡已完成' : `第 ${frame.save.level} 关  /  共 ${LEVEL_COUNT} 关`, 42, 877, 22, muted, 'left')
  label(ctx, `已探索 ${frame.save.totalRats} 格`, 676, 877, 22, muted, 'right')
  rule(ctx, 36, 914, 684)
  label(ctx, '小队营地', 40, 955, 32, ink, 'left')
  const entries: Array<[string, string, Mark, string, string]> = [
    ['rank:total', '总排行榜', 'flag', '#ECD5AB', 'RANKING'], ['warehouse', '战利品仓库', 'sun', '#F0D0B7', 'STORAGE'],
    ['dex', '鼠鼠图鉴', 'book', '#D5DFBA', 'COLLECTION'], ['share', '分享给朋友', 'letter', '#D5E1D7', 'POST OFFICE'],
  ]
  entries.forEach(([id, title, icon, tint, caption], index) => {
    const rect = { x: 36 + index % 2 * 333, y: 993 + Math.floor(index / 2) * 112, w: 315, h: 94 }
    hot(frame, id, rect)
    const top = rect.y + (frame.pressed === id ? 3 : 0)
    surface(ctx, {...rect, y: top}, 18, paper, edge, frame.pressed === id ? 0 : 3)
    fillRound(ctx, {x: rect.x + 16, y: top + 18, w: 58, h: 58}, 20, tint)
    mark(ctx, icon, rect.x + 45, top + 47)
    label(ctx, title, rect.x + 91, top + 35, 26, ink, 'left')
    label(ctx, caption, rect.x + 92, top + 66, 15, muted, 'left')
  })
  flower(ctx, 360, 1243, 14, '#C6CDA8')
}

function drawPlay(frame: Frame, play: PlayView): void {
  const ctx = frame.ctx
  page(ctx)
  iconButton(frame, 'settings', 36, 32, 'gear')
  iconButton(frame, 'sound', 604, 32, frame.save.sound ? 'sound-on' : 'sound-off')
  label(ctx, 'F I E L D   M I S S I O N', 360, 46, 17, muted)
  label(ctx, `第 ${play.level.id} 关`, 360, 94, 42)
  const tray = {x: 22, y: 151, w: 676, h: 782}
  surface(ctx, tray, 32, '#DBDABA', '#B2AE8E')
  stitches(ctx, {x: 31, y: 160, w: 658, h: 764}, 25, '#FFF2D7')
  mark(ctx, 'flag', 65, 202, .9)
  label(ctx, '补给路线', 94, 202, 25, ink, 'left')
  const remaining = play.remaining
  label(ctx, remaining != null ? `倒计时  ${formatTime(remaining)}` : '自由探索', 654, 202, 23, remaining != null && remaining <= 5 ? berry : ink, 'right')
  rule(ctx, 54, 234, 666, '#BCB79A')

  drawBoard(frame, play.level, play.path, play.hintCell, PLAY_AREA, {
    interactive: !play.won && !frame.settings && !frame.reward && !frame.timeout && !frame.stuck && !play.showDrop,
    shake: play.shake,
    won: play.won,
    winAt: play.winAt,
    spawnAt: play.spawnAt,
    pops: play.pops,
  })
  const total = ratCount(play.level)
  label(ctx, `已连 ${play.path.length} / ${total}`, 40, 977, 26, ink, 'left')
  fillRound(ctx, {x: 268, y: 970, w: 412, h: 16}, 8, '#E3D0B6')
  if (play.path.length) fillRound(ctx, {x: 268, y: 970, w: 412 * play.path.length / total, h: 16}, 8, accent)
  label(ctx, play.level.tip || '一笔扫齐宝物，最后进鼠洞', 360, 1044, 24, muted, 'center', 500)
  ghostButton(frame, 'hint', { x: 36, y: 1110, w: 314, h: 96 }, `提示 ${play.hintLeft} · ${frame.save.lenses ? '探路镜' : '广告'}`)
  button(frame, 'reset', { x: 370, y: 1110, w: 314, h: 96 }, '重置')
}

function drawDex(frame: Frame): void {
  const ctx = frame.ctx
  page(ctx)
  iconButton(frame, 'back', 28, 36, 'back')
  ctx.fillStyle = ink
  ctx.font = font(44, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('鼠鼠图鉴', 360, 78)
  const found = SPECIES_IDS.filter((id) => frame.save.dex[id] > 0).length
  ctx.font = font(24, 500)
  ctx.fillStyle = muted
  ctx.fillText(`已遇到 ${found} / ${SPECIES_IDS.length} 种`, 360, 132)
  SPECIES_IDS.forEach((id, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const rect = { x: 42 + col * 220, y: 190 + row * 340, w: 200, h: 310 }
    hot(frame, `dex:${id}`, rect)
    surface(ctx, rect, 24, paper)
    const count = frame.save.dex[id]
    const sprite = count > 0 ? frame.assets.calm[id] : frame.assets.shadow[id]
    label(ctx, `NO. 0${index + 1}`, rect.x + 18, rect.y + 26, 16, muted, 'left')
    fillRound(ctx, { x: rect.x + 14, y: rect.y + 47, w: 172, h: 158 }, 18, count ? '#EBDEC4' : '#EFE2CD')
    paintHead(ctx, sprite, count > 0 ? SPECIES_COLOR[id] : '#CDB5A6', rect.x + 25, rect.y + 55, 150, 145)
    ctx.fillStyle = ink
    ctx.font = font(26, 700)
    ctx.textAlign = 'center'
    ctx.fillText(count > 0 ? SPECIES_NAME[id] : '？？？', rect.x + rect.w / 2, rect.y + 236)
    ctx.font = font(22, 500)
    ctx.fillStyle = muted
    ctx.fillText(count > 0 ? '查看小传 ›' : '未遇到', rect.x + rect.w / 2, rect.y + 272)
  })
}

function drawRank(frame: Frame): void {
  const ctx = frame.ctx
  page(ctx)
  iconButton(frame, 'back', 28, 36, 'back')
  ctx.fillStyle = ink
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
    fillRound(ctx, rect, 32, tab.on ? accent : paper)
    ctx.fillStyle = tab.on ? '#FFFDF8' : ink
    ctx.font = font(28, 700)
    ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + rect.h / 2)
  })
  surface(ctx, { x: 70, y: 230, w: 580, h: 250 }, 28, paper)
  ctx.fillStyle = muted
  ctx.font = font(24, 500)
  ctx.fillText('我的成绩', 360, 280)
  ctx.fillStyle = accent
  ctx.font = font(84, 800)
  const score = frame.rankTab === 'total' ? frame.save.totalRats : frame.save.dailyRats
  ctx.fillText(String(score), 360, 360)
  ctx.fillStyle = muted
  ctx.font = font(22, 500)
  ctx.fillText(frame.rankTab === 'total' ? '累计走过的格数' : '每天 0 点（上海时间）重置', 360, 430)
  ctx.font = font(26, 700)
  ctx.fillStyle = ink
  ctx.fillText('好友', 360, 540)
  if (frame.shared) {
    try {
      ctx.drawImage(frame.shared, 60, 570, 600, 640)
    } catch {
      ctx.font = font(24, 500)
      ctx.fillStyle = muted
      ctx.fillText('好友榜在微信小游戏里查看', 360, 640)
    }
  } else {
    ctx.font = font(24, 500)
    ctx.fillStyle = muted
    ctx.fillText('好友榜在微信小游戏里查看', 360, 640)
    ctx.fillText('这里先记下你自己的步数', 360, 684)
  }
}

function drawSettings(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 60, y: 280, w: 600, h: frame.settingsFromPlay ? 700 : 600 }
  card(ctx, rect)
  ctx.fillStyle = ink
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('营地设置', 360, rect.y + 70)
  if (frame.assets.scenes.nap) paintHead(ctx,frame.assets.scenes.nap,paper,rect.x+29,rect.y+28,121,82)
  const sound = { x: 110, y: rect.y + 130, w: 500, h: 88 }
  hot(frame, 'settings:sound', sound)
  fillRound(ctx, sound, 24, '#F4E5D1')
  ctx.fillStyle = ink
  ctx.font = font(30, 700)
  ctx.textAlign = 'left'
  ctx.fillText('声音', sound.x + 28, sound.y + 44)
  label(ctx, frame.save.sound ? '开' : '关', 492, sound.y + 44, 24, muted)
  fillRound(ctx, {x: 523, y: sound.y + 23, w: 66, h: 42}, 21, frame.save.sound ? accent : '#909683')
  fillRound(ctx, {x: frame.save.sound ? 551 : 529, y: sound.y + 29, w: 32, h: 30}, 15, paper)
  const rules = ['从鼠鼠出发，走完每格再回洞', '每关 50% 机会发现探路镜', '逢五遇见新鼠，入伙机会 25%']
  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  ctx.font = font(28, 600)
  rules.forEach((line, index) => {
    const center = rect.y + 280 + index * 56
    fillRound(ctx, { x: 110, y: center - 15, w: 42, h: 31 }, 10, '#E8D8B4')
    label(ctx, `0${index + 1}`, 131, center, 17, ink)
    label(ctx, line, 169, center, 26, ink, 'left', 500)
  })
  if (frame.settingsFromPlay) {
    ghostButton(frame, 'settings:home', { x: 110, y: rect.y + 470, w: 500, h: 88 }, '回主页')
    button(frame, 'settings:close', { x: 110, y: rect.y + 580, w: 500, h: 88 }, '关闭')
  } else {
    button(frame, 'settings:close', { x: 110, y: rect.y + 470, w: 500, h: 88 }, '关闭')
  }
}

function drawReward(frame: Frame): void {
  if (!frame.reward) return
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 390, w: 580, h: 460 }
  card(ctx, rect)
  ctx.fillStyle = ink
  ctx.font = font(36, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(frame.reward.title, 360, rect.y + 90)
  ctx.font = font(26, 500)
  ctx.fillStyle = muted
  wrapText(ctx, frame.notice, 500).forEach((line, index) => ctx.fillText(line, 360, rect.y + 160 + index * 38))
  button(frame, 'reward:ok', { x: 120, y: rect.y + 270, w: 480, h: 88 }, frame.reward.confirm)
  ghostButton(frame, 'reward:cancel', { x: 120, y: rect.y + 374, w: 480, h: 72 }, '取消')
}

function drawDrop(frame: Frame, play: PlayView): void {
  const haul = play.haul
  if (!haul) return
  const ctx = frame.ctx
  const elapsed = Math.max(0, frame.now - play.dropAt)
  nightSky(ctx, elapsed)
  hot(frame, 'modal:block', {x: 0, y: 0, ...STAGE})
  const goods = GOOD_IDS.filter(id => haul.counts[id])
  const rows = Math.ceil(goods.length / 2)
  const height = 465 + rows * 54
  const top = Math.round((STAGE.h - height) / 2 + 30 + 26 * (1 - Math.min(1, elapsed / 320)) ** 3)
  const left = 56
  const width = STAGE.w - left * 2
  const inner = left + 34
  const right = STAGE.w - inner
  const finalLevel = play.level.id === LEVEL_COUNT
  surface(ctx, {x: left, y: top, w: width, h: height}, 28, paper, '#C9AC8C', 6)
  fillRound(ctx, {x: left+2, y: top+2, w: width-4, h: 128}, 26, accent)
  ctx.fillStyle = accent
  ctx.fillRect(left+2, top+93, width-4, 39)
  label(ctx, `田野行动小分队    /    行动 ${String(play.level.id).padStart(2,'0')}`, inner, top+38, 20, '#FFE9CC','left')
  label(ctx, finalLevel ? '全程告捷！' : '满载回洞！', inner-2, top+91, 48, paper,'left', 800)
  const who = haul.joined ?? play.plan.thief
  fillRound(ctx, {x:right-113,y:top+14,w:110,h:106}, 26, '#F8DFC1')
  paintHead(ctx,frame.assets.calm[who],SPECIES_COLOR[who],right-106,top+18,96,97)

  const count = Object.values(haul.counts).reduce((sum, qty) => sum + qty, 0)
  label(ctx,'入库件数',inner,top+168,21,muted,'left')
  label(ctx,`${count} 件`,inner,top+215,38,ink,'left',800)
  ctx.fillStyle = edge
  ctx.fillRect(352,top+159,2,75)
  label(ctx,'战利品估值',384,top+168,21,muted,'left')
  label(ctx,`${haul.value} 贝`,384,top+215,38,berry,'left',800)
  rule(ctx,inner,top+251,right)
  label(ctx,'战利品清单',inner,top+281,25,ink,'left')
  label(ctx,'已入库  ✓',right,top+281,20,accent,'right')
  goods.forEach((id, index) => {
    const posX = inner + index % 2 * 276
    const posY = top + 307 + Math.floor(index/2) * 54
    fillRound(ctx,{x:posX,y:posY,w:258,h:46},12,'#F6E9D3')
    lootArt(ctx, frame.assets.scenes.supplies, id,posX+26,posY+23,42)
    label(ctx,GOODS[id][0],posX+52,posY+23,21,ink,'left')
    label(ctx,`×${haul.counts[id]}`,posX+242,posY+23,21,accent,'right')
  })
  const foot = top + 316 + rows * 54
  const notes: string[] = []
  if (haul.tools) notes.push(`探路镜 +${haul.tools}`)
  if (haul.joined) notes.push(`${SPECIES_NAME[haul.joined]} 已入伙`)
  else if (play.plan.guest) notes.push(`${SPECIES_NAME[play.plan.guest]} 溜走了`)
  label(ctx,notes.join('   ·   ') || '今日收工，宝物已妥善收藏。',360,foot+16,23,haul.joined ? berry : muted)
  const actionsTop = foot+53
  if (finalLevel) button(frame,'drop:next',{x:inner,y:actionsTop,w:right-inner,h:72},'回主页')
  else {
    ghostButton(frame,'drop:home',{x:inner,y:actionsTop,w:170,h:72},'回主页')
    button(frame,'drop:next',{x:inner+186,y:actionsTop,w:right-inner-186,h:72},'下一关')
  }
}

function drawWarehouse(frame: Frame): void {
  const ctx = frame.ctx
  page(ctx)
  iconButton(frame, 'back', 28, 36, 'back')
  label(ctx, '战利品仓库', 360, 80, 42)
  if (frame.assets.scenes.snack) paintHead(ctx,frame.assets.scenes.snack,paper,555,54,100,97)
  const worth = GOOD_IDS.reduce((sum,id) => sum + GOODS[id][1]*(frame.save.stock[id] ?? 0), 0)
  label(ctx, `藏品总值  ${worth} 贝`, 360, 148, 26, muted)
  GOOD_IDS.forEach((id,index) => {
    const left = 30 + index % 3 * 222
    const top = 190 + Math.floor(index / 3) * 135
    surface(ctx, {x: left, y: top, w: 213, h: 123}, 18, paper)
    lootArt(ctx, frame.assets.scenes.supplies, id, left + 49, top + 46, 76)
    label(ctx, `×${frame.save.stock[id] ?? 0}`, left + 193, top + 43, 25, accent, 'right')
    label(ctx, GOODS[id][0], left + 13, top + 95, 20, ink, 'left')
    label(ctx, `${GOODS[id][1]} 贝`, left + 199, top + 95, 19, muted, 'right')
  })
  surface(ctx,{x:32,y:1000,w:656,h:135},22,'#E3E2C6')
  lootArt(ctx, frame.assets.scenes.supplies, 'lens',90,1067,84)
  label(ctx,`${TOOL}  ×${frame.save.lenses}`,150,1046,28,ink,'left')
  label(ctx,'使用提示时优先消耗，无需广告',150,1091,22,muted,'left')
}

function drawTimeout(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 390, w: 580, h: 460 }
  card(ctx, rect)
  ctx.fillStyle = ink
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('时间到了', 360, rect.y + 90)
  ctx.font = font(26, 500)
  ctx.fillStyle = muted
  ctx.fillText(frame.extraUsed ? '这关的加时已经用过' : '可以加 30 秒，或重新开始', 360, rect.y + 160)
  if (!frame.extraUsed) button(frame, 'timeout:ad', { x: 120, y: rect.y + 220, w: 480, h: 88 }, '看广告加时')
  ghostButton(frame, 'timeout:restart', { x: 120, y: rect.y + (frame.extraUsed ? 250 : 330), w: 480, h: 84 }, '重新开始')
}

function drawStuck(frame: Frame): void {
  dim(frame)
  const ctx = frame.ctx
  const rect = { x: 70, y: 400, w: 580, h: 440 }
  card(ctx, rect)
  ctx.fillStyle = ink
  ctx.font = font(40, 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('走不通了', 360, rect.y + 90)
  if (frame.assets.scenes.lookout) paintHead(ctx,frame.assets.scenes.lookout,paper,rect.x+25,rect.y+28,104,99)
  ctx.font = font(26, 500)
  ctx.fillStyle = muted
  ctx.fillText('可以撤回一步，或重新开始', 360, rect.y + 160)
  button(frame, 'stuck:undo', { x: 120, y: rect.y + 220, w: 480, h: 88 }, '撤回一步')
  ghostButton(frame, 'stuck:reset', { x: 120, y: rect.y + 326, w: 480, h: 80 }, '重新开始')
}

function drawDetail(frame: Frame, species: Species): void {
  dim(frame)
  const ctx = frame.ctx
  const profile = SPECIES_PROFILE[species]
  const width = 592
  const inset = 42
  const textWidth = width - inset * 2
  ctx.font = font(27, 500)
  const lines = wrapText(ctx, profile.bio, textWidth)
  const lineHeight = 42
  const height = 554 + lines.length * lineHeight
  const rect = { x: (STAGE.w - width) / 2, y: (STAGE.h - height) / 2, w: width, h: height }
  const left = rect.x + inset
  card(ctx, rect)
  label(ctx, `遇到 ${frame.save.dex[species]} 次`, rect.x + width - inset, rect.y + 54, 21, muted, 'right')
  paintHead(ctx, frame.assets.calm[species], SPECIES_COLOR[species], 225, rect.y + 56, 270, 228)
  label(ctx, SPECIES_NAME[species], 360, rect.y + 321, 43, ink)
  label(ctx, profile.personality, 360, rect.y + 372, 26, accent)
  rule(ctx, left, rect.y + 409, left + textWidth)
  lines.forEach((line, index) => {
    label(ctx, line, left, rect.y + 452 + index * lineHeight, 27, ink, 'left', 500)
  })
  button(frame, 'detail:close', { x: left, y: rect.y + height - 112, w: textWidth, h: 76 }, '返回图鉴')
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (line && ctx.measureText(next).width > maxWidth) {
      const carry = line.match(/[“‘（《]+$/)?.[0]
        ?? (/^[，。！？、：；”’）》]$/.test(char) ? line.match(/.[，。！？、：；”’）》]*$/u)?.[0] : '')
      if (carry && carry.length < line.length) {
        lines.push(line.slice(0, -carry.length))
        line = carry + char
      } else {
        lines.push(line)
        line = char
      }
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
  ctx.fillStyle = paper
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 360, rect.y + 32)
}

export function render(frame: Frame): void {
  if (!frame.assets.ready || frame.now - frame.assets.openedAt < 1250) {
    const ctx = frame.ctx
    const elapsed = Math.max(0, frame.now - frame.assets.openedAt)
    const beat = Math.sin(elapsed / 205)
    ctx.fillStyle = '#FCEDDA'
    ctx.fillRect(0,0,STAGE.w,STAGE.h)
    label(ctx,'FIELD SQUAD    /    集合号',360,259,23,muted)
    label(ctx,'鼠鼠大作战',360,348,69,ink,'center',800)
    if (frame.assets.scenes.assembly) {
      ctx.save()
      ctx.translate(360,775 - Math.max(0,beat)*8)
      ctx.rotate(beat*.012)
      ctx.scale(1-beat*.012,1+beat*.014)
      paintHead(ctx,frame.assets.scenes.assembly,paper,-216,-408,432,432)
      const butterfly = frame.assets.scenes.butterfly
      if (butterfly) {
        const flutter = Math.sin(elapsed / 69)
        const width = 27 + 10 * flutter
        const flyX = 184 + 7 * Math.sin(elapsed / 230)
        const flyY = -326 + 5 * Math.cos(elapsed / 170)
        ctx.drawImage(butterfly, flyX - width / 2, flyY - 20, width, 39)
      }
      ctx.restore()
    } else {
      mark(ctx,'paw',360,600+beat*6,3,accent)
    }
    label(ctx,'小队集合中',360,868,29,ink)
    fillRound(ctx,{x:204,y:921,w:312,h:12},6,'#E5D4BB')
    const width = 312 * frame.assets.progress
    if (width > 0) fillRound(ctx,{x:204,y:921,w:width,h:12},6,accent)
    for (let index=0; index<3; index++) {
      const hop=Math.max(0,Math.sin(elapsed/150-index*.9))
      fillRound(ctx,{x:333+index*22,y:972-hop*7,w:10,h:10},5,'#BA8157')
    }
    return
  }
  if (frame.screen === 'play' && frame.play?.showDrop && frame.play.haul && !frame.reward) {
    drawDrop(frame, frame.play)
    if (frame.toast) drawToast(frame, frame.toast)
    return
  }
  if (frame.screen === 'home') drawHome(frame)
  else if (frame.screen === 'play' && frame.play) drawPlay(frame, frame.play)
  else if (frame.screen === 'warehouse') drawWarehouse(frame)
  else if (frame.screen === 'dex') drawDex(frame)
  else drawRank(frame)
  if (frame.detail && frame.screen === 'dex') drawDetail(frame, frame.detail)
  if (frame.settings) drawSettings(frame)
  if (frame.stuck && !frame.reward) drawStuck(frame)
  if (frame.timeout && !frame.reward) drawTimeout(frame)
  if (frame.reward) drawReward(frame)
  if (frame.toast) drawToast(frame, frame.toast)
}
