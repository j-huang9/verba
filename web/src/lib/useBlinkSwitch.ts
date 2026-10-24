// Eyes as a switch, for the phrase board: hold them closed = onHold, two short blinks = onDouble.
// The same timing as the lip reader's confirm sheet (BLINK_* from useLipReader).
// In ?mock the face feed's blink comes from lr.simulateBlink, so "Hold = simulate blink" works here too.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { BLINK_CLOSED, BLINK_HOLD_MS, DOUBLE_BLINK_MS, SHORT_BLINK_MS } from '../engine/useLipReader'
import type { TrackedFace } from '../engine/types'

export function useBlinkSwitch(
  faceRef: RefObject<TrackedFace | null>,
  active: boolean,
  onHold: () => void,
  onDouble: () => void,
): { closed: boolean; progress: number } {
  const [state, setState] = useState({ closed: false, progress: 0 })
  const cb = useRef({ onHold, onDouble })
  useEffect(() => {
    cb.current = { onHold, onDouble }
  })

  useEffect(() => {
    if (!active) return
    let raf = 0
    let closedSince: number | null = null
    let latched = false // fired onHold for this closure; wait for the eyes to open
    let lastShort = 0
    let shown = { closed: false, progress: 0 }
    const show = (next: { closed: boolean; progress: number }) => {
      if (next.closed === shown.closed && Math.abs(next.progress - shown.progress) < 0.03) return
      shown = next
      setState(next)
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const closed = (faceRef.current?.blink ?? 0) > BLINK_CLOSED
      if (closed) {
        closedSince ??= now
        if (latched) return
        const progress = Math.min((now - closedSince) / BLINK_HOLD_MS, 1)
        if (progress >= 1) {
          latched = true
          show({ closed: true, progress: 0 })
          cb.current.onHold()
        } else show({ closed: true, progress })
        return
      }
      if (closedSince !== null) {
        const dur = now - closedSince
        closedSince = null
        if (!latched && dur < SHORT_BLINK_MS) {
          if (now - lastShort < DOUBLE_BLINK_MS) {
            lastShort = 0
            cb.current.onDouble()
          } else lastShort = now
        }
        latched = false
      }
      show({ closed: false, progress: 0 })
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setState({ closed: false, progress: 0 })
    }
  }, [faceRef, active])

  return state
}
