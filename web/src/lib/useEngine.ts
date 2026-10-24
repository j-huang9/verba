// Connects to the engine WebSocket (engine/server.py, port 8765). While disconnected it keeps
// retrying and plays the mock engine, so the UI always has data. Add ?mock to force the mock.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ENGINE_URL, type Candidate, type ConfirmedEvent, type EngineCommand, type EngineEvent, type Mode } from './events'
import { startMockEngine } from './mockEngine'

export interface LipsFrame {
  points: [number, number][]
  aspect: number
}

export interface EngineState {
  connected: boolean
  source: 'engine' | 'mock'
  mode: Mode
  face: boolean
  modelLoaded: boolean
  candidates: Candidate[]
  selected: number
  blinkProgress: number
  lastConfirmed: ConfirmedEvent | null
}

const initial: EngineState = {
  connected: false,
  source: 'mock',
  mode: 'idle',
  face: false,
  modelLoaded: false,
  candidates: [],
  selected: 0,
  blinkProgress: 0,
  lastConfirmed: null,
}

export function useEngine(opts: { onConfirmed?: (e: ConfirmedEvent) => void } = {}) {
  const [state, setState] = useState<EngineState>(initial)
  /** Latest lip points. Read this in a requestAnimationFrame loop; it does not trigger renders. */
  const lipsRef = useRef<LipsFrame | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const onConfirmedRef = useRef(opts.onConfirmed)
  useEffect(() => {
    onConfirmedRef.current = opts.onConfirmed
  })

  const handle = useCallback((e: EngineEvent, source: 'engine' | 'mock') => {
    switch (e.type) {
      case 'lips':
        lipsRef.current = { points: e.points, aspect: e.aspect ?? 16 / 9 }
        return
      case 'status':
        setState((s) => ({ ...s, source, mode: e.mode, face: e.face, modelLoaded: e.model_loaded }))
        return
      case 'candidates':
        setState((s) => ({ ...s, candidates: e.top3, selected: e.selected }))
        return
      case 'blink_progress':
        setState((s) => ({ ...s, blinkProgress: e.value, selected: e.selected }))
        return
      case 'confirmed':
        setState((s) => ({ ...s, lastConfirmed: e }))
        onConfirmedRef.current?.(e)
        return
    }
  }, [])

  useEffect(() => {
    const forceMock = new URLSearchParams(window.location.search).has('mock')
    let stopMock: (() => void) | null = null
    let retry: number | undefined
    let disposed = false

    const playMock = () => {
      if (!stopMock) stopMock = startMockEngine((e) => handle(e, 'mock'))
    }
    const stopMockEngine = () => {
      stopMock?.()
      stopMock = null
    }

    const connect = () => {
      if (disposed) return
      const ws = new WebSocket(ENGINE_URL)
      wsRef.current = ws
      ws.onopen = () => {
        stopMockEngine()
        setState((s) => ({ ...s, connected: true, source: 'engine' }))
      }
      ws.onmessage = (m) => handle(JSON.parse(m.data) as EngineEvent, 'engine')
      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false, source: 'mock' }))
        playMock()
        retry = window.setTimeout(connect, 1500)
      }
    }

    if (forceMock) playMock()
    else connect()
    return () => {
      disposed = true
      window.clearTimeout(retry)
      stopMockEngine()
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null
        ws.close()
      }
    }
  }, [handle])

  const send = useCallback((cmd: EngineCommand) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd))
  }, [])

  return { ...state, lipsRef, send }
}
