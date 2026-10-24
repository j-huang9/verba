// "Teach it their lips": the patient mouths each phrase the model knows, `personal.takes`
// rounds (3), hands-free. Then the model adapts to them on the phone (engine/mlp.ts) and an
// honest check runs: each round is held out in turn, and the shared and calibrated models
// are scored on takes they didn't learn from. Saved to patient.calibration.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { predict, type LipModel } from '../engine/classifier'
import { applyPersonal, personalize, type Personal } from '../engine/mlp'
import { useLipReader } from '../engine/useLipReader'
import { PHRASE_BY_ID, PHRASES } from '../lib/phrases'
import { href, navigate } from '../lib/router'
import { updatePatient, usePatient, type Patient } from '../lib/store'

const PROMPT_MS = 1400 // show the next phrase this long, then listen
const MOCK_PLAN = { classes: PHRASES.slice(0, 8).map((p) => p.id), rounds: 3 }

interface Take {
  phraseId: string
  round: number
  x: Float64Array
}

type Check = NonNullable<NonNullable<Patient['calibration']>['check']>

/** Leave one round out: adapt on the other rounds, score first guesses on the held-out one. */
function heldOutCheck(model: LipModel, takes: Take[]): Check | undefined {
  const rounds = [...new Set(takes.map((t) => t.round))]
  if (rounds.length < 2) return undefined
  let before = 0
  let after = 0
  let n = 0
  for (const r of rounds) {
    const train = takes.filter((t) => t.round !== r)
    const test = takes.filter((t) => t.round === r)
    const adapted = applyPersonal(model, personalize(model, train.map((t) => t.x), train.map((t) => t.phraseId)))
    for (const t of test) {
      before += predict(model, t.x)[0].phrase_id === t.phraseId ? 1 : 0
      after += predict(adapted, t.x)[0].phrase_id === t.phraseId ? 1 : 0
      n++
    }
  }
  return { before, after, n }
}

type Stage = 'intro' | 'running' | 'paused' | 'adapting' | 'done'

