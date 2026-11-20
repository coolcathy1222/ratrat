import { GOODS, TOOL, type Good } from '../core/heist'
import type { Sprite } from './assets'

// Cell indices follow the supplied illustration, independently of the unlock order.
const cell: Record<Good | 'lens', number> = {
  rice: 0, wheat: 1, peanut: 2, chestnut: 3, pine: 4, hazelnut: 5,
  almond: 6, acorn: 7, walnut: 8, cheese: 9, daisy: 10, chamomile: 11,
  violet: 12, pentas: 13, jade: 14, ruby: 15, sapphire: 16, diamond: 17, lens: 18,
}

export function lootArt(ctx: CanvasRenderingContext2D, atlas: Sprite | undefined, id: keyof typeof cell, x: number, y: number, size: number): void {
  if (atlas) {
    const index = cell[id]
    const side = atlas.width / 5
    ctx.drawImage(atlas, index % 5 * side, Math.floor(index / 5) * side, side, side,
      x - size / 2, y - size / 2, size, size)
    return
  }
  ctx.save()
  ctx.fillStyle = '#674D39'
  ctx.font = `bold ${size * .3}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(id === 'lens' ? TOOL : GOODS[id][0], x, y, size)
  ctx.restore()
}
