import { LEVEL_COUNT, type CellPos, type LevelDef } from '../core/levels'
import { formatTime, ratCount } from '../core/rules'
import { SPECIES_COLOR, SPECIES_IDS, SPECIES_NAME, SPECIES_PROFILE, type Species } from '../core/species'
import type { SaveData } from '../core/progress'
import type { AssetBook, Sprite } from './assets'
import { PLAY_AREA, STAGE, boardGeom, cellCenter, cellRect, type Rect } from './geom'

import { ink, muted, accent, paper, edge, berry, label, mark, flower, page, rule, type Mark } from './stationery'

import { CHESTS, RELICS, GOODS, GOOD_IDS, TOOL, type Heist, type Haul } from '../core/heist'
import { cottageResidents } from './cottage'
import { levelPhrase, recitalMs } from './mozart'
import { lootArt } from './loot-art'
import { bagPose, CLOSE_AT, HERO_PORTRAIT, MEET_MS, pocketPosition, nightSky, pulsePhase, tileSparks, waveDelay, celebrateMs } from './celebration'

export interface Hot extends Rect {
  id: string
}

export interface PlayView {
  level: LevelDef
  path: CellPos[]
  guidance: CellPos[]
  freeLens: boolean
  hintLeft: number
  remaining: number | null
  shake: number
  won: boolean
  winAt: number
  showDrop: boolean
  fireworksAt: number
  dropAt: number
  plan: Heist
  haul: Haul | null
  spawnAt: number
  pops: Record<string, number>
  dropSlots: number[]
}

