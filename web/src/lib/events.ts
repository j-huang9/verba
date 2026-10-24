// Event contract between the engine (Computer A) and the web app (Computer B).
// Mirrors CLAUDE.md "Event contract". If you change one, change the other in the same commit.

export type Mode = 'idle' | 'capturing' | 'choosing'

/** ~20 fps. 40 points in 0..1 camera-frame coords, NOT mirrored.
 *  points[0..19] = outer lip loop, points[20..39] = inner lip loop. Draw with x -> 1 - x. */
export interface LipsEvent {
  type: 'lips'
  t: number
  points: [number, number][]
  mouth_open: number
  /** frame width / height. Multiply x by this before drawing. */
  aspect: number
}

export interface Candidate {
  phrase_id: string
  text: string
  prob: number
}

/** Sent when the patient finishes mouthing, when the highlight moves, and (empty) when cleared. */
export interface CandidatesEvent {
  type: 'candidates'
  t: number
  top3: Candidate[]
  selected: number
}

/** Eyes-closed hold progress toward confirming top3[selected]. 0 when released. */
export interface BlinkProgressEvent {
  type: 'blink_progress'
  t: number
  value: number
  selected: number
}

export interface ConfirmedEvent {
  type: 'confirmed'
  t: number
  phrase_id: string
  text: string
  urgent: boolean
  source: 'blink' | 'override' | 'gaze'
  confidence: number | null
}

/** Every 1 s and on every mode change. fps is null on mode-change events. */
export interface StatusEvent {
  type: 'status'
  t: number
  mode: Mode
  face: boolean
  fps: number | null
  model_loaded: boolean
}

export type EngineEvent = LipsEvent | CandidatesEvent | BlinkProgressEvent | ConfirmedEvent | StatusEvent

/** Web app -> engine. */
export type EngineCommand =
  | { type: 'override'; action: 'select'; phrase_id: string }
  | { type: 'override'; action: 'select'; index: number }
  | { type: 'override'; action: 'next' | 'capture_start' | 'capture_stop' | 'reset' }

export const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? 'ws://localhost:8765'
