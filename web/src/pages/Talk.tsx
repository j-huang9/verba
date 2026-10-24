// Talk: a family member points the phone at the patient, taps Listen, the patient mouths a
// phrase, and the phone shows how sure it is, then speaks it in the patient's voice.
// The phrase board is the fallback, sorted by what the lips suggested. Every message is logged
// and can be undone (undone ones stay in the log, struck through).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { DebugOverlay } from '../components/DebugOverlay'
import { PhraseBoard, type BoardPick } from '../components/PhraseBoard'
import { ConfirmSheet, MessageSheet } from '../components/ResultSheets'
import { Screen } from '../components/Screen'
import type { Guess, Message } from '../engine/types'
import { useLipReader } from '../engine/useLipReader'
import { displayName } from '../lib/format'
import { PHRASES } from '../lib/phrases'
import { href } from '../lib/router'
import { unlockAudio, useSpeaker } from '../lib/speaker'
import { addEntry, getPatient, updateEntry, useLog, usePatient, type Patient } from '../lib/store'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'
import { voiceUrl } from '../lib/voice'

// Let the confidence bar fill before the voice starts.
const SPEAK_DELAY_MS = 800

const isDebug = () => new URLSearchParams(window.location.search).has('debug')

/** the log entry for the message on screen; a correction of the same reading updates it */
interface Current {
  entryId: string
  phraseId: string
  /** lr.guesses of the reading it came from (null for the board) */
  reading: Guess[] | null
  /** the first, misread phrase, kept across repeated corrections */
  original: string
}

interface BoardState {
  likely: Guess[] | null
  rejected: string[]
}

export default function Talk({ id, board }: { id: string; board: boolean }) {
  const patient = usePatient(id)
  if (!patient) {
    return (
      <Screen back="/" title="Patient not found">
        <p className="mt-3 text-muted">They may have been removed from this phone.</p>
      </Screen>
    )
  }
  return <TalkScreen patient={patient} openBoard={board} />
}

