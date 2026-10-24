// The on-device lip reader: camera -> MediaPipe -> features -> classifier -> confidence ->
// speak or ask the patient to confirm with a blink. See types.ts for the phases.
// Add ?mock to the URL to run without a camera or model (scripted results).
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadModel, predict, type LipModel } from './classifier'
import { features, MIN_FRAMES, motion, N_LIPS, normalize, type NormFrame } from './features'
import { startMockFeed, mockResult } from './mock'
import { createTracker, type Tracker, type TrackerFrame } from './tracker'
import type { Guess, LipReader, Message, Phase, TrackedFace } from './types'

// Tuning knobs. Motion is in eye-distance units per frame (see normalize()).
const MOTION_ON_FLOOR = 0.006 // counts as mouthing above max(this, baseline * 2.5)
const QUIET_MS = 900 // auto-stop after the mouth is still this long...
const MIN_LISTEN_MS = 700 // ...but never before this
const MAX_LISTEN_MS = 6000
const BLINK_CLOSED = 0.45 // eyeBlink blendshape average
const BLINK_HOLD_MS = 1000 // eyes closed this long = confirm
const SHORT_BLINK_MS = 500 // two short blinks within DOUBLE_BLINK_MS = next guess
const DOUBLE_BLINK_MS = 800
const DEFAULT_THRESHOLD = 0.6

interface Machine {
  phase: Phase
  guesses: Guess[]
  selected: number
  message: Message | null
  notice: string | null
  segment: NormFrame[]
  prev: NormFrame | null
  energy: number
  baseline: number
  motionSeen: boolean
  listenStart: number
  lastMotion: number
  closedSince: number | null
  latched: boolean
  lastShortBlink: number
  blinkProgress: number
  lastPublish: number
  face: boolean
}

const isMock = () => new URLSearchParams(window.location.search).has('mock')

