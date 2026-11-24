import { duets } from './duets'
import { FLIGHT_MS, STAGGER_MS } from './celebration'
import { levelPhrase, phraseIndex, recitalMs, recitalPlan } from './mozart'

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
  constructor(private readonly readClip: (file: string) => Promise<ArrayBuffer>, private readonly createContext?: () => AudioContext) {}

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
    else { this.stopMusic(); this.stopFireworks() }
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

  connect(level: number, index: number, delay = 0): void {
    const {notes,bpm} = levelPhrase(level)
    const [pitch,beats] = notes[index % notes.length]
    this.piano(midiToHz(pitch), Math.min(.72,.24+beats*60/bpm), .21, delay)
  }

  error(): void {
    this.tone(168, 0.12, 'square', 0.07)
  }

  private chirp(low: number, high: number, duration: number, peak: number, delay = 0) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.visible || !this.enabled) return
    const t = ctx.currentTime+delay
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.frequency.setValueAtTime(low,t)
    osc.frequency.exponentialRampToValueAtTime(high,t+duration*.65)
    amp.gain.setValueAtTime(.0001,t)
    amp.gain.exponentialRampToValueAtTime(peak,t+.009)
    amp.gain.exponentialRampToValueAtTime(.0001,t+duration)
    osc.connect(amp).connect(this.master)
    osc.start(t); osc.stop(t+duration+.01)
  }

  tileBloom(index: number, stage: 'arrival' | 'victory' = 'victory') {
    const pitch = [622,740,831,740][index%4]
    this.chirp(pitch*.79,pitch,.095,stage === 'arrival' ? .42 : .58)
  }

  pocketPop(): void {
    this.chirp(295,640,.16,.68)
    this.chirp(575,895,.13,.52,.085)
    for (const [i,pitch] of [698,784,880,784,659,523].entries()) {
      const delay = (FLIGHT_MS+STAGGER_MS*i/5)/1000
      this.chirp(pitch,pitch*.78,.24,.56,delay)
      this.tone(pitch*2,.34,'sine',.18,delay+.024)
    }
  }

  private duetClips = new Map<number,AudioBuffer>()
  private loadingDuets = new Set<number>()

  async prepareRecital(level: number): Promise<void> {
    await Promise.all(recitalPlan(phraseIndex(level)).clips.map((index) => this.loadDuet(index)))
  }

  private async loadDuet(index: number): Promise<void> {
    const ctx = this.ctx
    if (!ctx || this.duetClips.has(index) || this.loadingDuets.has(index)) return
    this.loadingDuets.add(index)
    try {
      const bytes = await this.readClip(`k448-phrase-${index+1}.mp3`)
      const clip = await new Promise<AudioBuffer>((resolve,reject) => ctx.decodeAudioData(bytes,resolve,reject))
      this.duetClips.set(index,clip)
    } catch {
      // A runtime without MP3 decoding plays the same two notated parts below.
    } finally {
      this.loadingDuets.delete(index)
    }
  }

  playRecital(level: number): void {
    const ctx = this.ctx
    if (!this.enabled || !this.visible || !ctx || !this.master) return
    const now = ctx.currentTime
    const phrase = levelPhrase(level)
    const beat = 60/phrase.bpm
    const bus = ctx.createGain()
    bus.connect(this.master)
    this.recitalBus = bus
    const plan = recitalPlan(phraseIndex(level))
    let cursor = 0
    plan.clips.forEach((clipIndex, order) => {
      const span = plan.spans[order]
      const clip = this.duetClips.get(clipIndex)
      if (clip) {
        const source = ctx.createBufferSource()
        const amp = ctx.createGain()
        const startAt = now + cursor * beat
        const stopAt = startAt + span * beat
        source.buffer = clip
        amp.gain.setValueAtTime(1, startAt)
        amp.gain.setValueAtTime(1, Math.max(startAt, stopAt - .04))
        amp.gain.linearRampToValueAtTime(0, stopAt)
        source.connect(amp).connect(bus)
        source.start(startAt)
        source.stop(stopAt + .02)
        source.onended = () => { source.disconnect(); amp.disconnect() }
      } else {
        for (const part of duets[clipIndex].parts) {
          for (const [start,duration,...chord] of part) {
            const startBeat = start/96
            if (startBeat >= span) continue
            const heard = Math.min(duration/96, span - startBeat)
            for (const pitch of chord) {
              this.piano(midiToHz(pitch),heard*beat+.05,.13/Math.sqrt(chord.length),(cursor+startBeat)*beat,bus)
            }
          }
        }
      }
      cursor += span
    })
    if (this.musicGain) {
      const gain = this.musicGain.gain
      gain.cancelScheduledValues(now)
      gain.setTargetAtTime(.001,now,.04)
      gain.setTargetAtTime(.2,now+recitalMs(phrase)/1000,.10)
    }
  }

  cheer(): number {
    const pitches = [260, 322, 213, 380, 291, 238]
    const endOffset = (i: number) => i*.052 + .56 + (i%3)*.11
    const durationMs = Math.ceil(endOffset(pitches.length-1)*1000)
    const ctx = this.ctx
    if (!this.enabled || !this.visible || !ctx || !this.master) return durationMs
    const now = ctx.currentTime
    this.recitalBus?.disconnect()
    const bus = ctx.createGain()
    bus.connect(this.master)
    this.recitalBus = bus
    // A little crowd singing "woo!" with staggered voices and moving vowel formants.
    for (const [i, pitch] of pitches.entries()) {
      const t = now + i * .052
      const end = now + endOffset(i)
      const voice = ctx.createOscillator()
      voice.type = 'sawtooth'
      voice.frequency.setValueAtTime(pitch * .85, t)
      voice.frequency.exponentialRampToValueAtTime(pitch * 1.65, t + .23)
      voice.frequency.exponentialRampToValueAtTime(pitch * 1.12, end)
      for (const [start, finish, gain] of [[620, 400, .029], [1450, 910, .017]]) {
        const vowel = ctx.createBiquadFilter()
        vowel.type = 'bandpass'
        vowel.Q.value = 2.6
        vowel.frequency.setValueAtTime(start, t)
        vowel.frequency.exponentialRampToValueAtTime(finish, end)
        const amp = ctx.createGain()
        amp.gain.setValueAtTime(.0001, t)
        amp.gain.exponentialRampToValueAtTime(gain, t + .09)
        amp.gain.exponentialRampToValueAtTime(.0001, end)
        voice.connect(vowel).connect(amp).connect(bus)
      }
      voice.start(t)
      voice.stop(end)
    }
    return durationMs
  }

  private async loadBurst(ctx: AudioContext): Promise<void> {
    if (this.loadingBurst || ctx.currentTime < this.nextBurstRetry) return
    this.loadingBurst = true
    try {
      const bytes = await this.readClip('meadow-rocket.wav')
      this.burstSample = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(bytes, resolve, reject)
      })
    } catch {
      this.nextBurstRetry = ctx.currentTime + 5
    } finally {
      this.loadingBurst = false
    }
  }

  private recitalBus: GainNode | null = null
  private rockets = new Set<AudioBufferSourceNode>()

  launch(): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.visible || !this.enabled) return
    if (!this.burstSample) { void this.loadBurst(ctx); return }
    const rocket = ctx.createBufferSource()
    rocket.buffer = this.burstSample
    const amp = ctx.createGain()
    amp.gain.value = .74 + Math.random() * .12
    rocket.connect(amp)
    amp.connect(this.master)
    this.rockets.add(rocket)
    rocket.onended = () => { this.rockets.delete(rocket); rocket.disconnect(); amp.disconnect() }
    rocket.start()
  }

  stopFireworks(): void {
    this.recitalBus?.disconnect()
    this.recitalBus = null
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.musicGain.gain.setTargetAtTime(.2,this.ctx.currentTime,.04)
    }
    for (const rocket of this.rockets) rocket.stop()
    this.rockets.clear()
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

  private piano(freq: number, dur: number, peak: number, delay: number, bus = this.master): void {
    if (!this.enabled || !this.visible || !this.ctx || !bus) return
    const t = this.ctx.currentTime + delay
    // Hammer harmonics die away before the sustained fundamental, like a felt piano.
    for (const [ratio, weight, decay] of [[1,1,1],[2.001,.39,.68],[3.004,.18,.43],[4.007,.085,.23]]) {
      const osc = this.ctx.createOscillator()
      const amp = this.ctx.createGain()
      const level = peak * weight
      const tail = dur * decay
      osc.type = 'sine'
      osc.frequency.value = freq * ratio
      amp.gain.setValueAtTime(.0001,t)
      amp.gain.exponentialRampToValueAtTime(level,t+.008)
      amp.gain.exponentialRampToValueAtTime(level*.32,t+tail*.24)
      amp.gain.exponentialRampToValueAtTime(.0001,t+tail)
      osc.connect(amp).connect(bus)
      osc.start(t)
      osc.stop(t+tail+.01)
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
