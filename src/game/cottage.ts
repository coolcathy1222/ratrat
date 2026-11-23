import { SPECIES_IDS, SPECIES_NAME, type Species } from '../core/species'
import type { AssetBook } from './assets'
import { lootArt } from './loot-art'
import { flower, label } from './stationery'

const activities = ['自在休息', '喝花茶', '读故事', '自在休息', '吃奶酪', '画插画'] as const

export function cottageActivity(id: Species, elapsed: number) {
  const index = SPECIES_IDS.indexOf(id)
  const slot = Math.floor(elapsed / (35_000 + index * 1100))
  return activities[(slot + index) % activities.length]
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.beginPath()
  ctx.ellipse(x, y, w, h, 0, 0, 2 * Math.PI)
  ctx.fillStyle = fill
  ctx.fill()
}

function tea(ctx: CanvasRenderingContext2D, t: number) {
  ctx.translate(0, -9 * Math.max(0, Math.sin(t)))
  ctx.rotate(-.15 * Math.max(0, Math.sin(t)))
  ctx.strokeStyle = '#614F43'
  ctx.lineWidth = 2.5
  oval(ctx, 17, 1, 8, 7, '#E8D6AD')
  ctx.stroke()
  oval(ctx, 18, 0, 4, 3, '#987E65')
  ctx.beginPath()
  ctx.moveTo(-19,-7)
  ctx.bezierCurveTo(-18,19,13,21,17,-7)
  ctx.closePath()
  ctx.fillStyle = '#A8C8BB'
  ctx.fill()
  ctx.stroke()
  oval(ctx,-1,-7,18,5,'#F5E6C8')
  ctx.stroke()
  oval(ctx,-1,-7,14,3,'#B17840')
  for (let i=0; i<2; i++) {
    const rise = (t*.38+i*.5)%1
    const y = -12-rise*19
    ctx.strokeStyle = `rgba(255,249,226,${.7*Math.sin(Math.PI*rise)})`
    ctx.beginPath()
    ctx.moveTo(i*11-8,y)
    ctx.bezierCurveTo(i*11-13,y-4,i*11-3,y-8,i*11-8,y-13)
    ctx.stroke()
  }
}

function book(ctx: CanvasRenderingContext2D, drawing: boolean, t: number) {
  ctx.rotate(-.08)
  ctx.fillStyle = drawing ? '#FFF1D0' : '#F5E7BB'
  ctx.strokeStyle = drawing ? '#AA7950' : '#57746C'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-32,-15)
  ctx.quadraticCurveTo(-16,-19,0,-9)
  ctx.quadraticCurveTo(15,-18,32,-14)
  ctx.lineTo(30,15)
  ctx.quadraticCurveTo(15,12,0,20)
  ctx.quadraticCurveTo(-15,12,-30,16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0,-9)
  ctx.lineTo(0,18)
  ctx.stroke()
  if (drawing) {
    flower(ctx, -14, 0, 7, '#CE8965')
    ctx.translate(12+Math.sin(t*2)*5, 2+Math.cos(t*2)*2)
    ctx.rotate(.42)
    ctx.fillStyle = '#A05536'
    ctx.fillRect(0,-32,5,29)
    ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(5,-3); ctx.lineTo(2.5,2); ctx.fill()
  } else {
    ctx.strokeStyle = '#B69D76'
    for (let line=0; line<3; line++) {
      const y=-6+line*6
      ctx.beginPath()
      ctx.moveTo(-25,y); ctx.lineTo(-7,y+3)
      ctx.moveTo(6,y+3); ctx.lineTo(24-Math.sin(t)*2,y)
      ctx.stroke()
    }
    ctx.fillStyle = '#AE5844'; ctx.fillRect(18,-13,4,10)
  }
}

function footstool(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.translate(481, 809)
  ctx.scale(1.18, 1.18)
  ctx.rotate(-.042)
  oval(ctx, 5, 44, 47, 8, 'rgba(75,49,29,.20)')
  ctx.lineCap = 'round'
  for (const [x,y] of [[0,28],[-32,44],[31,44]]) {
    ctx.strokeStyle = '#70503A'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(x*.78,4); ctx.lineTo(x,y); ctx.stroke()
    ctx.strokeStyle = '#C08A51'
    ctx.lineWidth = 3
    ctx.stroke()
  }
  oval(ctx,0,5,43,14,'#9E673F')
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#70503A'; ctx.stroke()
  oval(ctx,0,0,43,14,'#D6AC74')
  ctx.stroke()
  oval(ctx,0,-3,36,10,'#98A78B')
  ctx.save()
  ctx.setLineDash([3,4])
  ctx.strokeStyle = '#DEDAC0'
  ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.ellipse(0,-3,31,7,0,0,Math.PI*2); ctx.stroke()
  ctx.restore()
  ctx.restore()
}

export function cottageResidents(ctx: CanvasRenderingContext2D, assets: AssetBook, residents: Species[], elapsed: number) {
  const backRow = residents.length > 3 ? Math.ceil(residents.length/2) : 0
  footstool(ctx)
  for (const [i,id] of residents.entries()) {
    const back = i < backRow
    const rowSize = back ? backRow : residents.length-backRow
    const slot = back ? i : i-backRow
    const x = 24 + 672*(slot+.5)/rowSize
    const y = (back ? 707 : 962) + Math.cos(slot*2)*16
    const size = back ? 154 : rowSize === 1 ? 234 : 177
    const phase = elapsed/1000*1.8 + i*1.31
    const scheduled = cottageActivity(id, elapsed)
    const activity = id === 'cream' && !assets.creamEmpty ? '自在休息' : scheduled
    const art = id === 'cream' && activity !== '自在休息' ? assets.creamEmpty : assets.calm[id]
    oval(ctx,x,y-3,size*.38,size*.055,'rgba(94,55,29,.25)')
    ctx.save()
    ctx.translate(x,y)
    ctx.rotate(Math.sin(phase)*.028)
    const breath = 1+.017*Math.sin(phase)
    ctx.scale(1/breath,breath)
    if (art) {
      const scale = size / Math.max(art.width,art.height)
      const w=art.width*scale, h=art.height*scale
      ctx.drawImage(art,-w/2,-h,w,h)
    }
    ctx.translate(id === 'cream' ? -size*.045 : size*.07,-size*.33)
    ctx.scale(size/174,size/174)
    if (activity === '喝花茶') tea(ctx,phase)
    else if (activity === '吃奶酪') {
      const nibble = Math.max(0, Math.sin(phase*1.7))
      lootArt(ctx,assets.scenes.suppliesPlain,'cheese',0,-nibble*7,51)
    } else if (activity === '画插画' || activity === '读故事') book(ctx,activity === '画插画',phase)
    ctx.restore()

    const name = `${SPECIES_NAME[id]} · ${activity}`
    ctx.font = '600 19px sans-serif'
    const width = Math.max(127,ctx.measureText(name).width+24)
    ctx.fillStyle = '#FFF0CF'
    ctx.beginPath()
    ctx.moveTo(x-width/2+15,y+9)
    ctx.arc(x+width/2-15,y+24,15,-Math.PI/2,Math.PI/2)
    ctx.arc(x-width/2+15,y+24,15,Math.PI/2,Math.PI*1.5)
    ctx.closePath()
    ctx.fill()
    label(ctx,name,x,y+24,19,'#604B3E')
  }
}
