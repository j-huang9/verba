// The phrase board: the fallback when lip reading misses, sorted so a wrong read still helps.
// Sections: "Likely from their lips" (only when opened from a reading) · Urgent · Their usual ·
// each category. Covers the camera, which keeps running underneath so blinks are still seen.
//   Tap mode: tap a phrase, then the patient holds their eyes closed (or nods and you tap Yes).
//   Blink scan (switch scanning, a standard AAC method): sections light up in turn; a long
//   blink enters one, the scan steps through its phrases + Back, and a long blink says it.
//   A double blink goes back.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Guess, TrackedFace } from '../engine/types'
import { PHRASES, type Phrase } from '../lib/phrases'
import { useBlinkSwitch } from '../lib/useBlinkSwitch'
import { ConfirmRing } from './ConfirmRing'

const CATEGORY_LABELS: Record<string, string> = {
  answer: 'Yes and no',
  comfort: 'Comfort',
  medical: 'Medical',
  needs: 'Needs',
  feelings: 'Feelings',
  questions: 'Questions',
  family: 'Family',
  social: 'Social',
}
const SPEEDS = [1000, 1500, 2000, 3000]

interface Section {
  key: string
  title: string
  phrases: Phrase[]
  /** % from the lip reader, for the "Likely" section */
  probs?: Record<string, number>
}

export type BoardPick = { phraseId: string; text: string; how: 'board' | 'scan'; confirmedBy: 'blink' | 'tap' }

function LipsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-sky" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-label="The lip reader knows this one">
      <path d="M3 12c3-4 6-5 9-3 3-2 6-1 9 3-3 4-6 5-9 5s-6-1-9-5z" />
      <path d="M3 12h18" />
    </svg>
  )
}

