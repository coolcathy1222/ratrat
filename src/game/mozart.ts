import { duets } from './duets'

// K.448, upper voice of Piano I. Durations and following rests are in quarter notes.
type Note = readonly [midi: number, beats: number, rest?: number]
interface Phrase {
  bpm: number
  notes: readonly Note[]
}

const phrases: readonly Phrase[] = [
  // Allegro con spirito: opening fanfare and turn.
  {bpm: 138, notes: [
    [86,2],[81,2],[78,.15],[79,.15],[78,.15],[79,.15],[78,.9],
    [76,.25],[74,.25],[81,1,.5],[69,1/6],[71,1/6],[73,1/6],[74,1],
  ]},
  // The dotted answer to the fanfare (mm. 3–4).
  {bpm: 138, notes: [
    [74,1],[69,.75],[74,.25],[76,1],[69,.75],[76,.25],
    [78,1],[74,.75],[78,.25],[81,1,1],
  ]},
  // The ascending runs passed between the two pianos (mm. 9–10).
  {bpm: 138, notes: [
    [69,.25],[71,.25],[73,.25],[74,.25],[76,.25],[78,.25],[79,.25],
    [81,.25],[83,.25],[85,.25],[86,.25],[81,.5,.75],
    [69,.25],[71,.25],[73,.25],[74,.25],[76,.25],[78,.25],[80,.25],
    [81,.25],[83,.25],[86,.25],[88,.25],[81,.5],
  ]},
  // Andante: opening cantabile, including the short introductory ornament.
  {bpm: 80, notes: [
    [74,1],[72,.12],[74,.12],[76,.12],[74,1.14],[73,.5],
    [73,.25],[71,.25],[76,.25],[74,.25],[74,1,1],
    [76,.75],[78,.0625],[76,.0625],[74,.0625],[76,.0625],[78,1],[81,.5],[79,.5],
  ]},
  // Allegro molto: upbeat and the first statement of the rondo refrain.
  {bpm: 144, notes: [
    [88,.25],[86,.25],[85,.25],[86,.25],
    [81,.5,.5],[83,.25],[81,.25],[80,.25],[81,.25],
    [78,.5,.5],[79,.25],[78,.25],[77,.25],[78,.25],
    [76,.25],[74,.25],[73,.25],[74,.25],[78,.25],[76,.25],[75,.25],[76,.25],
    [78,.25],[76,.25],[78,.25],[79,.25],[81,.25],[78,.25],[81,.25],[78,.25],
  ]},
]

export function phraseIndex(level: number) {
  return (level - 1) % phrases.length
}

export function levelPhrase(level: number): Phrase {
  return phrases[phraseIndex(level)]
}

// One bar-group. Andante is in 3/4; the other celebrations are counted in two-bar groups.
function phraseUnit(index: number): number {
  return index === 3 ? 6 : 8
}

export interface RecitalPlan {
  clips: number[]
  spans: number[]
  beats: number
}

// Play a finished sentence: one phrase, or two. Never a phrase plus a leftover half.
export function recitalPlan(index: number): RecitalPlan {
  if (index === 0) return {clips: [0, 1], spans: [7.75, 8.25], beats: 16}
  const unit = phraseUnit(index)
  const phrasesInExcerpt = Math.min(2, Math.floor(duets[index].beats / unit))
  const beats = Math.max(1, phrasesInExcerpt) * unit
  return {clips: [index], spans: [beats], beats}
}

export function recitalMs(phrase: Phrase): number {
  const plan = recitalPlan(phrases.indexOf(phrase))
  return Math.ceil(plan.beats * 60000 / phrase.bpm) + 420
}
