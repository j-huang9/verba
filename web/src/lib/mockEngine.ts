// Fake engine so the screens can be built without Computer A. Emits the same events as
// silentvoice.py on a loop: idle -> mouthing -> candidates -> blink hold -> confirmed.
import type { EngineEvent } from './events'
import { PHRASES } from './phrases'

const SCRIPT = ['where_mom', 'in_pain', 'thirsty', 'cant_breathe', 'thank_you']

function lipPoints(open: number, smile: number): [number, number][] {
  const cx = 0.5
  const cy = 0.64
  const loop = (a: number, top: number, bottom: number) =>
    Array.from({ length: 20 }, (_, i) => {
      // i=0 left corner, 5 bottom centre, 10 right corner, 15 top centre (matches MediaPipe order)
      const th = Math.PI - (i * Math.PI) / 10
      const s = Math.sin(th)
      const y = s > 0 ? cy + bottom * s : cy + top * s
      const lift = smile * Math.cos(th) ** 2 * 0.01
      return [cx + a * Math.cos(th), y - lift] as [number, number]
    })
  return [...loop(0.075 - open * 0.01, 0.028 + open * 0.01, 0.03 + open * 0.035), ...loop(0.05, 0.004 + open * 0.012, 0.004 + open * 0.03)]
}

export function startMockEngine(emit: (e: EngineEvent) => void): () => void {
  let round = 0
  let phaseStart = performance.now()
  let phase: 'idle' | 'mouthing' | 'choosing' | 'holding' | 'done' = 'idle'
  const now = () => Date.now()

  const status = (mode: 'idle' | 'capturing' | 'choosing') =>
    emit({ type: 'status', t: now(), mode, face: true, fps: 30, model_loaded: true })

  const tick = () => {
    const el = (performance.now() - phaseStart) / 1000
    const target = SCRIPT[round % SCRIPT.length]
    const mouthing = phase === 'mouthing'
    const open = mouthing ? Math.max(0, Math.sin(el * 9)) * 0.9 : 0.05
    emit({ type: 'lips', t: now(), points: lipPoints(open, mouthing ? 0 : 0.3), mouth_open: open * 0.6, aspect: 16 / 9 })

    const next = (p: typeof phase) => {
      phase = p
      phaseStart = performance.now()
    }
    if (phase === 'idle' && el > 2.5) {
      next('mouthing')
      status('capturing')
    } else if (phase === 'mouthing' && el > 1.6) {
      const others = PHRASES.filter((p) => p.id !== target).slice(round % 5, (round % 5) + 2)
      const top = [PHRASES.find((p) => p.id === target)!, ...others]
      const probs = [0.71, 0.17, 0.06]
      emit({
        type: 'candidates',
        t: now(),
        selected: 0,
        top3: top.map((p, i) => ({ phrase_id: p.id, text: p.text, prob: probs[i] })),
      })
      status('choosing')
      next('choosing')
    } else if (phase === 'choosing' && el > 1.8) {
      next('holding')
    } else if (phase === 'holding') {
      const value = Math.min(el / 1.0, 1)
      emit({ type: 'blink_progress', t: now(), value, selected: 0 })
      if (value >= 1) {
        const p = PHRASES.find((x) => x.id === target)!
        emit({ type: 'blink_progress', t: now(), value: 0, selected: 0 })
        emit({ type: 'confirmed', t: now(), phrase_id: p.id, text: p.text, urgent: p.urgent, source: 'blink', confidence: 0.71 })
        emit({ type: 'candidates', t: now(), top3: [], selected: 0 })
        status('idle')
        next('done')
      }
    } else if (phase === 'done' && el > 4) {
      round++
      next('idle')
    }
  }

  const id = window.setInterval(tick, 50)
  status('idle')
  return () => window.clearInterval(id)
}
