import { planHeist, bankHeist, type Haul, type Heist } from '../core/heist'
import { LEVEL_COUNT, levelById, type CellPos, type LevelDef } from '../core/levels'
import { noteClear, shanghaiDate, type SaveData } from '../core/progress'
import { extendStroke, hintNext, isStuck, isWon, minClearSeconds, ratCount, undoOne } from '../core/rules'
import type { Platform, RewardSlot } from '../platform/types'
import { AssetBook, type MakeSprite } from './assets'
import { Sfx } from './audio'
import { PLAY_AREA, STAGE, boardGeom, cellRect } from './geom'
import { ASCENT, celebrateMs, shellCueBetween } from './celebration'
import { render, spawnSpan, type Frame, type Hot } from './render'
import { loadSave, storeSave } from './save'

interface RewardPrompt {
  slot: RewardSlot
  title: string
  confirm: string
  cell?: CellPos
}

export interface AppOptions {
  assetBase: string
  createAudioContext?: () => AudioContext
  readAudioFile: (path: string) => Promise<ArrayBuffer>
  makeImage: MakeSprite
}

export class App {
  private readonly canvas: HTMLCanvasElement
  private readonly platform: Platform
  private readonly assets = new AssetBook()
  private readonly sfx: Sfx
  private save: SaveData
  private hots: Hot[] = []
  private screen: Frame['screen'] = 'home'
  private rankTab: Frame['rankTab'] = 'total'
  private detail: Frame['detail'] = null
  private settingsOpen = false
  private reward: RewardPrompt | null = null
  private timeoutOpen = false
  private stuckOpen = false
  private toastText = ''
  private toastUntil = 0
  private pressed: string | null = null
  private anchor: string | null = null
  private drawing = false
  private lastSample: { x: number; y: number } | null = null
  private lastCell = ''
  private lastError = ''
  private busy = false
  private hidden = false
  private level: LevelDef = levelById(1)
  private path: CellPos[] = []
  private hintCell: CellPos | null = null
  private hintLeft = 2
  private undoUsed = false
  private stuckOffered = false
  private extraUsed = false
  private plan!: Heist
  private haul: Haul | null = null
  private dropReady = false
  private dropAt = 0
  private won = false
  private winAt = 0
  private spawnedAt = 0
  private pops: Record<string, number> = {}
  private startedAt = 0
  private pausedAccum = 0
  private pauseStarted = 0
  private timeLimit: number | null = null
  private shake = 0
  private lastTick = -1
  private cssW = STAGE.w
  private cssH = STAGE.h
  private dpr = 1
  private scale = 1
  private offsetX = 0
  private offsetY = 0
  private lastFrame = 0