export function useLipReader(): LipReader & { mock: boolean; simulateBlink: (closed: boolean) => void } {
  const [mock] = useState(isMock)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<LipModel | null>(null)
  const [trackerReady, setTrackerReady] = useState(mock)
  /** which camera (facing) is live; compared against `facing` so flipping shows loading */
  const [cameraLive, setCameraLive] = useState<'user' | 'environment' | null>(null)
  const [snap, setSnap] = useState({
    phase: 'loading' as Phase,
    guesses: [] as Guess[],
    selected: 0,
    message: null as Message | null,
    notice: null as string | null,
    blinkProgress: 0,
    face: false,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const faceRef = useRef<TrackedFace | null>(null)
  const trackerRef = useRef<Tracker | null>(null)
  const modelRef = useRef<LipModel | null>(null)
  const mockBlink = useRef(false)
  const m = useRef<Machine>({
    phase: 'loading', guesses: [], selected: 0, message: null, notice: null, segment: [], prev: null,
    energy: 0, baseline: 0.002, motionSeen: false, listenStart: 0, lastMotion: 0, closedSince: null,
    latched: false, lastShortBlink: 0, blinkProgress: 0, lastPublish: 0, face: false,
  })

  const publish = useCallback(() => {
    const s = m.current
    s.lastPublish = performance.now()
    setSnap({ phase: s.phase, guesses: s.guesses, selected: s.selected, message: s.message,
      notice: s.notice, blinkProgress: s.blinkProgress, face: s.face })
  }, [])

  const threshold = model?.threshold ?? DEFAULT_THRESHOLD

  const decide = useCallback((guess: Guess, source: Message['source']) => {
    const s = m.current
    s.message = { guess, source, confidence: s.guesses[0]?.prob ?? guess.prob }
    s.phase = 'done'
    s.blinkProgress = 0
    publish()
  }, [publish])

  const finish = useCallback(() => {
    const s = m.current
    const seg = s.segment
    s.segment = []
    let ranked: Guess[] | null = null
    if (mock) ranked = mockResult()
    else if (!modelRef.current) s.notice = 'No lip model yet. Train on the Pro Max, or open with ?mock'
    else if (seg.length < MIN_FRAMES || !s.motionSeen) s.notice = 'Didn’t catch that. Try again'
    else ranked = predict(modelRef.current, features(seg))

    if (!ranked) {
      s.phase = 'ready'
      publish()
      return
    }
    s.guesses = ranked.slice(0, 3)
    s.selected = 0
    s.closedSince = null
    s.latched = false
    const t = modelRef.current?.threshold ?? DEFAULT_THRESHOLD
    if (s.guesses[0].prob >= t) decide(s.guesses[0], 'confident')
    else {
      s.phase = 'confirming'
      publish()
    }
  }, [mock, publish, decide])

  const next = useCallback(() => {
    const s = m.current
    if (!s.guesses.length) return
    s.selected = (s.selected + 1) % s.guesses.length
    publish()
  }, [publish])

  const onBlink = useCallback((closed: boolean, now: number) => {
    const s = m.current
    if (closed) {
      if (s.latched) return
      s.closedSince ??= now
      s.blinkProgress = Math.min((now - s.closedSince) / BLINK_HOLD_MS, 1)
      if (s.blinkProgress >= 1) {
        s.latched = true
        decide(s.guesses[s.selected], 'blink')
      } else if (now - s.lastPublish > 50) publish()
      return
    }
    s.latched = false
    if (s.closedSince === null) return
    const dur = now - s.closedSince
    s.closedSince = null
    s.blinkProgress = 0
    publish()
    if (dur < SHORT_BLINK_MS) {
      if (now - s.lastShortBlink < DOUBLE_BLINK_MS) {
        s.lastShortBlink = 0
        next()
      } else s.lastShortBlink = now
    }
  }, [decide, next, publish])

  const onFrame = useCallback((frame: TrackerFrame | null, now: number) => {
    const s = m.current
    const hasFace = frame !== null
    if (hasFace !== s.face) {
      s.face = hasFace
      publish()
    }
    if (!frame) {
      faceRef.current = null
      return
    }
    const blink = mock ? (mockBlink.current ? 1 : 0) : frame.blink
    faceRef.current = { lips: frame.points.subarray(0, N_LIPS * 2), blink }

    const norm = normalize(frame.points, frame.w, frame.h)
    if (s.prev) s.energy = 0.5 * s.energy + 0.5 * motion(norm, s.prev)
    s.prev = norm
    const closed = blink > BLINK_CLOSED

    if (s.phase === 'ready' || s.phase === 'done') {
      if (!closed) s.baseline = 0.95 * s.baseline + 0.05 * Math.min(s.energy, s.baseline * 3)
    } else if (s.phase === 'listening') {
      s.segment.push(norm)
      if (s.energy > Math.max(MOTION_ON_FLOOR, s.baseline * 2.5)) {
        s.motionSeen = true
        s.lastMotion = now
      }
      const elapsed = now - s.listenStart
      if (mock) {
        if (elapsed > 1600) finish()
      } else if ((s.motionSeen && now - s.lastMotion > QUIET_MS && elapsed > MIN_LISTEN_MS) || elapsed > MAX_LISTEN_MS) {
        finish()
      }
    } else if (s.phase === 'confirming') {
      onBlink(closed, now)
    }
  }, [mock, publish, finish, onBlink])

  // Load the lip model + face tracker once.
  useEffect(() => {
    if (mock) return
    let cancelled = false
    loadModel()
      .then((mdl) => {
        if (cancelled) return
        modelRef.current = mdl
        setModel(mdl)
      })
      .catch((e: Error) => setError(e.message))
    createTracker()
      .then((t) => {
        if (cancelled) return t.close()
        trackerRef.current = t
        setTrackerReady(true)
      })
      .catch((e: Error) => setError(`Face tracker failed to load: ${e.message}`))
    return () => {
      cancelled = true
      trackerRef.current?.close()
      trackerRef.current = null
    }
  }, [mock])

  // Camera (restarts when flipping) + frame loop.
  useEffect(() => {
    if (mock) {
      return startMockFeed((frame) => onFrame(frame, performance.now()), () => m.current.phase === 'listening')
    }
    if (!navigator.mediaDevices?.getUserMedia) return // insecure context, see noCamera
    let stream: MediaStream | null = null
    let raf = 0
    let lastTime = -1
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play().catch(() => {})
        setCameraLive(facing)
      })
      .catch((e: Error) => setError(`Camera unavailable: ${e.message}`))

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const video = videoRef.current
      const tracker = trackerRef.current
      if (!video || !tracker || video.readyState < 2 || video.currentTime === lastTime) return
      lastTime = video.currentTime
      onFrame(tracker.process(video), performance.now())
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [mock, facing, onFrame])

  // loading -> ready once everything is up
  const cameraReady = mock || cameraLive === facing
  useEffect(() => {
    if (trackerReady && cameraReady && m.current.phase === 'loading') {
      m.current.phase = 'ready'
      publish()
    }
  }, [trackerReady, cameraReady, publish])

  const listen = useCallback(() => {
    const s = m.current
    if (s.phase === 'loading' || s.phase === 'error') return
    Object.assign(s, { phase: 'listening', segment: [], motionSeen: false, listenStart: performance.now(),
      lastMotion: 0, message: null, notice: null, guesses: [], blinkProgress: 0 })
    publish()
  }, [publish])

  const stopListening = useCallback(() => {
    if (m.current.phase === 'listening') finish()
  }, [finish])

  const choose = useCallback((i: number) => {
    const s = m.current
    if ((s.phase === 'confirming' || s.phase === 'done') && s.guesses[i]) {
      s.selected = i
      decide(s.guesses[i], 'tap')
    }
  }, [decide])

  const reset = useCallback(() => {
    Object.assign(m.current, { phase: 'ready', message: null, notice: null, guesses: [], selected: 0, blinkProgress: 0 })
    publish()
  }, [publish])

  const flipCamera = useCallback(() => setFacing((f) => (f === 'user' ? 'environment' : 'user')), [])
  const simulateBlink = useCallback((closed: boolean) => {
    mockBlink.current = closed
  }, [])

  // Phones only expose the camera on HTTPS (or localhost).
  const noCamera = !mock && !navigator.mediaDevices?.getUserMedia
  const err = error ?? (noCamera ? 'The camera needs HTTPS. Use the deployed link or `npm run dev:phone`.' : null)

  return {
    ...snap,
    phase: err ? 'error' : snap.phase,
    error: err,
    modelLoaded: mock || model !== null,
    threshold,
    videoRef,
    faceRef,
    facing,
    listen,
    stopListening,
    choose,
    next,
    reset,
    flipCamera,
    mock,
    simulateBlink,
  }
}
