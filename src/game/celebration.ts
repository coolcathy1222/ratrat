import { STAGE } from './geom'

const TILE_MS = 1100
export function waveStep(count: number): number {
  return Math.min(165, 4300 / Math.max(1, count - 1))
}

export function celebrateMs(count: number): number {
  return Math.max(0, count - 1) * waveStep(count) + TILE_MS
}

export function pulsePhase(now: number, at: number | undefined, victory: boolean): number {
  if (at == null) return -1
  const phase = (now - at) / (victory ? TILE_MS : 330)
  return phase >= 0 && phase < 1 ? phase : -1
}

export function tileSparks(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, phase: number, seed: number, victory: boolean): void {
  const spread = 1 - (1 - phase) ** 2
  if (victory) {
    const bloom = Math.sin(Math.PI * phase)
    const radius = size * (.64 + .42 * spread)
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, 'rgba(255,255,221,.18)')
    glow.addColorStop(.37, 'rgba(255,229,128,.46)')
    glow.addColorStop(.62, 'rgba(201,241,134,.31)')
    glow.addColorStop(1, 'rgba(165,226,170,0)')
    ctx.save()
    ctx.globalAlpha = bloom
    ctx.fillStyle = glow
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)

    // Two broken arcs catch the light as it travels beyond the tile.
    const rim = size * (.29 + .53 * spread)
    const angle = seed + phase * .65
    ctx.lineCap = 'round'
    ctx.lineWidth = size * .024 * (1 - phase) + .5
    ctx.strokeStyle = 'rgba(255,252,202,.88)'
    for (let i = 0; i < 2; i++) {
      const start = angle + i * Math.PI
      ctx.beginPath()
      ctx.arc(x, y, rim, start, start + .92)
      ctx.stroke()
    }

    for (let i = 0; i < 10; i++) {
      const direction = seed + i * 2.4
      const travel = size * (.20 + spread * (.39 + i % 4 * .096))
      const px = x + Math.cos(direction) * travel
      const py = y + Math.sin(direction) * travel - size * phase * .14
      const glint = Math.sin(Math.PI * phase ** (i % 2 ? 1.4 : .78))
      const star = size * (i % 3 === 0 ? .087 : .039) * glint
      ctx.fillStyle = ['#FFF9CB', '#F3BA47', '#EBFFAB', '#FFE399'][i % 4]
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
  {x: 172, y: 154, delay: 0, colors: ['#FF4B71', '#FF963B', '#FFE45C'], drift: 56},
  {x: 572, y: 100, delay: 1.02, colors: ['#7858FF', '#F65BD5', '#60DFFF'], drift: -62},
  {x: 69, y: 224, delay: 2.08, colors: ['#19CFC2', '#A0EE4F', '#FFEB80'], drift: 35},
  {x: 405, y: 109, delay: 3.22, colors: ['#FC6258', '#5AD7FF', '#CC71FF'], drift: -35},
  {x: 650, y: 206, delay: 4.34, colors: ['#537DFF', '#15D4DE', '#FFA94B'], drift: -45},
  {x: 242, y: 90, delay: 5.55, colors: ['#87E940', '#31C4FF', '#BC6BFF'], drift: 32},
].map((shell, shellIndex) => {
  let seed = 91 + shellIndex
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const sparks = Array.from({length: 72}, (_, index) => {
    const layer = index % 3
    const ring = shellIndex % 2 === 1
    const angle = ring ? Math.floor(index / 3) * Math.PI / 12 + layer * .11 : next() * Math.PI * 2
    const speed = ring ? 175 + layer * 108 + next() * 12 : 185 + next() * 205
    const projection = ring ? 1 : Math.sqrt(1 - next() ** 2)
    return {
      vx: Math.cos(angle) * speed * projection, vy: Math.sin(angle) * speed * projection,
      color: shell.colors[layer], life: .95 + next() * .94,
      width: 1.6 + next() * 1.7, twinkle: next() * 14,
    }
  })
  return {...shell, sparks}
})

const SHELL_CYCLE = 6.8
export const ASCENT = .72

export function shellCueBetween(previousMs: number, currentMs: number, cue: 'launch' | 'burst'): boolean {
  return shells.some(({delay}) => {
    const first = delay + (cue === 'burst' ? ASCENT : 0)
    return currentMs / 1000 >= first &&
      Math.floor((currentMs / 1000 - first) / SHELL_CYCLE) >
      Math.floor((previousMs / 1000 - first) / SHELL_CYCLE)
  })
}

export function nightSky(ctx: CanvasRenderingContext2D, elapsed: number): void {
  const seconds = Math.max(0, elapsed) / 1000
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
