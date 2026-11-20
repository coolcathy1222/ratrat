import { SPECIES_IDS, type Species } from '../core/species'

export type Sprite = CanvasImageSource & { width: number; height: number }

export type MakeSprite = () => HTMLImageElement

const SCENES = {supplies:'supplies.png', suppliesPlain:'supplies-plain.png', butterfly:'butterfly.png', assembly:'assembly.png', team:'team.jpg', lookout:'lookout.png', snack:'snack.png', nap:'nap.png'} as const

export class AssetBook {
  calm: Partial<Record<Species, Sprite>> = {}
  shadow: Partial<Record<Species, Sprite>> = {}
  hole: Sprite | undefined
  scenes: Partial<Record<keyof typeof SCENES, Sprite>> = {}
  progress = 0
  readonly openedAt = performance.now()
  ready = false

  async load(base: string, make: MakeSprite): Promise<void> {
    const jobs: Promise<void>[] = []
    for (const name of Object.keys(SCENES) as Array<keyof typeof SCENES>) {
      jobs.push(this.loadSrc(`${base}/squad/${SCENES[name]}`, make).then(image => { this.scenes[name] = image }))
    }
    for (const id of SPECIES_IDS) {
      for (const kind of ['calm', 'shadow'] as const) {
        jobs.push(this.loadOne(`${base}/crew`, id, kind, make))
      }
    }
    jobs.push(
      this.loadSrc(`${base}/heads/hole.png`, make).then((image) => {
        if (image) this.hole = image
      }),
    )
    let loaded = 0
    await Promise.all(jobs.map(job => job.then(() => { this.progress = ++loaded / jobs.length })))
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

  private loadOne(base: string, id: Species, kind: 'calm' | 'shadow', make: MakeSprite): Promise<void> {
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
