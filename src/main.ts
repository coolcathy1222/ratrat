import { App } from './game/app'
import { createWebPlatform } from './platform/web'

const found = document.querySelector('canvas')
if (!(found instanceof HTMLCanvasElement)) throw new Error('missing canvas')
const canvas: HTMLCanvasElement = found

const app = new App(canvas, createWebPlatform(), {
  assetBase: './assets',
  async readAudioFile(path) {
    const response = await fetch(path, {cache: 'no-cache'})
    if (!response.ok) throw new Error(`Audio request failed: ${response.status}`)
    return response.arrayBuffer()
  },
  makeImage: () => new Image(),
})

function resize(): void {
  const scale = Math.min(window.innerWidth / 720, window.innerHeight / 1280)
  app.resize(720 * scale, 1280 * scale, Math.min(2, window.devicePixelRatio || 1))
}

function point(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

resize()
window.addEventListener('resize', resize)
canvas.addEventListener('contextmenu', (event) => event.preventDefault())
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId)
  const p = point(event)
  app.pointer('down', p.x, p.y)
})
canvas.addEventListener('pointermove', (event) => {
  const p = point(event)
  app.pointer('move', p.x, p.y)
})
canvas.addEventListener('pointerup', (event) => {
  const p = point(event)
  app.pointer('up', p.x, p.y)
})
canvas.addEventListener('pointercancel', () => app.pointer('up', -1, -1))
document.addEventListener('visibilitychange', () => app.setHidden(document.hidden))
app.start()

if (import.meta.env.DEV) {
  ;(window as unknown as { __rat: App }).__rat = app
}
