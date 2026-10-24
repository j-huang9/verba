// Model math on the exported lipreader.json: the forward pass and personal calibration
// ("Teach it their lips"). Line-for-line port of web_hidden / web_logits / personalize in
// silentvoice.py; golden.test.ts checks both. No app imports, so Node can run the test.
import type { LipModel } from './classifier'

/** What personalize() produces. Store it on the phone and pass it to applyPersonal(). */
export interface Personal {
  classes: string[]
  intercept: number[]
  coef: number[][]
  temperature: number
}

function affine(coef: number[][], intercept: number[], x: ArrayLike<number>): number[] {
  return coef.map((w, i) => {
    let z = intercept[i]
    for (let j = 0; j < w.length; j++) z += w[j] * x[j]
    return z
  })
}

/** Hidden-layer activations. Version-1 (linear) models have no hidden layer: returns x. */
export function hidden(model: LipModel, x: ArrayLike<number>): ArrayLike<number> {
  if (!model.hidden) return x
  return affine(model.hidden.coef, model.hidden.intercept, x).map((v) => Math.max(v, 0))
}

export function forward(model: LipModel, x: ArrayLike<number>): number[] {
  return affine(model.coef, model.intercept, hidden(model, x))
}

/**
 * Fine-tune the output layer on a few takes from one person (3 per phrase).
 * xs: feature vectors from features(), phraseIds: what each take was.
 * Gradient descent on cross-entropy with an L2 pull back to the shared weights.
 * About 15M multiply-adds for 24 takes: well under a second on a phone.
 */
export function personalize(model: LipModel, xs: ArrayLike<number>[], phraseIds: string[]): Personal {
  const p = model.personal ?? { steps: 300, lam_w: 0.1, lam_b: 0.1, temperature: model.temperature }
  const C = model.classes.length
  const ys = phraseIds.map((id) => {
    const c = model.classes.indexOf(id)
    if (c < 0) throw new Error(`personalize: ${id} is not in the model`)
    return c
  })
  const H = xs.map((x) => Array.from(hidden(model, x)))
  const n = H.length
  const D = H[0].length
  let sq = 0
  for (const h of H) for (const v of h) sq += v * v
  const lr = 1 / (sq / n + 1)

  const W0 = model.coef
  const b0 = model.intercept
  let W = W0.map((row) => row.slice())
  let b = b0.slice()
  for (let step = 0; step < p.steps; step++) {
    // G[i][c] = (softmax(W h_i + b)[c] - [c == y_i]) / n
    const G = H.map((h, i) => {
      const z = affine(W, b, h)
      const max = Math.max(...z)
      const e = z.map((v) => Math.exp(v - max))
      const sum = e.reduce((a, v) => a + v, 0)
      return e.map((v, c) => (v / sum - (c === ys[i] ? 1 : 0)) / n)
    })
    W = W.map((row, c) => {
      const next = new Array<number>(D)
      for (let j = 0; j < D; j++) {
        let g = 0
        for (let i = 0; i < n; i++) g += G[i][c] * H[i][j]
        next[j] = row[j] - lr * (g + p.lam_w * (row[j] - W0[c][j]))
      }
      return next
    })
    b = b.map((bc, c) => {
      let g = 0
      for (let i = 0; i < n; i++) g += G[i][c]
      return bc - 0.5 * (g + p.lam_b * (bc - b0[c]))
    })
  }
  return { classes: model.classes.slice(), intercept: b, coef: W.slice(0, C), temperature: p.temperature }
}

/** The shared model with a person's output layer swapped in. Ignores it if the model changed. */
export function applyPersonal(model: LipModel, personal: Personal | null): LipModel {
  if (!personal || personal.classes.join() !== model.classes.join()) return model
  if (personal.coef[0]?.length !== model.coef[0]?.length) return model
  return { ...model, coef: personal.coef, intercept: personal.intercept, temperature: personal.temperature }
}