export default function Teach({ id }: { id: string }) {
  const patient = usePatient(id)
  const [takes, setTakes] = useState<Take[]>([])
  const [stage, setStage] = useState<Stage>('intro')
  const [result, setResult] = useState<Check | null | undefined>(undefined)
  const planRef = useRef<{ phraseId: string; round: number }[]>([])

  const onTake = useCallback((x: Float64Array) => {
    setTakes((ts) => {
      const i = ts.length
      const plan = planRef.current
      if (i >= plan.length) return ts
      return [...ts, { ...plan[i], x }]
    })
  }, [])
  const lr = useLipReader({ onTake })

  const { classes, rounds } = lr.model
    ? { classes: lr.model.classes, rounds: lr.model.personal?.takes ?? 3 }
    : MOCK_PLAN
  const plan = useMemo(
    () => Array.from({ length: rounds }, (_, round) => classes.map((phraseId) => ({ phraseId, round }))).flat(),
    [classes, rounds],
  )
  useEffect(() => {
    planRef.current = plan
  })
  const current = plan[takes.length]
  const finished = takes.length >= plan.length

  const finish = useCallback(() => {
    setStage('adapting')
    // let "Adapting…" paint before the math (a few hundred ms on a phone)
    window.setTimeout(() => {
      const model = lr.model
      let personal: Personal | null = null
      let check: Check | undefined
      if (model && !lr.mock && takes.length) {
        personal = personalize(model, takes.map((t) => t.x), takes.map((t) => t.phraseId))
        check = heldOutCheck(model, takes)
      }
      updatePatient(id, { calibration: { at: Date.now(), takes: takes.length, personal, check } })
      setResult(check ?? null)
      setStage('done')
    }, 50)
  }, [id, lr.model, lr.mock, takes])

  // Hands-free loop: when ready, show the phrase for PROMPT_MS, then listen. A take advances;
  // "Didn't catch that" comes back to ready with the same phrase, so it's simply asked again.
  const { listen, phase } = lr
  useEffect(() => {
    if (stage !== 'running' || phase !== 'ready') return
    const t = finished ? window.setTimeout(finish, 0) : window.setTimeout(listen, PROMPT_MS)
    return () => window.clearTimeout(t)
  }, [stage, phase, takes.length, finished, finish, listen])

  if (!patient) {
    return (
      <main className="grid h-dvh place-items-center bg-canvas p-6 text-center">
        <a href={href('/')} className="text-lg text-sage">Patient not found. Go home</a>
      </main>
    )
  }
  const name = patient.preferredName || patient.name
  const roundDone = (r: number) => takes.filter((t) => t.round === r).length === classes.length
  const canFinishEarly = roundDone(0) && !finished

  if (stage === 'done' || stage === 'adapting') {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-6 bg-canvas px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-ink">
        {stage === 'adapting' ? (
          <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
            <span className="size-10 rounded-full border-4 border-sage-soft border-t-sage motion-safe:animate-spin" />
            <p className="font-phrase text-3xl">Learning {name}’s lips…</p>
          </div>
        ) : (
          <>
            <div className="rounded-card bg-sage-soft px-6 py-6">
              <p className="font-phrase text-4xl">Calibrated for {name}</p>
              <p className="mt-2 text-muted">
                From {takes.length} takes{lr.mock ? ' (demo mode: nothing was learned)' : ''}.
              </p>
            </div>
            {result && (
              <div className="rounded-card bg-surface px-6 py-5 shadow-sm">
                <p className="text-muted">On takes it didn’t learn from, first guess right:</p>
                <p className="mt-2 font-phrase text-3xl">
                  {result.before}/{result.n} <span className="text-muted">→</span> {result.after}/{result.n}
                </p>
                <p className="mt-1 text-sm text-muted">Before and after learning their lips. Each round was held out in turn.</p>
              </div>
            )}
            <button type="button" onClick={() => navigate(`/p/${id}/talk`)} className="w-full rounded-full bg-sage py-4 text-lg font-medium text-surface active:opacity-90">
              Try it now
            </button>
            <a href={href(`/p/${id}`)} className="text-center text-muted">
              Back to {name}
            </a>
          </>
        )}
      </main>
    )
  }

  const listening = lr.phase === 'listening'
  const prompting = stage === 'running' && lr.phase === 'ready' // the PROMPT_MS pause before listening
  const instruction =
    lr.error ??
    (lr.phase === 'loading'
      ? 'Starting camera…'
      : !lr.face
        ? 'Point the camera at their face'
        : stage === 'intro'
          ? `${name} will mouth ${classes.length} phrases, ${rounds} times each. About 2 minutes.`
          : stage === 'paused'
            ? 'Paused'
            : listening
              ? 'Watching their lips…'
              : (lr.notice ?? 'Ask them to mouth:'))

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0d1214] text-white">
      <CameraView videoRef={lr.videoRef} faceRef={lr.faceRef} mirrored={lr.facing === 'user'} listening={listening} mock={lr.mock} />

      <header className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
        <div className="flex items-center justify-between gap-3">
          <a href={href(`/p/${id}`)} aria-label="Back" className="grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur active:bg-black/60">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
          <p className="font-phrase text-xl">Teach it {name}’s lips</p>
          <p className="min-w-11 text-right text-sm text-white/80 tabular-nums">
            {takes.length}/{plan.length}
          </p>
        </div>
        <ProgressGrid classes={classes} rounds={rounds} takes={takes} current={stage === 'intro' ? -1 : takes.length} />
      </header>

      <footer className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-6 pt-20 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-lg text-white/85" aria-live="polite">{instruction}</p>
        {stage !== 'intro' && current && (
          <p
            key={takes.length}
            className={`text-center font-phrase text-5xl leading-tight motion-safe:animate-phrase-in ${prompting || listening ? '' : 'opacity-70'}`}
          >
            “{PHRASE_BY_ID[current.phraseId]?.text ?? current.phraseId}”
          </p>
        )}
        {listening && (
          <button type="button" onClick={lr.stopListening} className="rounded-full bg-white/15 px-5 py-2 text-sm backdrop-blur active:bg-white/25">
            They’re done
          </button>
        )}

        {stage === 'intro' ? (
          <button
            type="button"
            disabled={lr.phase === 'loading' || lr.phase === 'error'}
            onClick={() => setStage('running')}
            className="w-full max-w-sm rounded-full bg-sage py-4 text-lg font-medium text-white disabled:opacity-40 active:opacity-90"
          >
            Start
          </button>
        ) : (
          <div className="flex w-full max-w-sm gap-2">
            <button
              type="button"
              onClick={() => setStage(stage === 'paused' ? 'running' : 'paused')}
              className="flex-1 rounded-full bg-white/15 py-3 font-medium backdrop-blur active:bg-white/25"
            >
              {stage === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              disabled={!takes.length || listening}
              onClick={() => setTakes((ts) => ts.slice(0, -1))}
              className="flex-1 rounded-full bg-white/15 py-3 font-medium backdrop-blur disabled:opacity-40 active:bg-white/25"
            >
              Redo last
            </button>
            {canFinishEarly && (
              <button
                type="button"
                disabled={listening}
                onClick={finish}
                className="flex-1 rounded-full bg-sage py-3 font-medium disabled:opacity-40 active:opacity-90"
              >
                Finish now
              </button>
            )}
          </div>
        )}
      </footer>
    </main>
  )
}

/** phrases (rows) x rounds (columns): filled = taken, ringed = asking now */
function ProgressGrid({ classes, rounds, takes, current }: { classes: string[]; rounds: number; takes: Take[]; current: number }) {
  return (
    <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
      {classes.map((c, ci) => (
        <div key={c} className="flex flex-col gap-1.5">
          {Array.from({ length: rounds }, (_, r) => {
            const i = r * classes.length + ci
            const state = i < takes.length ? 'bg-sage' : i === current ? 'bg-white/30 ring-2 ring-sky' : 'bg-white/20'
            return <span key={r} className={`size-2.5 rounded-full ${state}`} />
          })}
        </div>
      ))}
    </div>
  )
}
