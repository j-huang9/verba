// The whole app: a family member points the phone at the patient, taps Listen, the patient
// mouths a phrase, and the phone shows how sure it is, then speaks it in the patient's voice.
import { useEffect, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { DebugOverlay } from '../components/DebugOverlay'
import { ConfirmSheet, MessageSheet } from '../components/ResultSheets'
import { useLipReader } from '../engine/useLipReader'
import { unlockAudio, useSpeaker } from '../lib/speaker'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

// Let the confidence bar fill before the voice starts.
const SPEAK_DELAY_MS = 800

const isDebug = () => new URLSearchParams(window.location.search).has('debug')

export default function PatientApp() {
  const lr = useLipReader()
  const speaker = useSpeaker()
  const { speak } = speaker
  const reduced = usePrefersReducedMotion()
  const [debug] = useState(isDebug)

  // Speak each new message once (lr.message only changes identity when a new one is decided).
  useEffect(() => {
    const msg = lr.message
    if (!msg) return
    const delay = msg.source === 'confident' ? SPEAK_DELAY_MS : 0
    const id = window.setTimeout(() => speak(msg.guess.phrase_id, msg.guess.text), delay)
    return () => window.clearTimeout(id)
  }, [lr.message, speak])

  const listen = () => {
    speaker.stop() // before unlocking: stop() pauses the element and cancels speech
    unlockAudio() // inside the tap, so iOS allows the voice to play later
    lr.listen()
  }

  const status = lr.error
    ? lr.error
    : lr.phase === 'loading'
      ? 'Starting camera…'
      : !lr.modelLoaded
        ? 'No lip model yet (open with ?mock to demo)'
        : !lr.face
          ? 'Point the camera at their face'
          : null

  const showControls = lr.phase === 'ready' || lr.phase === 'listening' || lr.phase === 'loading' || lr.phase === 'error'

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0d1214] text-white">
      <CameraView
        videoRef={lr.videoRef}
        faceRef={lr.faceRef}
        mirrored={lr.facing === 'user'}
        listening={lr.phase === 'listening'}
        mock={lr.mock}
      />

      {debug && <DebugOverlay read={lr.readDebug} voice={speaker.speaking ? `${speaker.status} ▶` : speaker.status} />}

      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/50 to-transparent px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
        <div>
          <p className="font-phrase text-xl">Silent Voice</p>
          {status && (
            <p className="mt-2 inline-flex rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/85 backdrop-blur">{status}</p>
          )}
        </div>
        {!lr.mock && (
          <button
            type="button"
            onClick={lr.flipCamera}
            aria-label="Switch camera"
            className="grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur active:bg-black/60"
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
            {lr.notice ??
              (lr.phase === 'listening'
                ? 'Listening… tap when they’re done'
                : 'Tap, then ask them to mouth their answer')}
          </p>
          <button
            type="button"
            onClick={lr.phase === 'listening' ? lr.stopListening : listen}
            disabled={lr.phase === 'loading' || lr.phase === 'error'}
            aria-label={lr.phase === 'listening' ? 'Stop listening' : 'Listen'}
            className="relative grid size-20 place-items-center rounded-full bg-white/95 disabled:opacity-40"
          >
            {lr.phase === 'listening' && (
              <span className="absolute inset-0 rounded-full ring-4 ring-sky motion-safe:animate-ping" />
            )}
            {lr.phase === 'listening' ? (
              <span className="size-7 rounded-md bg-sage" />
            ) : (
              <span className="size-14 rounded-full bg-sage" />
            )}
          </button>
        </footer>
      )}

      {lr.phase === 'confirming' && lr.guesses.length > 0 && (
        <ConfirmSheet
          guesses={lr.guesses}
          selected={lr.selected}
          blinkProgress={lr.blinkProgress}
          threshold={lr.threshold}
          onChoose={lr.choose}
          onRetry={listen}
          mock={lr.mock}
          onSimulateBlink={lr.simulateBlink}
        />
      )}

      {lr.phase === 'done' && lr.message && (
        <MessageSheet
          message={lr.message}
          others={lr.guesses.filter((g) => g.phrase_id !== lr.message!.guess.phrase_id)}
          threshold={lr.threshold}
          speaking={speaker.speaking}
          fallbackVoice={speaker.fallback}
          reduced={reduced}
          onReplay={() => speaker.speak(lr.message!.guess.phrase_id, lr.message!.guess.text)}
          onChoose={(id) => lr.choose(lr.guesses.findIndex((g) => g.phrase_id === id))}
          onNext={listen}
        />
      )}
    </main>
  )
}
