import { SPECIES_IDS, type Species } from '../core/species'

export type Sprite = CanvasImageSource & { width: number; height: number }

export type MakeSprite = () => HTMLImageElement

const SCENES = {cottage:'cottage.jpg',supplies:'supplies.png', suppliesPlain:'supplies-plain.png', butterfly:'butterfly.png', assembly:'assembly.png', team:'team.jpg', lookout:'lookout.png', snack:'snack.png', nap:'nap.png'} as const

export class AssetBook {
  calm: Partial<Record<Species, Sprite>> = {}
  shadow: Partial<Record<Species, Sprite>> = {}
  creamEmpty: Sprite | undefined
  hole: Sprite | undefined
  scenes: Partial<Record<keyof typeof SCENES, Sprite>> = {}
  progress = 0
  readonly openedAt = performance.now()
  ready = false

  private requested = new Set<string>()

  constructor(private base: string, private make: MakeSprite, private webArt?: string) {}

  async loadHome(): Promise<void> {
    void this.scene('assembly')
    void this.scene('butterfly')
    await this.scene('team')
    this.progress = 1
    this.ready = true
  }

  loadPlay(hero: Species, guest: Species | null): void {
    void this.portrait(hero, 'calm')
    if (guest) {
      void this.portrait(guest, 'calm')
      void this.portrait(guest, 'shadow')
    }
    void this.get('heads/hole.png', image => { this.hole = image })
    void this.scene('suppliesPlain')
    void this.scene('supplies')
    void this.scene('lookout')
  }

  loadRoom(residents: Species[]): void {
    void this.scene('cottage')
    for (const id of residents) void this.portrait(id, 'calm')
    void this.get('crew/cream-empty.png', image => { this.creamEmpty = image })
    void this.scene('suppliesPlain')
  }

  loadDex(): void {
    for (const id of SPECIES_IDS) {
      void this.portrait(id, 'calm')
      void this.portrait(id, 'shadow')
    }
  }

  scene(name: keyof typeof SCENES): Promise<void> {
    return this.get(`squad/${SCENES[name]}`, image => { this.scenes[name] = image })
  }

  private portrait(id: Species, kind: 'calm' | 'shadow'): Promise<void> {
    return this.get(`crew/${id}-${kind}.png`, image => { this[kind][id] = image })
  }

  private async get(path: string, store: (image: Sprite) => void): Promise<void> {
    if (this.requested.has(path)) return
    this.requested.add(path)
    const compact = this.webArt && await this.read(`${this.webArt}/${path.replace(/\.\w+$/, '.webp')}`)
    const image = compact || await this.read(`${this.base}/${path}`)
    if (image) store(image)
    else this.requested.delete(path)
  }

  private read(src: string): Promise<Sprite | undefined> {
    return new Promise(resolve => {
      const image = this.make()
      image.onload = () => resolve(image.width > 0 ? image : undefined)
      image.onerror = () => resolve(undefined)
      image.src = src
    })
  }
}
