// Checks the TS feature + classifier port against Python. Run: npm run test:engine
// Needs src/engine/golden.json and public/model/lipreader.json from `python silentvoice.py train`.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { features, normalize, TRACKED } from './features.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const goldenPath = `${here}golden.json`
const modelPath = `${here}../../public/model/lipreader.json`
if (!existsSync(goldenPath) || !existsSync(modelPath)) {
  console.log('skip: run `python silentvoice.py train` first to create golden.json + lipreader.json')
  process.exit(0)
}

const golden = JSON.parse(readFileSync(goldenPath, 'utf8'))
const model = JSON.parse(readFileSync(modelPath, 'utf8'))

const seq = (golden.points as number[][][]).map((frame) => {
  if (frame.length !== TRACKED.length) throw new Error(`expected ${TRACKED.length} points per frame`)
  return normalize(Float64Array.from(frame.flat()), golden.w, golden.h)
})
const x = features(seq)

let worst = 0
golden.features.forEach((v: number, i: number) => (worst = Math.max(worst, Math.abs(v - x[i]))))
// Same forward pass as classifier.ts (which can't be imported here: it pulls in app modules).
const affine = (coef: number[][], b: number[], v: ArrayLike<number>) =>
  coef.map((w, i) => w.reduce((z, wj, j) => z + wj * v[j], b[i]))
const h = model.hidden ? affine(model.hidden.coef, model.hidden.intercept, x).map((v) => Math.max(v, 0)) : x
const logits = affine(model.coef, model.intercept, h)
let worstLogit = 0
golden.logits.forEach((v: number, i: number) => (worstLogit = Math.max(worstLogit, Math.abs(v - logits[i]))))

const ok = x.length === golden.features.length && worst < 1e-9 && worstLogit < 1e-6
console.log(`features: ${x.length} dims, max diff ${worst.toExponential(2)}; logits max diff ${worstLogit.toExponential(2)}`)
console.log(ok ? 'PASS: TS port matches Python' : 'FAIL: TS port differs from Python')
process.exit(ok ? 0 : 1)
