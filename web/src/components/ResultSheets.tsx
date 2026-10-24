// Bottom sheets shown after the patient mouths something.
//   ConfirmSheet: below the confidence threshold. Ask the patient; a long blink confirms.
//   MessageSheet: the message, spoken in the patient's voice (motion moment #3).
import { useState } from 'react'
import type { Guess, Message } from '../engine/types'
import { ConfidenceBar } from './ConfidenceBar'
import { ConfirmRing } from './ConfirmRing'
import { Waveform } from './Waveform'

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-xl animate-sheet-in rounded-t-[2rem] bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] motion-reduce:animate-none">
      {children}
    </section>
  )
}

export function ConfirmSheet({
  guesses,
  selected,
  blinkProgress,
  threshold,
  onChoose,
  onRetry,
  onBoard,
  mock,
  onSimulateBlink,
}: {
  guesses: Guess[]
  selected: number
  blinkProgress: number
  threshold: number
  onChoose: (i: number) => void
  onRetry: () => void
  /** "None of these → phrase board" */
  onBoard: () => void
  mock: boolean
  onSimulateBlink: (closed: boolean) => void
}) {
  const guess = guesses[selected]
  return (
    <Sheet>
      <ConfidenceBar value={guesses[0].prob} threshold={threshold} />
      <h2 className="mt-5 text-lg font-semibold text-ink">Check with them before it speaks</h2>
      <p className="mt-1 text-muted">
        Ask, “Did you mean this?” They hold their eyes closed for yes, or blink twice for the next guess.
      </p>

      <button
        type="button"
        onClick={() => onChoose(selected)}
        className="mt-5 flex w-full items-center gap-5 rounded-card bg-honey-soft p-5 text-left"
      >
        <ConfirmRing progress={blinkProgress} size={64}>
          {selected + 1}
        </ConfirmRing>
        <span className="font-phrase text-3xl leading-tight text-balance text-ink">{guess.text}</span>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        {guesses.map((g, i) =>
          i === selected ? null : (
            <button
              key={g.phrase_id}
              type="button"
              onClick={() => onChoose(i)}
              className="rounded-full border border-line px-4 py-2 text-ink active:bg-canvas"
            >
              {g.text} <span className="text-sm text-muted tabular-nums">{Math.round(g.prob * 100)}%</span>
            </button>
          ),
        )}
        <button type="button" onClick={onBoard} className="rounded-full border border-line px-4 py-2 text-ink active:bg-canvas">
          None of these → phrase board
        </button>
      </div>

      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onRetry} className="flex-1 rounded-full bg-canvas py-3.5 font-medium text-ink">
          Try again
        </button>
        {mock && (
          <button
            type="button"
            onPointerDown={() => onSimulateBlink(true)}
            onPointerUp={() => onSimulateBlink(false)}
            onPointerLeave={() => onSimulateBlink(false)}
            className="flex-1 rounded-full border border-dashed border-line py-3.5 text-sm text-muted select-none"
          >
            Hold = simulate blink
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function MessageSheet({
  message,
  others,
  threshold,
  speaking,
  fallbackVoice,
  reduced,
  onReplay,
  onChoose,
  onBoard,
  onUndo,
  onNext,
}: {
  message: Message
  others: Guess[]
  threshold: number
  speaking: boolean
  fallbackVoice: boolean
  reduced: boolean
  onReplay: () => void
  onChoose: (phraseId: string) => void
  /** "None of these → phrase board" under "Not right?" */
  onBoard: () => void
  /** stop the voice, mark the log entry undone, back to ready */
  onUndo: () => void
  onNext: () => void
}) {
  const [showOthers, setShowOthers] = useState(false)
  return (
    <Sheet>
      {message.source === 'confident' ? (
        <ConfidenceBar value={message.confidence} threshold={threshold} />
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium text-sage">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {message.source === 'blink' ? 'Confirmed by their blink' : 'Confirmed'}
        </p>
      )}

      <div key={message.guess.phrase_id} className="animate-phrase-in motion-reduce:animate-none">
        <p className="mt-6 font-phrase text-5xl leading-[1.05] text-balance text-ink">{message.guess.text}</p>
        <Waveform active={speaking} reduced={reduced} className="mt-5 h-12 w-full" />
        {fallbackVoice && <p className="mt-1 text-xs text-muted">Cloned voice not generated yet. Using the device voice.</p>}
      </div>

      {showOthers && (
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((g) => (
            <button
              key={g.phrase_id}
              type="button"
              onClick={() => {
                setShowOthers(false)
                onChoose(g.phrase_id)
              }}
              className="rounded-full border border-line px-4 py-2 text-ink active:bg-canvas"
            >
              {g.text}
            </button>
          ))}
          <button type="button" onClick={onBoard} className="rounded-full border border-line px-4 py-2 text-ink active:bg-canvas">
            {others.length ? 'None of these → phrase board' : 'Open the phrase board'}
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <button type="button" onClick={onReplay} className="rounded-full bg-canvas py-3 font-medium text-ink">
          Replay
        </button>
        <button
          type="button"
          onClick={() => setShowOthers((v) => !v)}
          aria-expanded={showOthers}
          className="rounded-full bg-canvas py-3 font-medium text-ink"
        >
          Not right?
        </button>
        <button type="button" onClick={onUndo} className="rounded-full bg-canvas py-3 font-medium text-ink">
          Undo
        </button>
        <button type="button" onClick={onNext} className="col-span-3 rounded-full bg-sage py-3.5 font-medium text-surface">
          Listen again
        </button>
      </div>
    </Sheet>
  )
}
