// The interface between the on-device engine (web/src/engine, owner: Computer A) and the
// app UI (web/src/pages + components, owner: Computer B). Change it only together.
import type { RefObject } from 'react'

export interface Guess {
  phrase_id: string
  text: string
  /** calibrated probability 0..1 */
  prob: number
}

/**
 * loading    camera / face model / lip model starting
 * ready      camera live, waiting for the family member to tap "Listen"
 * listening  capturing the patient's mouthing; auto-stops when the mouth goes still
 * confirming low confidence: guesses shown, patient holds eyes closed to confirm
 *            guesses[selected], double blink moves to the next guess
 * done       message decided (confident, blink-confirmed or tapped). UI speaks it.
 * error      camera or model failed (see `error`)
 */
export type Phase = 'loading' | 'ready' | 'listening' | 'confirming' | 'done' | 'error'

export interface Message {
  guess: Guess
  /** how it was decided */
  source: 'confident' | 'blink' | 'tap'
  /** top-1 confidence of the reading, shown on the confidence bar */
  confidence: number
}

export interface TrackedFace {
  /** lip points, (x, y) pairs in 0..1 video coords (not mirrored), outer loop then inner loop */
  lips: Float64Array
  /** eyes-closed score 0..1 */
  blink: number
}

export interface LipReader {
  phase: Phase
  error: string | null
  /** short notice for the UI, e.g. "Didn't catch that" */
  notice: string | null
  face: boolean
  modelLoaded: boolean
  /** confidence at or above which the app speaks without confirmation */
  threshold: number
  /** attach to a <video playsInline muted> element */
  videoRef: RefObject<HTMLVideoElement | null>
  /** latest tracked face; read in a rAF loop (does not re-render) */
  faceRef: RefObject<TrackedFace | null>
  facing: 'user' | 'environment'
  /** top-3 guesses after listening (confirming and done phases) */
  guesses: Guess[]
  selected: number
  /** eyes-closed hold progress toward confirming guesses[selected], 0..1 */
  blinkProgress: number
  message: Message | null
  listen: () => void
  stopListening: () => void
  /** caregiver tap on a guess */
  choose: (index: number) => void
  next: () => void
  reset: () => void
  flipCamera: () => void
}
