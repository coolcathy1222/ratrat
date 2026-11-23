import { STAGE } from './geom'

const TILE_MS = 1760
export const GATHER_MS = 420
export const STAGGER_MS = 520
export const FLIGHT_MS = 1340
export const POCKET_MS = GATHER_MS + STAGGER_MS + FLIGHT_MS + 390
export const POCKET_MOUTH = {x: 360, y: 1015}

export function pocketPosition(age: number, slot: number, count: number, x: number, y: number, size: number) {
  const centerX = STAGE.w / 2
  const centerY = STAGE.h / 2
  const gather = Math.min(1, Math.max(0, age / GATHER_MS))
  const pull = gather * gather * (3 - 2 * gather)
  const travel = Math.max(0, age - GATHER_MS - STAGGER_MS * slot / Math.max(1, count - 1)) / FLIGHT_MS
  if (!travel) return {x: x + (centerX-x)*pull, y: y + (centerY-y)*pull, angle: 0, landed: false}

  const t = Math.min(1, travel)
  const angle = slot * 2.39996
  const spread = 241 + 101 * (.5 + .5 * Math.sin(slot * 13.17))
  // The radial impulse peaks early, then gravity pulls the intact tile into the bag.
  const arc = 9.48 * t * (1-t) ** 3
  return {
    x: centerX + Math.cos(angle) * Math.min(spread, centerX-size/2) * arc,
    y: centerY + Math.sin(angle) * spread * 1.05 * arc + (POCKET_MOUTH.y + size - centerY) * t * t,
    angle: Math.sin(angle + .6) * .98 * Math.sin(Math.PI * t),
    landed: travel >= 1,
  }
}
export function waveStep(count: number): number {
  return Math.min(165, 4300 / Math.max(1, count - 1))
}

export function waveDelay(index: number, count: number): number {
  return index * waveStep(count)
}

// Assign each board tile its own launch slot once, when the player wins.
export function pocketOrder(count: number, rng = Math.random): number[] {
  const slots = Array.from({length: count}, (_, i) => i)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const previous = slots[i]
    slots[i] = slots[j]
    slots[j] = previous
  }
  return slots
}

export function celebrateMs(count: number): number {
  return waveDelay(Math.max(0, count - 1), count) + TILE_MS
}

export function pulsePhase(now: number, at: number | undefined, victory: boolean): number {
  if (at == null) return -1
  const phase = (now - at) / (victory ? TILE_MS : 330)
  if (phase < 0 || phase >= 1) return -1
  return victory ? 1 - (1 - phase) ** 2.15 : phase
}

export function tileSparks(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, phase: number, seed: number, victory: boolean): void {
  const spread = victory ? phase : 1 - (1 - phase) ** 2
  if (victory) {
    const bloom = Math.sqrt(Math.sin(Math.PI * phase))
    const radius = size * (.76 + .91 * spread)
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, 'rgba(255,249,215,.60)')
    glow.addColorStop(.37, 'rgba(255,220,101,.53)')
    glow.addColorStop(.62, 'rgba(255,183,46,.26)')
    glow.addColorStop(1, 'rgba(255,189,50,0)')
    ctx.save()
    ctx.globalAlpha = bloom
    ctx.fillStyle = glow
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)

    // Two broken arcs catch the light as it travels beyond the tile.
    const rim = size * (.40 + .84 * spread)
    const angle = seed + phase * .65
    ctx.lineCap = 'round'
    ctx.lineWidth = size * .038 * (1 - phase) + 1.0
    ctx.strokeStyle = 'rgba(255,252,202,.88)'
    for (let i = 0; i < 2; i++) {
      const start = angle + i * Math.PI
      ctx.beginPath()
      ctx.arc(x, y, rim, start, start + 1.22)
      ctx.stroke()
    }

    for (let i = 0; i < 10; i++) {
      const direction = seed + i * 2.4
      const travel = size * (.20 + spread * (.68 + i % 4 * .17))
      const px = x + Math.cos(direction) * travel
      const py = y + Math.sin(direction) * travel - size * phase * .14
      const glint = Math.sin(Math.PI * phase ** (i % 2 ? 1.4 : .78))
      const star = size * (i % 3 === 0 ? .126 : .059) * glint
      ctx.fillStyle = ['#FFF9CB', '#F3BA47', '#FFF5A0', '#FFE399'][i % 4]
      ctx.beginPath()
      ctx.moveTo(px, py - star * 1.55)
      ctx.quadraticCurveTo(px, py, px + star, py)
      ctx.quadraticCurveTo(px, py, px, py + star * 1.55)
      ctx.quadraticCurveTo(px, py, px - star, py)
      ctx.quadraticCurveTo(px, py, px, py - star * 1.55)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  const count = 4
  ctx.save()
  for (let index = 0; index < count; index++) {
    const angle = seed + index * Math.PI * 2 / count
    const reach = size * (.18 + spread * (.36 + .13 * Math.sin(index + seed)))
    const px = x + Math.cos(angle) * reach
    const py = y + Math.sin(angle) * reach - size * .2 * Math.sin(Math.PI * phase)
    const radius = size * .064 * (1 - phase * .8)
    ctx.fillStyle = index % 2 ? '#FFF7CB' : '#E3A640'
    ctx.globalAlpha = (1 - phase) ** .7
    ctx.beginPath()
    ctx.moveTo(px, py - radius * 1.45)
    ctx.quadraticCurveTo(px, py, px + radius, py)
    ctx.quadraticCurveTo(px, py, px, py + radius * 1.45)
    ctx.quadraticCurveTo(px, py, px - radius, py)
    ctx.quadraticCurveTo(px, py, px, py - radius * 1.45)
    ctx.fill()
  }
  ctx.restore()
}

