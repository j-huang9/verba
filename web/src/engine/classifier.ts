// Runs the model exported by `python silentvoice.py train` (web/public/model/lipreader.json).
// The scaler is folded into the weights. Version 2 (MLP): h = relu(hidden.coef @ x + hidden.intercept),
// logits = coef @ h + intercept. Version 1 (logistic regression, no `hidden`): logits = coef @ x + intercept.
import { LIPS, REF } from './features'
import { PHRASE_BY_ID } from '../lib/phrases'
import type { Guess } from './types'

export interface LipModel {
  version: number
  seq_len: number
  lips: number[]
  ref: number[]
  classes: string[]
  temperature: number
  /** speak right away at or above this confidence, else ask the patient to confirm */
  threshold: number
  /** MLP hidden layer, [units][features]. Absent in version-1 (linear) models. */
  hidden?: { intercept: number[]; coef: number[][] }
  intercept: number[]
  coef: number[][]
}

function affine(coef: number[][], intercept: number[], x: ArrayLike<number>): number[] {
  return coef.map((w, i) => {
    let z = intercept[i]
    for (let j = 0; j < w.length; j++) z += w[j] * x[j]
    return z
  })
}

export async function loadModel(url = '/model/lipreader.json'): Promise<LipModel | null> {
  const res = await fetch(url)
  // Not trained yet: 404, or the dev server's index.html fallback.
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
  const model = (await res.json()) as LipModel
  if (model.lips.join() !== LIPS.join() || model.ref.join() !== REF.join()) {
    throw new Error('lipreader.json landmark indices differ from features.ts. Re-export or update the TS port.')
  }
  return model
}

export function logits(model: LipModel, x: Float64Array): number[] {
  const h = model.hidden ? affine(model.hidden.coef, model.hidden.intercept, x).map((v) => Math.max(v, 0)) : x
  return affine(model.coef, model.intercept, h)
}

/** All classes, most likely first, with temperature-calibrated probabilities. */
export function predict(model: LipModel, x: Float64Array): Guess[] {
  const z = logits(model, x).map((v) => v / model.temperature)
  const max = Math.max(...z)
  const e = z.map((v) => Math.exp(v - max))
  const sum = e.reduce((a, b) => a + b, 0)
  return model.classes
    .map((id, i) => ({ phrase_id: id, text: PHRASE_BY_ID[id]?.text ?? id, prob: e[i] / sum }))
    .sort((a, b) => b.prob - a.prob)
}
