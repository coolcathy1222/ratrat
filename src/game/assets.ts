import { SPECIES_IDS, type Species } from '../core/species'

export type Sprite = CanvasImageSource & { width: number; height: number }

export type MakeSprite = () => HTMLImageElement

const SCENES = {cottage:'cottage.jpg',supplies:'supplies.png', suppliesPlain:'supplies-plain.png', butterfly:'butterfly.png', assembly:'assembly.png', team:'team.jpg', lookout:'lookout.png', snack:'snack.png', nap:'nap.png'} as const

export class AssetBook {
  calm: Partial<Record<Species, Sprite>> = {}
  shadow: Partial<Record<Species, Sprite>> = {}
  meadow: Sprite | undefined
  creamEmpty: Sprite | undefined
  hole: Sprite | undefined
  scenes: Partial<Record<keyof typeof SCENES, Sprite>> = {}
  progress = 0
  readonly openedAt = performance.now()
  ready = false

  private requested = new Map<string, Promise<boolean>>()

  constructor(private base: string, private make: MakeSprite, private webArt?: string) {}

  async loadHome(): Promise<void> {
    void this.scene('assembly')
    void this.scene('butterfly')
    await this.scene('team')
    this.progress = 1
    this.ready = true
  }

  async loadPlay(hero: Species, guest: Species | null): Promise<boolean> {
    const images = [
      this.portrait(hero, 'calm'),
      this.get('heads/hole.png', image => { this.hole = image }),
      this.get('harvest-postcard.jpg', image => { this.meadow = image }),
      this.scene('suppliesPlain'), this.scene('supplies'), this.scene('lookout'),
    ]
    if (guest) images.push(this.portrait(guest, 'calm'), this.portrait(guest, 'shadow'))
    return (await Promise.all(images)).every(Boolean)
  }

  async loadRoom(residents: Species[]): Promise<boolean> {
    const images = [this.scene('cottage'), this.scene('suppliesPlain'),
      ...residents.map(id => this.portrait(id, 'calm'))]
    if (residents.includes('cream')) images.push(this.get('crew/cream-empty.png', image => { this.creamEmpty = image }))
    return (await Promise.all(images)).every(Boolean)
  }

  loadDex(): void {
    for (const id of SPECIES_IDS) {
      void this.portrait(id, 'calm')
      void this.portrait(id, 'shadow')
    }
  }

  scene(name: keyof typeof SCENES): Promise<boolean> {
    return this.get(`squad/${SCENES[name]}`, image => { this.scenes[name] = image })
  }

  private portrait(id: Species, kind: 'calm' | 'shadow'): Promise<boolean> {
    return this.get(`crew/${id}-${kind}.png`, image => { this[kind][id] = image })
  }

  private get(path: string, store: (image: Sprite) => void): Promise<boolean> {
    const existing = this.requested.get(path)
    if (existing) return existing
    const load = async () => {
      const compact = this.webArt && await this.read(`${this.webArt}/${path.replace(/\.\w+$/, '.webp')}`)
      const image = compact || await this.read(`${this.base}/${path}`)
      if (image) store(image)
      else this.requested.delete(path)
      return !!image
    }
    const pending = load()
    this.requested.set(path, pending)
    return pending
  }

  private read(src: string): Promise<Sprite | undefined> {
    return new Promise(resolve => {
      const image = this.make()
      const finish = (result?: Sprite) => {
        clearTimeout(timeout)
        image.onload = null
        image.onerror = null
        resolve(result)
      }
      const timeout = setTimeout(() => finish(), 15000)
      image.onload = () => finish(image.width > 0 ? image : undefined)
      image.onerror = () => finish()
      image.src = src
    })
  }
}
