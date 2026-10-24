// Bedside screen: read by the patient from ~2 m away. At most 3 things on screen, calm
// colors, huge type, no red. Views: idle -> listening -> choosing -> confirmed.
import { useEffect, useRef, useState } from 'react'
import { CandidateCard } from '../components/CandidateCard'
import { LipOutline } from '../components/LipOutline'
import { Waveform } from '../components/Waveform'
import type { ConfirmedEvent } from '../lib/events'
import { useEngine } from '../lib/useEngine'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

const SHOW_CONFIRMED_MS = 7000
// TODO Block 2: replace with the real duration of the Cartesia audio clip.
const SPEAKING_MS = 2800

export default function BedsideScreen() {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState<ConfirmedEvent | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const timers = useRef<number[]>([])

  const engine = useEngine({
    onConfirmed: (e) => {
      timers.current.forEach(window.clearTimeout)
      setShown(e)
      setSpeaking(true)
      // TODO Block 2: write to Convex + play the phrase in the patient's Cartesia voice here.
      timers.current = [
        window.setTimeout(() => setSpeaking(false), SPEAKING_MS),
        window.setTimeout(() => setShown(null), SHOW_CONFIRMED_MS),
      ]
    },
  })
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const view = engine.candidates.length
    ? 'choosing'
    : engine.mode === 'capturing'
      ? 'listening'
      : shown
        ? 'confirmed'
        : 'idle'

  const hint = {
    idle: engine.face ? 'Mouth what you’d like to say' : 'Move so the camera can see your face',
    listening: 'Listening…',
    choosing: 'Close your eyes to choose · Blink twice for the next one',
    confirmed: '',
  }[view]

  const compactLips = view === 'choosing' || view === 'confirmed'

  return (
    <main className="flex h-full flex-col px-6 py-6 sm:px-16 sm:py-10">
      <header className="flex h-10 items-center">
        {!engine.connected && (
          <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-muted">
            <span className="size-2 rounded-full bg-muted motion-safe:animate-pulse" />
            Reconnecting…
          </span>
        )}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-10">
        <LipOutline
          lipsRef={engine.lipsRef}
          active={view === 'listening'}
          face={engine.face}
          className={`max-w-full transition-[width,height] duration-500 ease-calm ${
            compactLips ? 'h-20 w-48' : 'h-56 w-[30rem] sm:h-64'
          }`}
        />

        {view === 'choosing' && (
          <ol className="grid w-full max-w-4xl gap-4">
            {engine.candidates.map((c, i) => (
              <li key={c.phrase_id}>
                <CandidateCard
                  index={i}
                  text={c.text}
                  selected={i === engine.selected}
                  progress={engine.blinkProgress}
                  onSelect={() => engine.send({ type: 'override', action: 'select', index: i })}
                />
              </li>
            ))}
          </ol>
        )}

        {view === 'confirmed' && shown && (
          <div key={shown.t} className="flex flex-col items-center gap-10 animate-phrase-in motion-reduce:animate-none">
            <p className="max-w-5xl text-center font-phrase text-6xl text-balance sm:text-phrase">{shown.text}</p>
            <Waveform active={speaking} reduced={reduced} className="h-16 w-72 sm:w-96" />
          </div>
        )}
      </section>

      <footer className="flex h-12 items-center justify-center text-center text-xl text-muted sm:text-2xl">{hint}</footer>
    </main>
  )
}
