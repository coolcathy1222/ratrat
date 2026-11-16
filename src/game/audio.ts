const SCALE = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25]

const MELODY = [
  72, 76, 79, 81, 79, 76, 74, 72, 76, 79, 81, 84, 81, 79, 76, 74, 72, 74, 76, 79, 81, 79, 76, 72, 67, 72, 76, 79, 76,
  74, 72, 67,
]

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export class Sfx {
  private ctx: AudioContext | null = null
  private enabled = true
  private musicGain: GainNode | null = null
  private musicTimer = 0
  private musicWanted = false
  private nextNote = 0
  private step = 0

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stopMusic()
    else if (this.ctx) this.startMusic()
  }

  unlock(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!this.ctx) this.ctx = new Ctx()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.enabled) this.startMusic()
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

  fanfare(): void {
    this.piano(523.25, 0.28, 0.26, 0)
    this.piano(659.25, 0.28, 0.26, 0.08)
    this.piano(783.99, 0.28, 0.28, 0.16)
    this.piano(1046.5, 0.55, 0.3, 0.24)
  }

  private startMusic(): void {
    if (!this.ctx || !this.enabled || this.musicTimer) return
    this.musicWanted = true
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.2
      this.musicGain.connect(this.ctx.destination)
    }
    this.nextNote = this.ctx.currentTime + 0.08
    this.step = 0
    this.pump()
    this.musicTimer = window.setInterval(() => this.pump(), 140)
  }

  private stopMusic(): void {
    this.musicWanted = false
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = 0
    }
  }

  private pump(): void {
    if (!this.ctx || !this.musicWanted || !this.enabled || !this.musicGain) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const eighth = 60 / 138 / 2
    while (this.nextNote < this.ctx.currentTime + 0.28) {
      const midi = MELODY[this.step % MELODY.length]
      this.soft(midiToHz(midi), this.nextNote, eighth * 0.92, 0.55)
      if (this.step % 4 === 0) this.soft(midiToHz(midi - 24), this.nextNote, eighth * 2.1, 0.28)
      this.nextNote += eighth
      this.step += 1
    }
  }

  private soft(freq: number, when: number, dur: number, gain: number): void {
    if (!this.ctx || !this.musicGain) return
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, when)
    amp.gain.setValueAtTime(0.0001, when)
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.03)
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(amp)
    amp.connect(this.musicGain)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  private piano(freq: number, dur: number, peak: number, delay: number): void {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime + delay
    const master = this.ctx.createGain()
    master.gain.setValueAtTime(0.0001, t)
    master.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    master.connect(this.ctx.destination)
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
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
}
