// Checks the TS feature + classifier port against Python. Run: npm run test:engine
// Needs src/engine/golden.json and public/model/lipreader.json from `python silentvoice.py train`.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { features, normalize, TRACKED } from './features.ts'
import { forward, personalize } from './mlp.ts'
import { liftedPhrases, rerank } from './priors.ts'

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
const maxDiff = (a: number[], b: number[]) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0)
const worstLogit = maxDiff(golden.logits, forward(model, x))

// Personal calibration: same takes in, same adapted logits out.
let worstPersonal = 0
if (golden.personal) {
  const ids = (golden.personal.labels as number[]).map((c) => model.classes[c])
  const adapted = personalize(model, golden.personal.features, ids)
  worstPersonal = maxDiff(golden.personal.logits, forward({ ...model, ...adapted }, x))
}

// Conversation priors: same rules fire as in Python's regexes, same re-ranked probabilities.
let priorFailures = 0
let worstPrior = 0
for (const c of golden.priors?.cases ?? []) {
  const lifted = [...liftedPhrases(c.question)].sort()
  if (lifted.join() !== c.lifted.join()) {
    priorFailures++
    console.log(`priors: "${c.question}" lifts [${lifted}] in TS but [${c.lifted}] in Python`)
  }
  const guesses = model.classes.map((id: string, i: number) => ({ phrase_id: id, text: id, prob: golden.priors.probs[i] }))
  const byId = Object.fromEntries(rerank(guesses, c.question).map((g) => [g.phrase_id, g.prob]))
  worstPrior = Math.max(worstPrior, maxDiff(c.probs, model.classes.map((id: string) => byId[id])))
}

const ok = x.length === golden.features.length && worst < 1e-9 && worstLogit < 1e-6 && worstPersonal < 1e-6 &&
  priorFailures === 0 && worstPrior < 1e-9
console.log(`features: ${x.length} dims, max diff ${worst.toExponential(2)}; logits max diff ${worstLogit.toExponential(2)}` +
  (golden.personal ? `; personalized logits max diff ${worstPersonal.toExponential(2)}` : '') +
  (golden.priors ? `; ${golden.priors.cases.length} priors cases, max diff ${worstPrior.toExponential(2)}` : ''))
console.log(ok ? 'PASS: TS port matches Python' : 'FAIL: TS port differs from Python')
process.exit(ok ? 0 : 1)