export interface Frame {
  ctx: CanvasRenderingContext2D
  now: number
  hots: Hot[]
  assets: AssetBook
  save: SaveData
  pressed: string | null
  screen: 'home' | 'loading' | 'play' | 'dex' | 'rank' | 'warehouse' | 'cottage'
  loadingHero: Species | null
  cottageAt: number
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

function meadowPostcard(frame: Frame, age: number): void {
  const ctx = frame.ctx
  const reveal = Math.min(1,(age-CLOSE_AT+430)/650)
  if (reveal <= 0 || !frame.assets.meadow) return
  ctx.save()
  ctx.globalAlpha = reveal
  ctx.save()
  const travel = Math.min(1,Math.max(0,(age-CLOSE_AT)/MEET_MS))
  const settle = travel*travel*(3-2*travel)
  ctx.translate(360,490+12*(1-reveal)-108*settle)
  ctx.scale(1-.32*settle,1-.32*settle)
  ctx.rotate(-.035)
  fillRound(ctx,{x:-293,y:-154,w:586,h:324},13,'#BFB99A')
  fillRound(ctx,{x:-294,y:-160,w:586,h:324},13,paper)
  roundRect(ctx,-283,-149,564,298,8)
  ctx.clip()
  ctx.drawImage(frame.assets.meadow,-283,-149,564,298)
  ctx.restore()
  for (let i=0; i<10; i++) {
    const x=94+i*58
    const y=776+33*Math.sin(i*.62)+(i%2)*13
    ctx.save()
    ctx.translate(x,y)
    ctx.rotate(1.43+.28*Math.cos(i*.62))
    ctx.globalAlpha = reveal*(.25+.55*Math.max(0,1-Math.abs((age/290)%13-i)))
    mark(ctx,'paw',0,0,.75,'#8A7857')
    ctx.restore()
  }
  for (const [x,y,r] of [[76,731,13],[121,720,8],[585,843,9],[617,826,15]]) {
    flower(ctx,x,y,r)
  }
  ctx.restore()
}

function pocket(frame: Frame, age: number, front: boolean): void {
  const ctx = frame.ctx
  const hero = frame.play!.plan.thief
  const sprite = frame.assets.calm[hero]
  const pose = bagPose(age,recitalMs(levelPhrase(frame.play!.level.id)),sprite ? sprite.width/sprite.height : 1)
  if (front && age>=CLOSE_AT) {
    ctx.save()
    ctx.translate(pose.heroX,pose.heroY)
    ctx.rotate(pose.stride*.045+pose.lift*.04)
    paintHead(ctx,sprite,SPECIES_COLOR[hero],-pose.heroSize/2,-pose.heroSize/2,pose.heroSize,pose.heroSize)
    ctx.restore()
  }
  const mouth = 91-78*pose.close
  const bounce = age < CLOSE_AT ? Math.sin(age/70)*Math.sin(Math.PI*age/CLOSE_AT) : 0
  ctx.save()
  ctx.translate(pose.x,pose.y)
  ctx.rotate(-pose.lift*.10+pose.stride*.06)
  ctx.scale(pose.scale*(1+bounce*.018),pose.scale*(1-bounce*.028))
  ctx.lineWidth = 5
  ctx.strokeStyle = '#604638'
  ctx.fillStyle = front ? '#DBA569' : '#5B423A'
  ctx.beginPath()
  if (front) {
    ctx.moveTo(-mouth,0)
    ctx.bezierCurveTo(-mouth*.55,17-12*pose.close,mouth*.55,17-12*pose.close,mouth,0)
    ctx.bezierCurveTo(mouth+3,34,132,65,115,113)
    ctx.bezierCurveTo(99,158,-93,162,-114,115)
    ctx.bezierCurveTo(-135,76,-mouth-4,33,-mouth,0)
  } else ctx.ellipse(0,0,mouth,21-17*pose.close,0,0,2*Math.PI)
  ctx.fill(); ctx.stroke()
  if (front) {
    stitches(ctx,{x:-62,y:50,w:124,h:64},19,'#92663F')
    mark(ctx,'paw',0,82,1.25,'#8F633E')
    ctx.strokeStyle='#F5DB9C'
    ctx.lineWidth=7
    ctx.beginPath(); ctx.moveTo(-mouth+3,14); ctx.quadraticCurveTo(0,39-22*pose.close,mouth-3,14); ctx.stroke()
    if (pose.close>0) {
      ctx.strokeStyle='#976239'
      ctx.lineWidth=4
      for (const side of [-1,1]) {
        ctx.beginPath(); ctx.moveTo(side*mouth*.45,16)
        ctx.quadraticCurveTo(side*(mouth+18*pose.close),10,side*(mouth+34*pose.close),27)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

function drawBoard(
  frame: Frame,
  level: LevelDef,
  path: CellPos[],
  hints: CellPos[],
  area: Rect,
  opts: { interactive: boolean; shake: number; won: boolean; winAt: number; spawnAt: number; pops: Record<string, number> },
): void {
  const ctx = frame.ctx
  const geom = boardGeom(level, area)
  const ox = Math.sin(opts.shake * 24) * opts.shake * 10
  const order = new Map(path.map((cell, index) => [`${cell.x},${cell.y}`, index]))
  const bursts: Array<{ x: number; y: number; phase: number; seed: number }> = []
  const pocketAge = opts.won ? frame.now - opts.winAt - celebrateMs(path.length) : -1
  const ready = path.filter((cell) => appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell)) >= 0.98)
  ctx.save()
  ctx.translate(ox, 0)
  if (pocketAge >= 0) {
    meadowPostcard(frame,pocketAge)
    pocket(frame, pocketAge, false)
  }
  if (ready.length > 1 && pocketAge < 0) {
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
  for (const [cellIndex, cell] of level.cells.entries()) {
    const born = appearScale(frame.now, opts.spawnAt, spawnDelay(level, cell))
    if (born <= 0) continue
    const rect = cellRect(geom, cell)
    const key = `${cell.x},${cell.y}`
    if (opts.interactive && cell.kind === 'rat' && born > 0.45) hot(frame, `cell:${cell.x}:${cell.y}`, rect)
    const index = order.get(key)
    const at = opts.won && index != null ? opts.winAt + waveDelay(index, path.length) : opts.pops[key]
    const phase = index != null ? pulsePhase(frame.now, at, opts.won) : -1
    const lift = phase < 0 ? 0 : Math.sin(Math.PI * phase) * (1 - phase)
    const spring = phase < 0 ? 0 : Math.sin(phase * Math.PI * 2) * (1 - phase)
    const seed = cell.x * 7 + cell.y * 11
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    ctx.save()
    if (pocketAge >= 0) {
      const slot = frame.play!.dropSlots[cellIndex]
      const pos = pocketPosition(pocketAge, slot, level.cells.length, cx, cy, rect.w)
      if (pos.landed) { ctx.restore(); continue }
      if (pos.flash>0) {
        ctx.strokeStyle = '#FFE5A0'
        ctx.lineWidth = Math.max(2,rect.w*.045)
        ctx.globalAlpha = pos.flash
        ctx.beginPath()
        for (let ray=0; ray<5; ray++) {
          const a = seed+ray*2*Math.PI/5
          const r = rect.w*(.45+.22*pos.flash)
          ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)
          ctx.lineTo(cx+Math.cos(a)*(r+rect.w*.17),cy+Math.sin(a)*(r+rect.w*.17))
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.translate(pos.x, pos.y)
      ctx.rotate(pos.angle)
      ctx.translate(-cx, -cy)
    }
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
    const pickup = frame.play!.plan.cells[key]
    const chest = pickup?.kind === 'chest' ? CHESTS[pickup.tier] : null
    const badge = isStart ? '起' : isEnd ? '终' : chest ? chest.name.slice(0, 2) : ''
    const outline = isStart ? '#A9493F' : isEnd ? '#3E607C' : '#946625'
    const revealed = opts.won && at != null && frame.now >= at
    ctx.fillStyle = revealed ? '#FFF2CD' : isStart ? '#FFD3BB' : isEnd ? '#DAE8F1'
      : chest ? '#FFE1A0' : index != null ? '#FFF1C9' : paper
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.clip()
    if (badge || index != null) {
      const inset = 2.5
      roundRect(ctx, rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2, rect.w * .19)
      ctx.strokeStyle = badge ? outline : revealed ? '#D8B572' : '#C77842'
      ctx.lineWidth = Math.max(2, rect.w * (badge ? .083 : .047))
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
    const who = isStart ? frame.play!.plan.thief : pickup?.kind === 'guest' ? pickup.id : null
    if (who) {
      paintHead(ctx, frame.assets.calm[who], SPECIES_COLOR[who], rect.x+4, rect.y+3, rect.w-8, rect.h-8)
      if (!isStart) label(ctx, '★', rect.x + rect.w * .78, rect.y + rect.h * .24, rect.w * .24, berry)
    } else if (isEnd) {
      if (frame.assets.hole) paintHead(ctx, frame.assets.hole, ink, rect.x+4,rect.y+4,rect.w-8,rect.h-8)
      else drawHole(ctx, rect)
    } else if (chest) {
      ctx.save()
      ctx.translate(cx, cy - rect.h * .055)
      ctx.scale(rect.w / 93, rect.w / 93)
      chestStamp(ctx, 0, 0, chest.color, frame.now - opts.spawnAt, false)
      ctx.restore()
    } else if (pickup) {
      const atlas = revealed ? frame.assets.scenes.supplies : frame.assets.scenes.suppliesPlain
      lootArt(ctx, atlas, pickup.kind === 'good' ? pickup.id : 'lens', cx, cy, rect.w * .88)
    }
    if (badge) {
      const h = rect.h * .29
      const w = h * (badge.length + .64)
      const bottom = rect.y + rect.h
      fillRound(ctx, {x: cx-w/2, y: bottom-h, w, h: h+2}, h*.32, outline)
      label(ctx, badge, cx, bottom-h*.49, h*.78, '#FFF9E8')
    }
    ctx.restore()
    ctx.restore()
    if (phase >= 0) bursts.push({ x: cx, y: cy - lift * rect.h * .2, phase, seed })
  }
  if (pocketAge >= 0) pocket(frame, pocketAge, true)
  for (const burst of bursts) tileSparks(ctx, burst.x, burst.y, geom.cell, burst.phase, burst.seed, opts.won)
  hints.forEach((hint, i) => {
    const rect = cellRect(geom, hint)
    const pulse = 1 + Math.sin(frame.now / 160) * 0.04
    ctx.save()
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2)
    ctx.scale(pulse, pulse)
    ctx.strokeStyle = '#F0A202'
    ctx.lineWidth = 6
    roundRect(ctx, -rect.w / 2 - 6, -rect.h / 2 - 6, rect.w + 12, rect.h + 12, rect.w * 0.24)
    ctx.stroke()
    const r = Math.max(11, rect.w * .17)
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(rect.w * .32, -rect.h * .32, r, 0, 2 * Math.PI)
    ctx.fill()
    label(ctx, String(i + 1), rect.w * .32, -rect.h * .32, r * 1.48, paper)
    ctx.restore()
  })
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
  // The group photograph is the doorway to the cottage; the whole card is tappable.
  hot(frame,'cottage',{x:36,y:266,w:648,h:457})
  mark(ctx,'paw',71,701,.8,accent)
  label(ctx,'鼠鼠之家',101,701,25,ink,'left')
  label(ctx,'进屋看看',609,701,21,accent,'right')
  mark(ctx,'arrow',642,701,.82,accent)
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

function drawCottage(frame: Frame): void {
  const {ctx, assets} = frame
  page(ctx)
  iconButton(frame,'back',28,36,'back')
  label(ctx,'鼠鼠之家',360,77,43,ink)
  const residents = SPECIES_IDS.filter(id => frame.save.dex[id] > 0)
  label(ctx,`已入住 ${residents.length} / ${SPECIES_IDS.length} 只`,360,132,23,muted)
  const room = {x:24,y:178,w:672,h:1008}
  surface(ctx,room,28,'#F4DFC2','#AB8969',5)
  ctx.save()
  roundRect(ctx,room.x,room.y,room.w,room.h,28)
  ctx.clip()
  if (assets.scenes.cottage) ctx.drawImage(assets.scenes.cottage,room.x,room.y,room.w,room.h)
  cottageResidents(ctx,assets,residents,Math.max(0,frame.now-frame.cottageAt))
  ctx.restore()
  flower(ctx,360,1235,13,'#C7CDAA')
}

function drawPlay(frame: Frame, play: PlayView): void {
  const ctx = frame.ctx
  page(ctx)
  if (!play.won) iconButton(frame, 'settings', 36, 32, 'gear')
  iconButton(frame, 'sound', 604, 32, frame.save.sound ? 'sound-on' : 'sound-off')
  label(ctx, 'F I E L D   M I S S I O N', 360, 46, 17, muted)
  label(ctx, `第 ${play.level.id} 关`, 360, 94, 42)
  const tray = {x: 22, y: 151, w: 676, h: 782}
  surface(ctx, tray, 32, '#DBDABA', '#B2AE8E')
  stitches(ctx, {x: 31, y: 160, w: 658, h: 764}, 25, '#FFF2D7')
  const heroDeparted = play.won && frame.now >= play.winAt+celebrateMs(play.path.length)+CLOSE_AT
  const crewBadge = (species: Species, title: string, x: number, bg: string, departed = false) => {
    fillRound(ctx, {x, y: 167, w: 188, h: 60}, 17, bg)
    const size = HERO_PORTRAIT.size
    if (!departed) paintHead(ctx,frame.assets.calm[species],SPECIES_COLOR[species],x+6,HERO_PORTRAIT.y-size/2,size,size)
    else mark(ctx,'paw',HERO_PORTRAIT.x,HERO_PORTRAIT.y,.85,'#D5B798')
    label(ctx, title, x+71, 182, 17, muted, 'left')
    label(ctx, SPECIES_NAME[species], x+71, 209, 25, ink, 'left')
  }
  crewBadge(play.plan.thief, '本关主角', HERO_PORTRAIT.x-HERO_PORTRAIT.size/2-6, '#FFF2D9',heroDeparted)
  if (play.plan.guest) crewBadge(play.plan.guest, '新鼠出没', 246, '#FFE3CC')
  const remaining = play.remaining
  label(ctx, remaining != null ? `倒计时  ${formatTime(remaining)}` : '自由探索', 654, 202, 23, remaining != null && remaining <= 5 ? berry : ink, 'right')
  rule(ctx, 54, 234, 666, '#BCB79A')

  drawBoard(frame, play.level, play.path, play.guidance, PLAY_AREA, {
    interactive: !play.won && !frame.settings && !frame.reward && !frame.timeout && !frame.stuck && !play.showDrop,
    shake: play.shake,
    won: play.won,
    winAt: play.winAt,
    spawnAt: play.spawnAt,
    pops: play.pops,
  })
  if (play.won) return
  const total = ratCount(play.level)
  label(ctx, `已连 ${play.path.length} / ${total}`, 40, 977, 26, ink, 'left')
  fillRound(ctx, {x: 268, y: 970, w: 412, h: 16}, 8, '#E3D0B6')
  if (play.path.length) fillRound(ctx, {x: 268, y: 970, w: 412 * play.path.length / total, h: 16}, 8, accent)
  mark(ctx,'paw',268+412*play.path.length/total,954,.76,accent)
  label(ctx, play.level.tip || '一笔扫齐宝物，最后进鼠洞', 360, 1044, 24, muted, 'center', 500)
  ghostButton(frame, 'hint', { x: 36, y: 1110, w: 314, h: 96 }, `提示 ${play.hintLeft} · ${play.freeLens ? '自带镜' : frame.save.lenses ? '探路镜' : '广告'}`)
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
  const rules = ['从鼠鼠出发，走完每格再回洞', '每关 50% 机会发现探路镜', '宝箱随机出现在路上，通关开箱']
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

function chestStamp(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, elapsed: number, opening = true): void {
  const open = opening ? Math.min(1, elapsed / 550) : 0
  ctx.save()
  ctx.translate(x, y)
  surface(ctx, {x:-32,y:-1,w:64,h:34},7,color,'#76543E',3)
  ctx.fillStyle = '#634838'; ctx.fillRect(-27,-4,54,10)
  ctx.save()
  ctx.translate(0, -open * 9)
  ctx.rotate(-open * .13)
  surface(ctx, {x:-33,y:-22,w:66,h:27},10,color,'#76543E',2)
  ctx.fillStyle = '#F7D385'
  ctx.fillRect(-22,-19,6,21); ctx.fillRect(16,-19,6,21)
  ctx.restore()
  fillRound(ctx, {x:-7,y:3,w:14,h:13},4,'#FFE5A2')
  // Stagger the glints so the painted metal catches light as the lid lifts.
  for (const [sx, sy, delay] of [[-28, -21, 0], [26, -28, 230], [17, 8, 510]]) {
    const phase = ((elapsed - delay) % 2200) / 850
    if (phase <= 0 || phase >= 1) continue
    const light = Math.sin(Math.PI * phase)
    const radius = 11 * light
    ctx.save()
    ctx.translate(sx, sy - open * 5 - phase * 4)
    const glow = ctx.createRadialGradient(0,0,0,0,0,radius * 1.7)
    glow.addColorStop(0,'rgba(255,245,187,.85)')
    glow.addColorStop(1,'rgba(255,222,134,0)')
    ctx.fillStyle = glow
    ctx.fillRect(-radius*2,-radius*2,radius*4,radius*4)
    ctx.fillStyle = '#FFFFE9'
    ctx.beginPath()
    ctx.moveTo(0,-radius)
    ctx.quadraticCurveTo(1,-1,radius*.75,0)
    ctx.quadraticCurveTo(1,1,0,radius)
    ctx.quadraticCurveTo(-1,1,-radius*.75,0)
    ctx.quadraticCurveTo(-1,-1,0,-radius)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

function relicArt(ctx: CanvasRenderingContext2D, item: 'ranunculus' | 'pearl', x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  if (item === 'pearl') {
    const gold = ctx.createRadialGradient(-5,-6,1,0,0,18)
    gold.addColorStop(0,'#FFFCDE'); gold.addColorStop(.35,'#FFE5A8'); gold.addColorStop(.8,'#DDAB51'); gold.addColorStop(1,'#AD773B')
    ctx.fillStyle = gold
    ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill()
  } else {
    ctx.strokeStyle = '#759057'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0,18); ctx.quadraticCurveTo(7,10,2,-5); ctx.stroke()
    flower(ctx, 2, -4, 22, '#D88273')
    flower(ctx, 2, -4, 14, '#F5B794')
    flower(ctx, 2, -4, 8, '#FFDDB0')
  }
  ctx.restore()
}

function drawDrop(frame: Frame, play: PlayView): void {
  const haul = play.haul
  if (!haul) return
  const ctx = frame.ctx
  const elapsed = Math.max(0, frame.now - play.dropAt)
  nightSky(ctx, frame.now - play.fireworksAt)
  hot(frame, 'modal:block', {x: 0, y: 0, ...STAGE})
  const goods = GOOD_IDS.filter(id => haul.counts[id])
  const rows = Math.ceil(goods.length / 2)
  const chestHeight = haul.chest ? 138 : 0
  const guestHeight = play.plan.guest ? 110 : 0
  const rowStep = rows > 6 ? 44 : 54
  const talentHeight = haul.talent ? 79 : 0
  const height = 454 + chestHeight + rows * rowStep + talentHeight + guestHeight
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
  const who = play.plan.thief
  label(ctx,'本关主角',right-106,top+48,17,'#FFE7C9','right')
  label(ctx,SPECIES_NAME[who],right-106,top+84,29,paper,'right')
  fillRound(ctx, {x:right-87,y:top+23,w:88,h:88}, 23, '#F8DFC1')
  paintHead(ctx,frame.assets.calm[who],SPECIES_COLOR[who],right-82,top+27,78,80)

  const count = Object.values(haul.counts).reduce((sum, qty) => sum + qty, 0)
  label(ctx,'路线入库件数',inner,top+168,21,muted,'left')
  label(ctx,`${count} 件`,inner,top+215,38,ink,'left',800)
  ctx.fillStyle = edge
  ctx.fillRect(352,top+159,2,75)
  label(ctx,'路线补给估值',384,top+168,21,muted,'left')
  label(ctx,`${haul.value} 贝`,384,top+215,38,berry,'left',800)
  if (haul.talent) {
    fillRound(ctx, {x:inner,y:top+249,w:right-inner,h:72}, 15, '#F6D79D')
    mark(ctx,'sun',inner+29,top+285,.84,'#935626')
    label(ctx,`${SPECIES_NAME[who]}的本关加成`,inner+56,top+268,18,'#795239','left')
    label(ctx,haul.talent,inner+56,top+299,22,ink,'left')
  }
  const listTop = top + talentHeight
  rule(ctx,inner,listTop+251,right)
  label(ctx,'战利品清单',inner,listTop+281,25,ink,'left')
  label(ctx,'已入库  ✓',right,listTop+281,20,accent,'right')
  goods.forEach((id, index) => {
    const posX = inner + index % 2 * 276
    const posY = listTop + 307 + Math.floor(index/2) * rowStep
    fillRound(ctx,{x:posX,y:posY,w:258,h:rowStep-6},12,'#F6E9D3')
    lootArt(ctx, frame.assets.scenes.supplies, id,posX+26,posY+(rowStep-6)/2,42)
    label(ctx,GOODS[id][0],posX+52,posY+(rowStep-6)/2,21,ink,'left')
    label(ctx,`×${haul.counts[id]}`,posX+242,posY+(rowStep-6)/2,21,accent,'right')
  })
  const foot = listTop + 316 + rows * rowStep
  if (haul.tools) label(ctx,`探路镜 +${haul.tools}`,inner,foot+16,21,accent,'left')
  const guest = play.plan.guest
  if (guest) {
    fillRound(ctx,{x:inner,y:foot+35,w:right-inner,h:100},18,'#F4E3D8')
    const x = inner + 9
    const y = foot + 39
    const size = 92
    const reveal = Math.min(1, Math.max(0, (elapsed-420)/940))
    if (reveal < 1) paintHead(ctx,frame.assets.shadow[guest],ink,x,y,size,size)
    if (reveal > 0) {
      ctx.save()
      const edgeY = y + size * (1-reveal)
      ctx.beginPath()
      ctx.rect(x,edgeY,size,size*reveal)
      ctx.clip()
      paintHead(ctx,frame.assets.calm[guest],SPECIES_COLOR[guest],x,y,size,size)
      ctx.restore()
      if (reveal < 1) {
        const sheen = ctx.createLinearGradient(x,0,x+size,0)
        sheen.addColorStop(0,'transparent')
        sheen.addColorStop(.5,'#FFF9CC')
        sheen.addColorStop(1,'transparent')
        ctx.fillStyle = sheen
        ctx.fillRect(x,edgeY-2,size,4)
      }
    }
    label(ctx,'遇见新鼠',inner+117,foot+64,18,muted,'left')
    if (reveal > .35) label(ctx,SPECIES_NAME[guest],inner+117,foot+104,30,ink,'left')
    if (reveal >= 1) label(ctx,haul.joined ? '已加入图鉴' : '这次溜走了',right-18,foot+85,23,haul.joined ? accent : muted,'right')
  }
  const boxTop = foot + 42 + guestHeight
  const chest = haul.chest
  if (chest) {
    const style = CHESTS[chest.tier]
    fillRound(ctx,{x:inner,y:boxTop,w:right-inner,h:116},18,'#F1E2C3')
    chestStamp(ctx,inner+52,boxTop+59,style.color,elapsed)
    label(ctx,style.name,inner+104,boxTop+30,24,ink,'left')
    label(ctx,`稀有率 ${Math.round(chest.chance*100)}%`,right-14,boxTop+30,18,muted,'right')
    let reward: string
    if (chest.item === 'weasel') reward = chest.stolen ? `盗宝鼬偷走了 1 份${GOODS[chest.stolen][0]}` : '遇到盗宝鼬，保住了全部补给'
    else if (chest.item === 'double') reward = '翻倍卡已生效 · 路线补给 ×2'
    else if (chest.item === 'pearl' || chest.item === 'ranunculus') {
      reward = `${RELICS[chest.item][0]} ×1 · 已入库`
      relicArt(ctx,chest.item,right-32,boxTop+78)
    } else reward = `${GOODS[chest.item][0]} ×1 · 已入库`
    label(ctx,reward,inner+104,boxTop+79,22,berry,'left')
  }
  const actionsTop = boxTop + chestHeight
  if (finalLevel) button(frame,'drop:next',{x:inner,y:actionsTop,w:right-inner,h:72},'回主页')
  else {
    ghostButton(frame,'drop:home',{x:inner,y:actionsTop,w:170,h:72},'回主页')
    button(frame,'drop:next',{x:inner+186,y:actionsTop,w:right-inner-186,h:72},'下一关')
  }
}

function saveRelicWorth(save: SaveData): number {
  return save.relics.pearl * RELICS.pearl[1] + save.relics.ranunculus * RELICS.ranunculus[1]
}

function drawWarehouse(frame: Frame): void {
  const ctx = frame.ctx
  page(ctx)
  iconButton(frame, 'back', 28, 36, 'back')
  label(ctx, '战利品仓库', 360, 80, 42)
  if (frame.assets.scenes.snack) paintHead(ctx,frame.assets.scenes.snack,paper,555,54,100,97)
  const relicWorth = saveRelicWorth(frame.save)
  const worth = relicWorth + GOOD_IDS.reduce((sum,id) => sum + GOODS[id][1]*(frame.save.stock[id] ?? 0), 0)
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
  label(ctx,'每次标出最多五步，洞口不计步',150,1091,22,muted,'left')
  ;(['ranunculus','pearl'] as const).forEach((id,i) => {
    const left = 32 + i * 334
    surface(ctx,{x:left,y:1152,w:322,h:92},18,paper)
    relicArt(ctx,id,left+36,1198)
    label(ctx,RELICS[id][0],left+68,1182,23,ink,'left')
    label(ctx,`${RELICS[id][1]} 贝  ·  ×${frame.save.relics[id]}`,left+68,1217,20,muted,'left')
  })
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
  const talentLines = wrapText(ctx, profile.talent, textWidth - 28)
  const talentHeight = 22 + talentLines.length * 32
  const height = 570 + lines.length * lineHeight + talentHeight
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
  const talentTop = rect.y + 437 + lines.length * lineHeight
  fillRound(ctx,{x:left,y:talentTop,w:textWidth,h:talentHeight},14,'#E6E9CA')
  talentLines.forEach((line,i) => label(ctx,line,left+14,talentTop+27+i*32,23,ink,'left'))
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
  if (!frame.assets.ready || frame.screen === 'loading') {
    const ctx = frame.ctx
    const elapsed = Math.max(0, frame.now - frame.assets.openedAt)
    const beat = Math.sin(elapsed / 205)
    ctx.fillStyle = '#FCEDDA'
    ctx.fillRect(0,0,STAGE.w,STAGE.h)
    label(ctx,'FIELD SQUAD    /    集合号',360,259,23,muted)
    label(ctx,'鼠鼠大作战',360,348,69,ink,'center',800)
    const hero = frame.screen === 'loading' ? frame.loadingHero : null
    const art = hero ? frame.assets.calm[hero] : frame.assets.scenes.assembly
    if (art) {
      ctx.save()
      ctx.translate(360,775 - Math.max(0,beat)*8)
      ctx.rotate(beat*.012)
      ctx.scale(1-beat*.012,1+beat*.014)
      const size = hero ? 280 : 432
      paintHead(ctx,art,paper,-size/2,-192-size/2,size,size)
      const butterfly = frame.assets.scenes.butterfly
      if (butterfly && !hero) {
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
    label(ctx,hero ? `${SPECIES_NAME[hero]}准备出发` : '小队集合中',360,868,29,ink)
    if (frame.screen !== 'loading') fillRound(ctx,{x:204,y:921,w:312,h:12},6,'#E5D4BB')
    const width = frame.screen === 'loading' ? 0 : 312 * frame.assets.progress
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
  else if (frame.screen === 'cottage') drawCottage(frame)
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
