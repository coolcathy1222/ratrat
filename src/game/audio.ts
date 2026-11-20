const SCALE = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25]

// Original eight-bar swing miniature. Zero means a rest in the lead line.
const BARS = [
  {root: 50, chord: [62, 66, 69], tune: [0, 78, 81, 0, 78, 76, 74, 0]},
  {root: 47, chord: [62, 66, 71], tune: [73, 74, 78, 0, 83, 81, 0, 78]},
  {root: 43, chord: [62, 67, 71], tune: [79, 0, 83, 81, 79, 74, 0, 71]},
  {root: 45, chord: [61, 64, 69], tune: [73, 76, 0, 81, 0, 79, 76, 73]},
  {root: 50, chord: [62, 66, 69], tune: [74, 0, 78, 81, 86, 0, 81, 78]},
  {root: 42, chord: [61, 66, 69], tune: [85, 81, 78, 0, 76, 73, 0, 69]},
  {root: 43, chord: [62, 67, 71], tune: [71, 74, 79, 0, 83, 81, 79, 74]},
  {root: 45, chord: [61, 64, 67], tune: [76, 0, 73, 69, 74, 0, 0, 0]},
]
function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export class Sfx {
  private ctx: AudioContext | null = null
  private enabled = true
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private visible = true
  private burstSample: AudioBuffer | null = null
  private loadingBurst = false
  private nextBurstRetry = 0
  constructor(private readonly readBurst: () => Promise<ArrayBuffer>, private readonly createContext?: () => AudioContext) {}

  private musicGain: GainNode | null = null
  private musicTimer = 0
  private musicWanted = false
  private nextNote = 0
  private step = 0

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.updatePlayback()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.updatePlayback()
  }

  private updatePlayback(): void {
    const audible = this.enabled && this.visible
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(audible ? .78 : 0, this.ctx.currentTime, .012)
    if (audible) this.startMusic()
    else this.stopMusic()
  }

  unlock(): void {
    if (!this.ctx) {
      const host = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
      const Ctx = host.AudioContext ?? host.webkitAudioContext
      if (!this.createContext && !Ctx) return
      this.ctx = this.createContext ? this.createContext() : new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled && this.visible ? .78 : 0
      this.master.connect(this.ctx.destination)
      void this.loadBurst(this.ctx)
    }
    if (this.enabled && this.visible) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
      this.startMusic()
    }
  }

  tap(): void {
    this.tone(540, 0.045, 'sine', 0.09)
  }

  connect(index: number, delay = 0): void {
    this.piano(SCALE[index % SCALE.length], 0.42, 0.24, delay)
  }

  error(): void {
    this.tone(168, 0.12, 'square', 0.07)
  }

  win(): void {
    this.piano(523.25, 0.2, 0.22, 0)
    this.piano(659.25, 0.22, 0.24, 0.1)
    this.piano(783.99, 0.4, 0.28, 0.2)
  }

  cheer(): void {
    const ctx = this.ctx
    if (!this.enabled || !this.visible || !ctx || !this.master) return
    const now = ctx.currentTime
    // A little crowd singing "woo!" with staggered voices and moving vowel formants.
    for (const [i, pitch] of [260, 322, 213, 380, 291, 238].entries()) {
      const t = now + i * .052
      const end = t + .56 + i % 3 * .11
      const voice = ctx.createOscillator()
      voice.type = 'sawtooth'
      voice.frequency.setValueAtTime(pitch * .85, t)
      voice.frequency.exponentialRampToValueAtTime(pitch * 1.65, t + .23)
      voice.frequency.exponentialRampToValueAtTime(pitch * 1.12, end)
      for (const [start, finish, gain] of [[620, 400, .055], [1450, 910, .031]]) {
        const vowel = ctx.createBiquadFilter()
        vowel.type = 'bandpass'
        vowel.Q.value = 2.6
        vowel.frequency.setValueAtTime(start, t)
        vowel.frequency.exponentialRampToValueAtTime(finish, end)
        const amp = ctx.createGain()
        amp.gain.setValueAtTime(.0001, t)
        amp.gain.exponentialRampToValueAtTime(gain, t + .09)
        amp.gain.exponentialRampToValueAtTime(.0001, end)
        voice.connect(vowel).connect(amp).connect(this.master)
      }
      voice.start(t)
      voice.stop(end)
    }
    for (let i = 0; i < 13; i++) {
      this.rustle(now + .09 + i * .063 + Math.sin(i * 5) * .021, .062, 1350 + (i % 3) * 280, .13)
    }
  }

  private async loadBurst(ctx: AudioContext): Promise<void> {
    if (this.loadingBurst || ctx.currentTime < this.nextBurstRetry) return
    this.loadingBurst = true
    try {
      const bytes = await this.readBurst()
      this.burstSample = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(bytes, resolve, reject)
      })
    } catch {
      this.nextBurstRetry = ctx.currentTime + 5
    } finally {
      this.loadingBurst = false
    }
  }

  launch(duration: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.visible || !this.enabled) return
    const t = ctx.currentTime
    const end = t + duration
    const pitch = 630 + Math.random() * 120
    const whistle = ctx.createOscillator()
    whistle.type = 'sine'
    whistle.frequency.setValueAtTime(pitch, t)
    whistle.frequency.exponentialRampToValueAtTime(pitch * 2.1, t + duration * .54)
    whistle.frequency.exponentialRampToValueAtTime(pitch * 3.25, end)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(.0001, t)
    amp.gain.exponentialRampToValueAtTime(.079, t + duration * .17)
    amp.gain.exponentialRampToValueAtTime(.041, end - .09)
    amp.gain.exponentialRampToValueAtTime(.0001, end - .014)
    whistle.connect(amp)
    amp.connect(this.master)
    this.rustle(t, duration * .85, 3200, .19)
    whistle.start(t)
    whistle.stop(end)
  }

  firework(): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.visible || !this.enabled) return
    if (!this.burstSample) {
      void this.loadBurst(ctx)
      this.rustle(ctx.currentTime, .38, 390, .48)
      return
    }
    const burst = ctx.createBufferSource()
    burst.buffer = this.burstSample
    burst.playbackRate.value = .90 + Math.random() * .17
    const amp = ctx.createGain()
    amp.gain.value = .71 + Math.random() * .11
    burst.connect(amp)
    amp.connect(this.master)
    burst.start()
  }

  private rustle(t: number, duration: number, frequency: number, peak: number, bus = this.master): void {
    const ctx = this.ctx
    if (!ctx || !bus) return
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = .75
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(.0001, t)
    amp.gain.exponentialRampToValueAtTime(peak, t + .005)
    amp.gain.exponentialRampToValueAtTime(.0001, t + duration)
    source.connect(filter).connect(amp).connect(bus)
    source.start(t, .19 * (1 + Math.sin(171 * t)), duration)
  }

  private startMusic(): void {
    if (!this.ctx || !this.master || !this.enabled || !this.visible || this.musicTimer) return
    this.musicWanted = true
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.2
      this.musicGain.connect(this.master)
    }
    this.nextNote = this.ctx.currentTime + 0.08
    this.step = 0
    this.pump()
    this.musicTimer = setInterval(() => this.pump(), 140)
  }

  private stopMusic(): void {
    this.musicWanted = false
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = 0
    }
  }

  private pump(): void {
    if (!this.ctx || !this.musicWanted || !this.enabled || !this.musicGain) return
    if (this.ctx.state === 'suspended') return
    const beat = 60 / 128
    const now = this.ctx.currentTime
    if (this.nextNote < now) this.nextNote = now + .015
    while (this.nextNote < now + .28) {
      const slot = this.step % 8
      const bar = BARS[Math.floor(this.step / 8) % BARS.length]
      const when = this.nextNote
      const note = bar.tune[slot]
      if (note) {
        this.soft(midiToHz(note), when, .25, .43, 'sine')
        this.soft(midiToHz(note + 12), when, .095, .11, 'triangle')
      }
      if (slot === 0 || slot === 4) {
        this.soft(midiToHz(bar.root + (slot === 4 ? 7 : 0)), when, .31, .67, 'triangle')
      }
      if (slot === 2 || slot === 6) {
        bar.chord.forEach((n, i) => this.soft(midiToHz(n), when + i * .009, .14, .16, 'triangle'))
      }
      if (slot % 2) this.rustle(when, .053, 5400, .17, this.musicGain)
      this.nextNote += beat * (slot % 2 ? .44 : .56)
      this.step++
    }
  }

  private soft(freq: number, when: number, dur: number, gain: number, type: OscillatorType): void {
    if (!this.ctx || !this.musicGain) return
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    amp.gain.setValueAtTime(0.0001, when)
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.009)
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(amp)
    amp.connect(this.musicGain)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  private piano(freq: number, dur: number, peak: number, delay: number): void {
    if (!this.enabled || !this.visible || !this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const master = this.ctx.createGain()
    master.gain.setValueAtTime(0.0001, t)
    master.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    master.connect(this.master)
    const partials = [
      { mult: 1, type: 'triangle' as OscillatorType, amp: 1 },
      { mult: 2, type: 'sine' as OscillatorType, amp: 0.32 },
      { mult: 3, type: 'sine' as OscillatorType, amp: 0.1 },
    ]
    for (const partial of partials) {
      const osc = this.ctx.createOscillator()
      const amp = this.ctx.createGain()
      osc.type = partial.type
      osc.frequency.setValueAtTime(freq * partial.mult, t)
      amp.gain.value = partial.amp
      osc.connect(amp)
      amp.connect(master)
      osc.start(t)
      osc.stop(t + dur + 0.02)
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.enabled || !this.visible || !this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
}