export function PhraseBoard({
  likely,
  rejected,
  readable,
  usual,
  face,
  faceRef,
  mock,
  onSimulateBlink,
  onPick,
  onClose,
}: {
  /** lr.ranked when opened from a reading, else null (section hidden) */
  likely: Guess[] | null
  /** phrase ids just rejected (left out of "Likely") */
  rejected: string[]
  /** phrase ids the lip model can read (small lips icon) */
  readable: Set<string>
  /** phrase ids for "Their usual" */
  usual: string[]
  face: boolean
  faceRef: RefObject<TrackedFace | null>
  mock: boolean
  onSimulateBlink: (closed: boolean) => void
  onPick: (p: BoardPick) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'tap' | 'scan'>('tap')
  const [speed, setSpeed] = useState(1500)
  const [asking, setAsking] = useState<Phrase | null>(null)

  const sections = useMemo(() => {
    const byId = new Map(PHRASES.map((p) => [p.id, p]))
    const out: Section[] = []
    if (likely) {
      const rest = likely.filter((g) => !rejected.includes(g.phrase_id) && byId.has(g.phrase_id))
      if (rest.length)
        out.push({
          key: 'likely',
          title: 'Likely from their lips',
          phrases: rest.map((g) => byId.get(g.phrase_id)!),
          probs: Object.fromEntries(rest.map((g) => [g.phrase_id, g.prob])),
        })
    }
    out.push({ key: 'urgent', title: 'Urgent', phrases: PHRASES.filter((p) => p.urgent) })
    const usualPhrases = usual.map((id) => byId.get(id)).filter((p): p is Phrase => !!p)
    if (usualPhrases.length) out.push({ key: 'usual', title: 'Their usual', phrases: usualPhrases })
    for (const cat of [...new Set(PHRASES.map((p) => p.category))])
      out.push({ key: cat, title: CATEGORY_LABELS[cat] ?? cat, phrases: PHRASES.filter((p) => p.category === cat) })
    return out
  }, [likely, rejected, usual])

  // ---- blink scan ----
  // section: which section is lit; item: null = choosing a section, else index into its phrases (+ Back)
  const [scan, setScan] = useState<{ section: number; item: number | null }>({ section: 0, item: null })
  const scanning = mode === 'scan' && !asking
  const blink = useBlinkSwitch(
    faceRef,
    scanning || !!asking,
    () => {
      if (asking) return pick(asking, 'board', 'blink')
      const sec = sections[scan.section]
      if (scan.item === null) return setScan({ section: scan.section, item: 0 })
      if (scan.item >= sec.phrases.length) return setScan({ section: scan.section, item: null }) // Back
      pick(sec.phrases[scan.item], 'scan', 'blink')
    },
    () => {
      if (scanning && scan.item !== null) setScan({ section: scan.section, item: null })
    },
  )

  useEffect(() => {
    if (!scanning || blink.closed) return // pause while the eyes are closed
    const id = window.setTimeout(() => {
      setScan((s) =>
        s.item === null
          ? { section: (s.section + 1) % sections.length, item: null }
          : { section: s.section, item: (s.item + 1) % (sections[s.section].phrases.length + 1) },
      )
    }, speed)
    return () => window.clearTimeout(id)
  }, [scanning, blink.closed, scan, speed, sections])

  // keep the lit section / phrase in view
  const litRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (scanning) litRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [scanning, scan])

  const startScan = () => {
    setMode('scan')
    setScan({ section: 0, item: null })
  }

  function pick(p: Phrase, how: BoardPick['how'], confirmedBy: BoardPick['confirmedBy']) {
    setAsking(null)
    onPick({ phraseId: p.id, text: p.text, how, confirmedBy })
  }

  const lit = (si: number, pi?: number) =>
    scanning && scan.section === si && (pi === undefined ? scan.item === null : scan.item === pi)

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-line px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button type="button" onClick={onClose} aria-label="Close phrase board" className="-ml-2 grid size-11 place-items-center rounded-full active:bg-line">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h2 className="flex-1 font-phrase text-2xl">Phrase board</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${face ? 'bg-sage-soft text-sage' : 'bg-honey-soft text-honey'}`}>
          {face ? 'Eyes visible' : 'Can’t see their face'}
        </span>
      </header>

      <div className="flex items-center gap-2 px-5 py-3">
        <div className="flex rounded-full bg-surface p-1 shadow-sm">
          <button type="button" onClick={() => setMode('tap')} className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'tap' ? 'bg-sage text-surface' : 'text-muted'}`}>
            Tap
          </button>
          <button type="button" onClick={startScan} className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'scan' ? 'bg-sage text-surface' : 'text-muted'}`}>
            Blink scan
          </button>
        </div>
        {mode === 'scan' && (
          <button
            type="button"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className="rounded-full border border-line px-3 py-2 text-sm text-muted"
            aria-label="Scan speed"
          >
            {speed / 1000} s
          </button>
        )}
        {mock && (mode === 'scan' || asking) && (
          <button
            type="button"
            onPointerDown={() => onSimulateBlink(true)}
            onPointerUp={() => onSimulateBlink(false)}
            onPointerLeave={() => onSimulateBlink(false)}
            className="ml-auto rounded-full border border-dashed border-line px-3 py-2 text-xs text-muted select-none"
          >
            Hold = blink
          </button>
        )}
      </div>
      {mode === 'scan' && (
        <p className="px-5 pb-2 text-sm text-muted">Hold eyes closed to choose. Blink twice to go back.</p>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {sections.map((sec, si) => (
          <section
            key={sec.key}
            ref={lit(si) ? (el) => void (litRef.current = el) : undefined}
            className={`mt-3 rounded-card p-3 transition-colors duration-300 ease-calm ${lit(si) ? 'bg-sage-soft ring-2 ring-sage' : ''}`}
          >
            <h3 className="px-1 pb-2 text-sm font-semibold tracking-wide text-muted uppercase">{sec.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {sec.phrases.map((p, pi) => (
                <button
                  key={p.id}
                  ref={lit(si, pi) ? (el) => void (litRef.current = el) : undefined}
                  type="button"
                  onClick={() => setAsking(p)}
                  className={`flex min-h-20 flex-col justify-between rounded-2xl bg-surface p-3 text-left shadow-sm active:bg-line ${lit(si, pi) ? 'ring-4 ring-sage' : ''}`}
                >
                  <span className="font-phrase text-xl leading-tight text-balance">{p.text}</span>
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    {readable.has(p.id) && <LipsIcon />}
                    {sec.probs && <span className="tabular-nums">{Math.round(sec.probs[p.id] * 100)}%</span>}
                  </span>
                </button>
              ))}
              {scanning && scan.section === si && scan.item !== null && (
                <span
                  ref={lit(si, sec.phrases.length) ? (el) => void (litRef.current = el) : undefined}
                  className={`grid min-h-20 place-items-center rounded-2xl border border-dashed border-line text-muted ${lit(si, sec.phrases.length) ? 'ring-4 ring-sage' : ''}`}
                >
                  ← Back
                </span>
              )}
            </div>
          </section>
        ))}
      </div>

      {asking && (
        <div className="absolute inset-x-0 bottom-0 z-10 animate-sheet-in rounded-t-[2rem] bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] motion-reduce:animate-none">
          <p className="text-muted">Ask them:</p>
          <div className="mt-2 flex items-center gap-5">
            <ConfirmRing progress={blink.progress} size={64}>
              ?
            </ConfirmRing>
            <p className="font-phrase text-4xl leading-tight text-balance">“{/[?!.]$/.test(asking.text) ? asking.text : `${asking.text}?`}”</p>
          </div>
          <p className="mt-3 text-muted">Hold eyes closed to say it, or tap Yes if they nod.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setAsking(null)} className="rounded-full bg-canvas py-3.5 font-medium">
              Not this
            </button>
            <button type="button" onClick={() => pick(asking, 'board', 'tap')} className="rounded-full bg-sage py-3.5 font-medium text-surface">
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