const shells = [
  {x: 172, y: 154, delay: 0, colors: ['#FF4B71', '#FF963B'], drift: 56},
  {x: 572, y: 100, delay: 1.46, colors: ['#7858FF', '#F65BD5'], drift: -62},
  {x: 69, y: 224, delay: 2.86, colors: ['#19CFC2', '#A0EE4F'], drift: 35},
  {x: 405, y: 109, delay: 4.25, colors: ['#FC6258', '#5AD7FF'], drift: -35},
  {x: 650, y: 206, delay: 5.73, colors: ['#537DFF', '#15D4DE'], drift: -45},
  {x: 242, y: 90, delay: 7.15, colors: ['#87E940', '#31C4FF'], drift: 32},
].map((shell, shellIndex) => {
  let seed = 91 + shellIndex
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const sparks = Array.from({length: 72}, (_, index) => {
    const inner = index < 24
    const count = inner ? 24 : 48
    const angle = ((index + next() * .8) / count + shellIndex * .19) * Math.PI * 2
    const speed = (inner ? 155 : 325) * (.86 + .28 * next())
    const projection = .84 + .16 * next()
    return {
      vx: Math.cos(angle) * speed * projection, vy: Math.sin(angle) * speed * projection,
      color: shell.colors[inner ? 1 : 0], life: (inner ? .82 : 1.23) + next() * .62,
      width: 1.6 + next() * 1.7, twinkle: next() * 14,
    }
  })
  return {...shell, sparks}
})

const SHELL_CYCLE = 8.7
const ASCENT = 1.104

export function shellCueBetween(previousMs: number, currentMs: number): boolean {
  return shells.some(({delay}) => {
    const first = delay
    return currentMs / 1000 >= first &&
      Math.floor((currentMs / 1000 - first) / SHELL_CYCLE) >
      Math.floor((previousMs / 1000 - first) / SHELL_CYCLE)
  })
}

export function nightSky(ctx: CanvasRenderingContext2D, elapsed: number): void {
  const seconds = elapsed / 1000
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE.h)
  sky.addColorStop(0, '#222C40')
  sky.addColorStop(.55, '#41485C')
  sky.addColorStop(1, '#886B5C')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, STAGE.w, STAGE.h)
  for (let star = 0; star < 60; star++) {
    ctx.fillStyle = star % 3 === 0 ? '#B3BDA7' : '#758F89'
    ctx.fillRect((star * 139 + 28) % 720, (star * 379 + 31) % 1280, 2, 2)
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (const shell of shells) {
    if (seconds < shell.delay) continue
    const age = (seconds - shell.delay) % SHELL_CYCLE
    const rise = ASCENT
    if (age < rise) {
      const lift = 1 - age / rise
      const tail = Math.min(1, lift + .13)
      const px = shell.x - shell.drift * lift
      const py = shell.y + 390 * lift * lift + 38 * lift
      ctx.globalAlpha = .82
      const tailX = shell.x - shell.drift * tail
      const tailY = shell.y + 390 * tail * tail + 38 * tail
      const plume = ctx.createLinearGradient(tailX, tailY, px, py - .01)
      plume.addColorStop(0, 'transparent')
      plume.addColorStop(1, shell.colors[0])
      ctx.fillStyle = plume
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(px - 2.3, py)
      ctx.lineTo(px + 2.3, py)
      ctx.fill()
      ctx.fillStyle = '#FFF3C4'
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
      continue
    }
    const time = age - rise
    if (time > 1.9) continue
    if (time < .22) {
      const radius = 8 + 32 * time / .22
      const glow = ctx.createRadialGradient(shell.x, shell.y, 0, shell.x, shell.y, radius)
      glow.addColorStop(0, '#FFF0B5')
      glow.addColorStop(1, 'rgba(255,196,126,0)')
      ctx.globalAlpha = 1 - time / .22
      ctx.fillStyle = glow
      ctx.fillRect(shell.x - radius, shell.y - radius, 2 * radius, 2 * radius)
    }
    // Sample a short history of the particle trajectory, including its falling arc.
    const trail = Array.from({length: 6}, (_, i) => {
      const t = Math.max(0, time - (5 - i) * .078)
      return {travel: -Math.expm1(-1.45 * t) / 1.45, fall: 48 * t * t}
    })
    for (const spark of shell.sparks) {
      if (time >= spark.life) continue
      const fade = 1 - time / spark.life
      const shimmer = time < .6 ? 1 : .72 + .28 * Math.sin(time * 25 + spark.twinkle)
      let px = shell.x + spark.vx * trail[0].travel
      let py = shell.y + spark.vy * trail[0].travel + trail[0].fall
      ctx.strokeStyle = spark.color
      for (let i = 1; i < trail.length; i++) {
        const strength = i / (trail.length - 1)
        ctx.globalAlpha = fade * shimmer * strength * strength
        ctx.lineWidth = .25 + spark.width * strength * (.5 + fade)
        ctx.beginPath()
        ctx.moveTo(px, py)
        px = shell.x + spark.vx * trail[i].travel
        py = shell.y + spark.vy * trail[i].travel + trail[i].fall
        ctx.lineTo(px, py)
        ctx.stroke()
      }
      ctx.fillStyle = time < .32 ? '#FFF5CE' : spark.color
      ctx.beginPath()
      ctx.arc(px, py, .65 + fade * spark.width * .56, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