function TalkScreen({ patient, openBoard: startWithBoard }: { patient: Patient; openBoard: boolean }) {
  const lr = useLipReader({ personal: patient.calibration?.personal ?? null })
  const speaker = useSpeaker()
  const { speak, stop } = speaker
  const reduced = usePrefersReducedMotion()
  const log = useLog(patient.id)
  const [debug] = useState(isDebug)
  const [board, setBoard] = useState<BoardState | null>(startWithBoard ? { likely: null, rejected: [] } : null)
  const [boardMessage, setBoardMessage] = useState<Message | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const current = useRef<Current | null>(null)
  const unlocked = useRef(false)
  const name = displayName(patient)

  /** speaks in the patient's voice: their cached clone, the demo mp3, or the phone's voice */
  const sayToken = useRef(0)
  const say = useCallback(
    (phraseId: string, text: string, delay = 0) => {
      const mine = ++sayToken.current
      window.setTimeout(async () => {
        if (mine !== sayToken.current) return
        const p = getPatient(patient.id)
        const src = p ? await voiceUrl(p, phraseId) : null
        if (mine === sayToken.current) speak(phraseId, text, src)
      }, delay)
    },
    [patient.id, speak],
  )
  /** stop the voice, including one still waiting on its delay or its audio URL */
  const hush = useCallback(() => {
    sayToken.current++
    stop()
  }, [stop])

  // Log and speak each new lip-reading decision once (lr.message changes identity per decision).
  const logged = useRef<Message | null>(null)
  useEffect(() => {
    const msg = lr.message
    if (!msg || msg === logged.current) return
    logged.current = msg
    const { phrase_id: phraseId, text } = msg.guess
    const c = current.current
    if (c && c.reading === lr.guesses && c.reading !== null) {
      // "Not right?" → another guess for the same reading: correct that entry
      updateEntry(c.entryId, { phraseId, text, confirmedBy: msg.source, correctedFrom: c.original })
      current.current = { ...c, phraseId }
    } else {
      const e = addEntry({ patientId: patient.id, phraseId, text, how: 'lips', confirmedBy: msg.source, confidence: msg.confidence })
      current.current = { entryId: e.id, phraseId, reading: lr.guesses, original: phraseId }
    }
    say(phraseId, text, msg.source === 'confident' ? SPEAK_DELAY_MS : 0)
  }, [lr.message, lr.guesses, patient.id, say])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(t)
  }, [toast])

  // iOS only plays audio after a tap: unlock on the first touch anywhere (e.g. the board opened
  // straight from the patient page, where the patient may pick by blink before anyone taps Listen).
  const unlockOnce = () => {
    if (unlocked.current) return
    unlocked.current = true
    unlockAudio()
  }

  const listen = () => {
    hush() // before unlocking: stop() pauses the element and cancels speech
    unlockAudio() // inside the tap, so iOS allows the voice to play later
    unlocked.current = true
    current.current = null
    setBoardMessage(null)
    lr.listen()
  }

  const showing: Message | null = boardMessage ?? (lr.phase === 'done' ? lr.message : null)

  /** open the board; from a reading, it lists the lips' other guesses first */
  const openBoardFrom = (fromReading: boolean) => {
    const rejected = lr.guesses.map((g) => g.phrase_id)
    if (showing) rejected.push(showing.guess.phrase_id)
    setBoard({ likely: fromReading ? (lr.ranked.length ? lr.ranked : lr.guesses) : null, rejected })
    if (!showing) current.current = null // nothing was said yet, so the board pick is a new entry
    hush()
    setBoardMessage(null)
    lr.reset()
  }

  const onBoardPick = (pick: BoardPick) => {
    const c = current.current
    if (c) {
      // correcting what was just said
      updateEntry(c.entryId, { phraseId: pick.phraseId, text: pick.text, how: pick.how, confirmedBy: pick.confirmedBy, correctedFrom: c.original, confidence: undefined })
      current.current = { ...c, phraseId: pick.phraseId, reading: null }
    } else {
      const e = addEntry({ patientId: patient.id, phraseId: pick.phraseId, text: pick.text, how: pick.how, confirmedBy: pick.confirmedBy })
      current.current = { entryId: e.id, phraseId: pick.phraseId, reading: null, original: pick.phraseId }
    }
    setBoard(null)
    setBoardMessage({ guess: { phrase_id: pick.phraseId, text: pick.text, prob: 1 }, source: pick.confirmedBy, confidence: 1 })
    say(pick.phraseId, pick.text)
  }

  const undo = () => {
    hush()
    if (current.current) updateEntry(current.current.entryId, { undone: true })
    current.current = null
    setBoardMessage(null)
    lr.reset()
    setToast('Undone')
  }

  const usual = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of log) if (!e.undone) counts.set(e.phraseId, (counts.get(e.phraseId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pid]) => pid)
  }, [log])
  const readable = useMemo(() => new Set(lr.model?.classes ?? PHRASES.slice(0, 8).map((p) => p.id)), [lr.model])

  const status = lr.error
    ? lr.error
    : lr.phase === 'loading'
      ? 'Starting camera…'
      : !lr.modelLoaded
        ? 'No lip model yet (open with ?mock to demo)'
        : !lr.face
          ? 'Point the camera at their face'
          : null

  const showControls = !board && !showing && (lr.phase === 'ready' || lr.phase === 'listening' || lr.phase === 'loading' || lr.phase === 'error')

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0d1214] text-white" onPointerDownCapture={unlockOnce}>
      <CameraView
        videoRef={lr.videoRef}
        faceRef={lr.faceRef}
        mirrored={lr.facing === 'user'}
        listening={lr.phase === 'listening'}
        mock={lr.mock}
      />

      {debug && <DebugOverlay read={lr.readDebug} voice={speaker.speaking ? `${speaker.status} ▶` : speaker.status} />}

      <header className="absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/50 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
        <a href={href(`/p/${patient.id}`)} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/40 backdrop-blur active:bg-black/60">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </a>
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="truncate font-phrase text-xl">{name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {patient.calibration?.personal && (
              <p className="inline-flex rounded-full bg-sage/80 px-3 py-1.5 text-sm text-white backdrop-blur">Calibrated for {name}</p>
            )}
            {status && <p className="inline-flex rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/85 backdrop-blur">{status}</p>}
          </div>
        </div>
        {!lr.mock && (
          <button
            type="button"
            onClick={lr.flipCamera}
            aria-label="Switch camera"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-black/40 backdrop-blur active:bg-black/60"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <path d="M9.5 13.5a2.5 2.5 0 0 0 4.6 1.4M14.5 12.5a2.5 2.5 0 0 0-4.6-1.4" />
            </svg>
          </button>
        )}
      </header>

      {showControls && (
        <footer className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/60 to-transparent px-6 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-lg text-white/90" aria-live="polite">
            {toast ??
              lr.notice ??
              (lr.phase === 'listening' ? 'Listening… tap when they’re done' : 'Tap, then ask them to mouth their answer')}
          </p>
          <div className="relative flex w-full items-center justify-center">
            <button
              type="button"
              onClick={lr.phase === 'listening' ? lr.stopListening : listen}
              disabled={lr.phase === 'loading' || lr.phase === 'error'}
              aria-label={lr.phase === 'listening' ? 'Stop listening' : 'Listen'}
              className="relative grid size-20 place-items-center rounded-full bg-white/95 disabled:opacity-40"
            >
              {lr.phase === 'listening' && <span className="absolute inset-0 rounded-full ring-4 ring-sky motion-safe:animate-ping" />}
              {lr.phase === 'listening' ? <span className="size-7 rounded-md bg-sage" /> : <span className="size-14 rounded-full bg-sage" />}
            </button>
            {lr.phase !== 'listening' && (
              <button
                type="button"
                onClick={() => openBoardFrom(false)}
                className="absolute right-0 grid size-14 place-items-center rounded-full bg-black/40 text-sm font-medium backdrop-blur active:bg-black/60"
                aria-label="Phrase board"
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <rect x="13" y="4" width="7" height="7" rx="1.5" />
                  <rect x="4" y="13" width="7" height="7" rx="1.5" />
                  <rect x="13" y="13" width="7" height="7" rx="1.5" />
                </svg>
              </button>
            )}
          </div>
        </footer>
      )}

      {!board && !showing && lr.phase === 'confirming' && lr.guesses.length > 0 && (
        <ConfirmSheet
          guesses={lr.guesses}
          selected={lr.selected}
          blinkProgress={lr.blinkProgress}
          threshold={lr.threshold}
          onChoose={lr.choose}
          onRetry={listen}
          onBoard={() => openBoardFrom(true)}
          mock={lr.mock}
          onSimulateBlink={lr.simulateBlink}
        />
      )}

      {!board && showing && (
        <MessageSheet
          message={showing}
          others={boardMessage ? [] : lr.guesses.filter((g) => g.phrase_id !== showing.guess.phrase_id)}
          threshold={lr.threshold}
          speaking={speaker.speaking}
          fallbackVoice={speaker.fallback && patient.voice.kind !== 'device'}
          reduced={reduced}
          onReplay={() => say(showing.guess.phrase_id, showing.guess.text)}
          onChoose={(pid) => lr.choose(lr.guesses.findIndex((g) => g.phrase_id === pid))}
          onBoard={() => openBoardFrom(!boardMessage)}
          onUndo={undo}
          onNext={listen}
        />
      )}

      {board && (
        <PhraseBoard
          likely={board.likely}
          rejected={board.rejected}
          readable={readable}
          usual={usual}
          face={lr.face}
          faceRef={lr.faceRef}
          mock={lr.mock}
          onSimulateBlink={lr.simulateBlink}
          onPick={onBoardPick}
          onClose={() => setBoard(null)}
        />
      )}
    </main>
  )
}
