import { STAGE } from './geom'

export const ink = '#353E50'
export const muted = '#73665B'
export const accent = '#A64E38'
export const paper = '#FFF7E7'
export const edge = '#D4BFA0'
export const berry = '#984F30'

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = ink, align: CanvasTextAlign = 'center', weight = 700): void {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

export function rule(ctx: CanvasRenderingContext2D, x: number, y: number, end: number, color = edge): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, end - x, 2)
}

export function page(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#FAECD8'
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  ctx.fillStyle = '#EAD6B9'
  for (let row = 0; row < 26; row++) {
    for (let col = 0; col < 15; col++) ctx.fillRect(col * 50 + (row % 2) * 25, row * 50 + 12, 2, 2)
  }
}

export function flower(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, petals = '#FFF4CB'): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = petals
  for (let petal = 0; petal < 6; petal++) {
    ctx.rotate(Math.PI / 3)
    ctx.beginPath()
    ctx.ellipse(0, -radius * .54, radius * .3, radius * .52, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#E7AD52'
  ctx.beginPath()
  ctx.arc(0, 0, radius * .33, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export type Mark = 'flag' | 'sun' | 'book' | 'letter' | 'paw' | 'arrow'

export function mark(ctx: CanvasRenderingContext2D, kind: Mark, x: number, y: number, scale = 1, color = ink): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const line = (...coords: number[]) => {
    ctx.beginPath()
    ctx.moveTo(coords[0], coords[1])
    for (let index = 2; index < coords.length; index += 2) ctx.lineTo(coords[index], coords[index + 1])
    ctx.stroke()
  }
  if (kind === 'flag') {
    line(-10, 15, -10, -14, 12, -12, 6, -5, 12, 0, -10, -1)
    line(-15, 15, -5, 15)
  } else if (kind === 'sun') {
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke()
    for (let ray = 0; ray < 8; ray++) { ctx.rotate(Math.PI / 4); line(0, -12, 0, -15) }
  } else if (kind === 'book') {
    line(-13, -13, 11, -13, 11, 14, -13, 14, -13, -13)
    line(-7, -12, -7, 13); line(-2, -4, 6, -4); line(-2, 2, 4, 2)
  } else if (kind === 'letter') {
    line(-15, -10, 15, -10, 15, 11, -15, 11, -15, -10, 0, 2, 15, -10)
  } else if (kind === 'arrow') {
    line(-10, 0, 10, 0); line(3, -7, 10, 0, 3, 7)
  } else {
    for (const [dx, dy, rx, ry] of [[-10,-5,4,5],[0,-11,4,5],[10,-5,4,5],[0,6,10,7]]) {
      ctx.beginPath(); ctx.ellipse(dx, dy, rx, ry, dx * .035, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}
