// Voice waveform under the confirmed phrase (part of motion moment #3).
// Without an analyser it plays a synthetic speech-like envelope. Block 2: pass the
// AnalyserNode of the Cartesia <audio> element to make it follow the real voice.
import { useEffect, useLayoutEffect, useRef } from 'react'

const BARS = 40

export function Waveform({
  active,
  analyser,
  reduced = false,
  className = '',
}: {
  active: boolean
  analyser?: AnalyserNode | null
  reduced?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ active, analyser, reduced })
  useLayoutEffect(() => {
    props.current = { active, analyser, reduced }
  })

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let raf = 0
    let amp = 0
    const bins = new Uint8Array(128)
    const start = performance.now()

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = window.devicePixelRatio || 1
      if (c.width !== c.clientWidth * dpr) {
        c.width = c.clientWidth * dpr
        c.height = c.clientHeight * dpr
      }
      const { active, analyser, reduced } = props.current
      amp += ((active ? 1 : 0) - amp) * 0.08
      const t = reduced ? 0 : (performance.now() - start) / 1000
      if (analyser) analyser.getByteFrequencyData(bins)

      const w = c.width
      const h = c.height
      const gap = w / BARS
      const bw = gap * 0.45
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = getComputedStyle(c).color
      for (let i = 0; i < BARS; i++) {
        const centre = Math.sin((Math.PI * (i + 0.5)) / BARS)
        let v: number
        if (analyser) v = bins[Math.floor((i / BARS) * 64)] / 255
        else v = Math.abs(Math.sin(t * 7 + i * 0.55)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.3 + i * 0.17)))
        const bh = Math.max(bw, h * (0.08 + 0.92 * v * centre * amp))
        const x = i * gap + (gap - bw) / 2
        ctx.beginPath()
        ctx.roundRect(x, (h - bh) / 2, bw, bh, bw / 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={`text-brand ${className}`} />
}
