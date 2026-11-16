import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const from = resolve(root, 'public/assets')
const to = resolve(root, 'minigame/assets')
mkdirSync(to, { recursive: true })
cpSync(from, to, { recursive: true })
