import { SPECIES_IDS, type Species } from '../core/species'

export type Sprite = CanvasImageSource & { width: number; height: number }

export type MakeSprite = () => HTMLImageElement

export class AssetBook {
  calm: Partial<Record<Species, Sprite>> = {}
  angry: Partial<Record<Species, Sprite>> = {}
  shadow: Partial<Record<Species, Sprite>> = {}
  hole: Sprite | undefined
  ready = false

  async load(base: string, make: MakeSprite): Promise<void> {
    const jobs: Promise<void>[] = []
    for (const id of SPECIES_IDS) {
      for (const kind of ['calm', 'angry', 'shadow'] as const) {
        jobs.push(this.loadOne(base, id, kind, make))
      }
    }
    jobs.push(
      this.loadSrc(`${base}/hole.png`, make).then((image) => {
        if (image) this.hole = image
      }),
    )
    await Promise.all(jobs)
    this.ready = true
  }

  private loadSrc(src: string, make: MakeSprite): Promise<Sprite | undefined> {
    return new Promise((resolve) => {
      const image = make()
      image.onload = () => resolve(image.width > 0 ? image : undefined)
      image.onerror = () => resolve(undefined)
      image.src = src
    })
  }

  private loadOne(base: string, id: Species, kind: 'calm' | 'angry' | 'shadow', make: MakeSprite): Promise<void> {
    return new Promise((resolve) => {
      const image = make()
      image.onload = () => {
        this[kind][id] = image
        resolve()
      }
      image.onerror = () => resolve()
      image.src = `${base}/${id}-${kind}.png`
    })
  }
}
