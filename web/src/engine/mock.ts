// ?mock mode: a fake face feed and scripted readings, so the UI can be built without a
// camera or a trained model. Alternates a confident reading with an unsure one.
import { PHRASE_BY_ID } from '../lib/phrases'
import { N_LIPS, TRACKED } from './features'
import type { TrackerFrame } from './tracker'
import type { Guess } from './types'

const SCRIPT: [string, number][][] = [
  [['where_mom', 0.86], ['where_family', 0.08], ['thank_you', 0.03]],
  [['thirsty', 0.47], ['in_pain', 0.31], ['cold', 0.12]],
  [['cant_breathe', 0.91], ['in_pain', 0.05], ['scared', 0.02]],
  [['love_you', 0.52], ['thank_you', 0.29], ['yes', 0.1]],
]
let turn = 0

export function mockResult(): Guess[] {
  const row = SCRIPT[turn++ % SCRIPT.length]
  return row.map(([id, prob]) => ({ phrase_id: id, text: PHRASE_BY_ID[id].text, prob }))
}

/** Calls onFrame ~30 times a second with a synthetic face. Returns a stop function. */
export function startMockFeed(onFrame: (f: TrackerFrame) => void, mouthing: () => boolean): () => void {
  const w = 720
  const h = 960 // portrait phone camera
  const start = performance.now()
  const id = window.setInterval(() => {
    const t = (performance.now() - start) / 1000
    const open = mouthing() ? Math.max(0, Math.sin(t * 9)) : 0.04
    const points = new Float64Array(TRACKED.length * 2)
    const cx = 0.5
    const cy = 0.6
    for (let i = 0; i < N_LIPS; i++) {
      const inner = i >= 20
      const th = Math.PI - ((i % 20) * Math.PI) / 10 // 0 left corner, 5 bottom, 10 right, 15 top
      const s = Math.sin(th)
      const a = (inner ? 0.085 : 0.12) - open * 0.012
      const top = inner ? 0.003 + open * 0.01 : 0.022 + open * 0.008
      const bottom = inner ? 0.003 + open * 0.022 : 0.026 + open * 0.026
      points[2 * i] = cx + a * Math.cos(th)
      points[2 * i + 1] = cy + (s > 0 ? bottom * s : top * s)
    }
    const ref = [[0.38, 0.4], [0.62, 0.4], [0.5, 0.5], [0.5, 0.72]]
    ref.forEach(([x, y], k) => {
      points[2 * (N_LIPS + k)] = x
      points[2 * (N_LIPS + k) + 1] = y
    })
    onFrame({ points, blink: 0, w, h })
  }, 33)
  return () => window.clearInterval(id)
}
