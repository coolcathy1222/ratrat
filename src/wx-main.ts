import { App } from './game/app'
import { createWechatPlatform, getWx, type WxTouchEvent } from './platform/wechat'

const wx = getWx()
if (!wx?.createCanvas || !wx.getSystemInfoSync) {
  throw new Error('需要在微信小游戏环境里打开')
}

const info = wx.getSystemInfoSync()
const canvas = wx.createCanvas()
const app = new App(canvas, createWechatPlatform(), {
  assetBase: 'assets',
  readAudioFile: filePath => new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({filePath, success: result => resolve(result.data), fail: reject})
  }),
  createAudioContext: wx.createWebAudioContext?.bind(wx),
  makeImage: () => wx.createImage?.() ?? new Image(),
})

app.resize(info.windowWidth, info.windowHeight, info.pixelRatio || 1)
app.start()

function point(event: WxTouchEvent): { x: number; y: number } {
  const touch = event.changedTouches?.[0] || event.touches?.[0]
  return touch ? { x: touch.clientX, y: touch.clientY } : { x: 0, y: 0 }
}

wx.onTouchStart?.((event) => {
  const p = point(event)
  app.pointer('down', p.x, p.y)
})
wx.onTouchMove?.((event) => {
  const p = point(event)
  app.pointer('move', p.x, p.y)
})
wx.onTouchEnd?.((event) => {
  const p = point(event)
  app.pointer('up', p.x, p.y)
})
wx.onTouchCancel?.(() => app.pointer('up', -1, -1))
wx.onShow?.(() => app.setHidden(false))
wx.onHide?.(() => app.setHidden(true))