  constructor(canvas: HTMLCanvasElement, platform: Platform, options: AppOptions) {
    this.canvas = canvas
    this.platform = platform
    this.save = loadSave(platform)
    this.sfx = new Sfx(() => options.readAudioFile(`${options.assetBase}/audio/field-burst.wav`), options.createAudioContext)
    this.sfx.setEnabled(this.save.sound)
    void this.assets.load(options.assetBase, options.makeImage)
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW)
    this.cssH = Math.max(1, cssH)
    this.dpr = Math.max(1, dpr)
    this.scale = Math.min(this.cssW / STAGE.w, this.cssH / STAGE.h)
    this.offsetX = (this.cssW - STAGE.w * this.scale) / 2
    this.offsetY = (this.cssH - STAGE.h * this.scale) / 2
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(this.cssH * this.dpr)
    const style = (this.canvas as { style?: CSSStyleDeclaration }).style
    if (style) {
      style.width = `${this.cssW}px`
      style.height = `${this.cssH}px`
    }
  }

  start(): void {
    this.lastFrame = performance.now()
    const canvas = this.canvas as HTMLCanvasElement & {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number
    }
    const schedule =
      canvas.requestAnimationFrame?.bind(canvas) ||
      (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined) ||
      ((cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16))
    const loop = (time: number) => {
      this.tick(time)
      schedule(loop)
    }
    schedule(loop)
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    this.sfx.setVisible(!hidden)
    if (hidden) this.pause()
    else this.resumeIfClear()
  }

  pointer(type: 'down' | 'move' | 'up', cssX: number, cssY: number): void {
    this.sfx.unlock()
    const point = this.logical(cssX, cssY)
    if (type === 'down') this.onDown(point.x, point.y)
    else if (type === 'move') this.onMove(point.x, point.y)
    else this.onUp(point.x, point.y)
  }

  private logical(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: (cssX - this.offsetX) / this.scale,
      y: (cssY - this.offsetY) / this.scale,
    }
  }

  private tick(now: number): void {
    const previousFrame = this.lastFrame
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000 || 0)
    this.lastFrame = now
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2)
    if (this.toastUntil && now > this.toastUntil) this.toastText = ''
    if (this.screen === 'play' && this.won && !this.dropReady && now - this.winAt > celebrateMs(this.path.length)) {
      this.dropReady = true
      this.dropAt = now
      this.sfx.cheer()
      this.pause()
    }
    if (this.screen === 'play' && this.dropReady && !this.hidden && now - previousFrame < 250) {
      const previous = previousFrame - this.dropAt
      const current = now - this.dropAt
      if (shellCueBetween(previous, current, 'launch')) this.sfx.launch(ASCENT)
      if (shellCueBetween(previous, current, 'burst')) this.sfx.firework()
    }
    if (this.screen === 'play' && !this.won && this.timeLimit != null && !this.blocking()) {
      const left = this.remaining()
      if (left <= 0) {
        this.timeoutOpen = true
        this.drawing = false
        this.pause()
      } else if (left <= 5) {
        const second = Math.ceil(left)
        if (second !== this.lastTick) {
          this.lastTick = second
          this.sfx.tap()
        }
      }
    }
    this.draw(now)
  }

  private blocking(): boolean {
    return this.settingsOpen || !!this.reward || this.timeoutOpen || this.stuckOpen || this.dropReady || this.hidden || this.spawning()
  }

  private spawning(): boolean {
    return this.screen === 'play' && performance.now() < this.spawnedAt + spawnSpan(this.level)
  }

  private elapsed(): number {
    const now = performance.now()
    const end = this.pauseStarted || now
    return Math.max(0, (end - this.startedAt - this.pausedAccum) / 1000)
  }

  private remaining(): number {
    if (this.timeLimit == null) return Infinity
    return this.timeLimit - this.elapsed()
  }

  private pause(): void {
    if (!this.pauseStarted) this.pauseStarted = performance.now()
  }

  private resume(): void {
    if (!this.pauseStarted) return
    this.pausedAccum += performance.now() - this.pauseStarted
    this.pauseStarted = 0
  }

  private resumeIfClear(): void {
    if (this.screen !== 'play' || this.hidden) {
      this.pauseStarted = 0
      return
    }
    if (this.settingsOpen || this.reward || this.timeoutOpen || this.stuckOpen || this.dropReady) return
    this.resume()
  }

  private persist(): void {
    storeSave(this.platform, this.save)
  }

  private refreshDay(): void {
    const today = shanghaiDate()
    if (this.save.dailyDate === today) return
    this.save.dailyRats = 0
    this.save.dailyDate = today
    this.persist()
  }

  private toast(text: string): void {
    if (!text) return
    this.toastText = text
    this.toastUntil = performance.now() + 1700
  }

  private startLevel(id: number): void {
    this.level = levelById(id)
    this.plan = planHeist(this.level, this.save.dex)
    this.screen = 'play'
    this.path = []
    this.hintCell = null
    this.hintLeft = this.level.hintLimit
    this.undoUsed = false
    this.stuckOffered = false
    this.extraUsed = false
    this.haul = null
    this.dropReady = false
    this.dropAt = 0
    this.won = false
    this.winAt = 0
    this.settingsOpen = false
    this.reward = null
    this.timeoutOpen = false
    this.stuckOpen = false
    this.detail = null
    this.drawing = false
    this.spawnedAt = performance.now()
    this.pops = {}
    this.startedAt = this.spawnedAt + spawnSpan(this.level)
    this.pausedAccum = 0
    this.pauseStarted = 0
    this.timeLimit = this.level.timeLimit
    this.lastTick = -1
    this.lastCell = ''
    this.lastError = ''
  }

  private resetPath(): void {
    this.path = []
    this.hintCell = null
    this.won = false
    this.winAt = 0
    this.dropReady = false
    this.dropAt = 0
    this.haul = null
    this.drawing = false
    this.spawnedAt = performance.now()
    this.pops = {}
    this.startedAt = this.spawnedAt + spawnSpan(this.level)
    this.pausedAccum = 0
    this.pauseStarted = 0
    this.timeLimit = this.level.timeLimit
    this.timeoutOpen = false
    this.stuckOpen = false
    this.stuckOffered = this.undoUsed
    this.lastTick = -1
    this.lastCell = ''
    this.lastError = ''
    this.toast('已重置')
  }

  private goHome(): void {
    this.screen = 'home'
    this.settingsOpen = false
    this.reward = null
    this.timeoutOpen = false
    this.stuckOpen = false
    this.dropReady = false
    this.dropAt = 0
    this.detail = null
    this.drawing = false
    this.won = false
    this.pauseStarted = 0
  }

  private openRank(tab: Frame['rankTab']): void {
    this.refreshDay()
    this.rankTab = tab
    this.screen = 'rank'
    this.detail = null
    this.platform.notifyRank(tab, this.save.dailyDate)
  }

  private onWin(): void {
    if (this.won) return
    this.won = true
    this.drawing = false
    this.winAt = performance.now()
    this.sfx.win()
    const count = ratCount(this.level)
    this.refreshDay()
    if (this.elapsed() >= minClearSeconds(count)) {
      this.save.totalRats += count
      this.save.dailyRats += count
      this.platform.submitScore(this.save.totalRats, this.save.dailyRats, this.save.dailyDate)
    }
    this.haul = bankHeist(this.plan, this.save)
    noteClear(this.save, this.level.id)
    this.persist()
  }

  private cellAt(x: number, y: number): CellPos | null {
    const geom = boardGeom(this.level, PLAY_AREA)
    for (const cell of this.level.cells) {
      if (cell.kind !== 'rat') continue
      const rect = cellRect(geom, cell)
      if (x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h) return { x: cell.x, y: cell.y }
    }
    return null
  }

  private applyCell(cell: CellPos): void {
    if (this.won || this.blocking()) return
    const key = `${cell.x},${cell.y}`
    if (key === this.lastCell) return
    const before = this.path.length
    const result = extendStroke(this.level, this.path, cell)
    this.path = result.path
    if (result.path.length > before) {
      this.lastCell = key
      this.lastError = ''
      const now = performance.now()
      for (let i = before; i < result.path.length; i++) {
        const added = result.path[i]
        this.pops[`${added.x},${added.y}`] = now + (i - before) * 120
        this.sfx.connect(i, (i - before) * 0.12)
      }
      this.platform.vibrate()
      if (this.hintCell && this.path.some((item) => item.x === this.hintCell?.x && item.y === this.hintCell?.y)) {
        this.hintCell = null
      }
      if (isWon(this.level, this.path)) this.onWin()
      else if (!this.undoUsed && !this.stuckOffered && isStuck(this.level, this.path)) {
        this.stuckOffered = true
        this.stuckOpen = true
        this.drawing = false
        this.pause()
      }
    }
    if (result.error) {
      this.lastCell = key
      if (this.lastError !== key) {
        this.lastError = key
        this.shake = 1
        this.sfx.error()
        if (result.error === 'not-start') this.toast('从自己的鼠鼠开始')
        if (result.error === 'early-end') this.toast('还有宝物没拿，最后再回洞')
      }
    }
  }

  private onDown(x: number, y: number): void {
    const target = this.hit(x, y)
    this.anchor = target?.id ?? null
    this.pressed = this.anchor
    if (this.anchor && !this.anchor.startsWith('cell:')) {
      this.drawing = false
      return
    }
    if (this.screen !== 'play' || this.won || this.blocking()) return
    const cell = this.cellAt(x, y)
    if (!cell) return
    this.drawing = true
    this.lastSample = { x, y }
    this.lastCell = ''
    this.applyCell(cell)
  }

  private onMove(x: number, y: number): void {
    if (!this.drawing || this.screen !== 'play' || this.blocking()) return
    const prev = this.lastSample
    this.lastSample = { x, y }
    if (!prev) {
      const cell = this.cellAt(x, y)
      if (cell) this.applyCell(cell)
      return
    }
    const dist = Math.hypot(x - prev.x, y - prev.y)
    const steps = Math.max(1, Math.ceil(dist / 12))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const cell = this.cellAt(prev.x + (x - prev.x) * t, prev.y + (y - prev.y) * t)
      if (cell) this.applyCell(cell)
    }
  }

  private onUp(x: number, y: number): void {
    const target = this.hit(x, y)
    if (this.anchor && target?.id === this.anchor && !this.anchor.startsWith('cell:')) this.activate(this.anchor)
    this.anchor = null
    this.pressed = null
    this.drawing = false
    this.lastSample = null
  }

  private hit(x: number, y: number): Hot | null {
    for (let i = this.hots.length - 1; i >= 0; i--) {
      const item = this.hots[i]
      if (x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h) return item
    }
    return null
  }

  private activate(id: string): void {
    this.sfx.tap()
    if (id === 'modal:block') {
      if (this.reward) {
        this.reward = null
        this.resumeIfClear()
      } else if (this.settingsOpen) {
        this.settingsOpen = false
        this.resumeIfClear()
      } else if (this.detail) this.detail = null
      return
    }
    if (id === 'settings') {
      this.settingsOpen = true
      this.pause()
      return
    }
    if (id === 'settings:close') {
      this.settingsOpen = false
      this.resumeIfClear()
      return
    }
    if (id === 'settings:home') {
      this.settingsOpen = false
      this.goHome()
      return
    }
    if (id === 'settings:sound' || id === 'sound') {
      this.save.sound = !this.save.sound
      this.sfx.setEnabled(this.save.sound)
      this.persist()
      return
    }
    if (id === 'start') {
      this.startLevel(this.save.finished ? 1 : this.save.level)
      return
    }
    if (id === 'rank:total' || id === 'tab:total') {
      this.openRank('total')
      return
    }
    if (id === 'rank:daily' || id === 'tab:daily') {
      this.openRank('daily')
      return
    }
    if (id === 'warehouse') { this.screen = 'warehouse'; return }
    if (id === 'dex') {
      this.screen = 'dex'
      this.detail = null
      return
    }
    if (id === 'share') {
      void this.doShare()
      return
    }
    if (id === 'back') {
      this.detail = null
      this.screen = 'home'
      return
    }
    if (id.startsWith('dex:')) {
      const species = id.slice(4) as NonNullable<Frame['detail']>
      if (this.save.dex[species] > 0) this.detail = species
      else this.toast('还没遇到这只鼠鼠')
      return
    }
    if (id === 'detail:close') {
      this.detail = null
      return
    }
    if (id === 'hint') {
      void this.askHint()
      return
    }
    if (id === 'reset') {
      if (this.won) return
      this.resetPath()
      return
    }
    if (id === 'reward:ok') {
      void this.confirmReward()
      return
    }
    if (id === 'reward:cancel') {
      this.reward = null
      this.resumeIfClear()
      return
    }
    if (id === 'drop:next') {
      const next = this.level.id < LEVEL_COUNT ? this.level.id + 1 : 0
      this.dropReady = false
      this.dropAt = 0
      this.haul = null
      if (next) this.startLevel(next)
      else this.goHome()
      return
    }
    if (id === 'drop:home') {
      this.dropReady = false
      this.dropAt = 0
      this.goHome()
      return
    }
    if (id === 'timeout:ad') {
      void this.askTime()
      return
    }
    if (id === 'timeout:restart') {
      this.timeoutOpen = false
      this.resetPath()
      return
    }
    if (id === 'stuck:undo') {
      void this.askUndo()
      return
    }
    if (id === 'stuck:reset') {
      this.stuckOpen = false
      this.resetPath()
      return
    }
  }

  private async askHint(): Promise<void> {
    if (this.won) return
    if (this.hintLeft <= 0) {
      this.toast('这关的提示用完了')
      return
    }
    const next = hintNext(this.level, this.path)
    if (!next) {
      this.toast('这条线走偏了，重置后才能提示')
      return
    }
    if (this.save.lenses > 0) {
      this.save.lenses--
      this.hintCell = next
      this.hintLeft--
      this.persist()
      this.toast('探路镜照亮了下一格')
      return
    }
    this.reward = { slot: 'hint', title: '看广告获得提示', confirm: '观看', cell: next }
    this.pause()
  }

  private async askUndo(): Promise<void> {
    if (this.undoUsed) {
      this.toast('这关的撤回用过了')
      return
    }
    this.reward = { slot: 'undo', title: '看广告撤回一步', confirm: '观看' }
    this.pause()
  }

  private async askTime(): Promise<void> {
    if (this.extraUsed) {
      this.toast('这关的加时用过了')
      return
    }
    this.reward = { slot: 'time', title: '看广告加 30 秒', confirm: '观看' }
    this.pause()
  }

  private async confirmReward(): Promise<void> {
    const reward = this.reward
    if (!reward || this.busy) return
    this.busy = true
    let ok = false
    try {
      ok = await this.platform.showReward(reward.slot)
    } finally {
      this.busy = false
    }
    this.reward = null
    if (!ok) {
      this.toast('这次没有获得')
      this.resumeIfClear()
      return
    }
    if (reward.slot === 'hint' && reward.cell) {
      this.hintLeft -= 1
      this.hintCell = reward.cell
      this.toast('下一格亮出来了')
    } else if (reward.slot === 'undo') {
      this.path = undoOne(this.path)
      this.undoUsed = true
      this.stuckOpen = false
      this.hintCell = null
      this.lastCell = ''
    } else if (reward.slot === 'time') {
      this.timeLimit = this.elapsed() + 30
      this.extraUsed = true
      this.timeoutOpen = false
      this.lastTick = -1
    }
    this.resumeIfClear()
  }

  private async doShare(): Promise<void> {
    const text = `我在《鼠鼠大作战》走过了 ${this.save.totalRats} 格，来和田野小队一起收集补给！`
    const result = await this.platform.share(text)
    if (result === 'copied') this.toast('分享文字已复制')
    else if (result === 'shared') this.toast('已准备好分享')
    else this.toast('分享没有完成')
  }

  private draw(now: number): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssW, this.cssH)
    ctx.fillStyle = '#EDDDC5'
    ctx.fillRect(0, 0, this.cssW, this.cssH)
    ctx.save()
    ctx.translate(this.offsetX, this.offsetY)
    ctx.scale(this.scale, this.scale)
    this.hots = []
    const frame: Frame = {
      ctx,
      now,
      hots: this.hots,
      assets: this.assets,
      save: this.save,
      pressed: this.pressed,
      screen: this.screen,
      rankTab: this.rankTab,
      detail: this.detail,
      shared: this.screen === 'rank' ? this.platform.sharedCanvas() : null,
      toast: this.toastText || null,
      settings: this.settingsOpen,
      settingsFromPlay: this.screen === 'play',
      play:
        this.screen === 'play'
          ? {
              level: this.level,
              path: this.path,
              hintCell: this.hintCell,
              hintLeft: this.hintLeft,
              remaining: this.timeLimit == null ? null : this.remaining(),
              shake: this.shake,
              won: this.won,
              winAt: this.winAt,
              showDrop: this.dropReady,
              dropAt: this.dropAt,
              plan: this.plan,
              haul: this.haul,
              spawnAt: this.spawnedAt,
              pops: this.pops,
            }
          : null,
      reward: this.reward ? { title: this.reward.title, confirm: this.reward.confirm } : null,
      notice: this.platform.rewardNotice(),
      timeout: this.timeoutOpen,
      extraUsed: this.extraUsed,
      stuck: this.stuckOpen,
    }
    render(frame)
    ctx.restore()
  }
}
