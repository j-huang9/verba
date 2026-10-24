// PLACEHOLDER: proves the event pipeline works. Replace it with the real bedside screen
// (Computer B, Block 1 prompt in CLAUDE.md). Keep useEngine() as the only data source.
import { useEffect, useRef } from 'react'
import { useEngine } from '../lib/useEngine'

export default function BedsideScreen() {
  const engine = useEngine()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const c = canvasRef.current
      const pts = engine.lipsRef.current
      const ctx = c?.getContext('2d')
      if (c && ctx && pts) {
        ctx.clearRect(0, 0, c.width, c.height)
        // zoom on the mouth: centre on the points' mean, mirror x for a selfie view
        const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
        const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
        const k = c.width * 3
        ctx.strokeStyle = getComputedStyle(c).color
        ctx.lineWidth = 3
        for (const loop of [pts.slice(0, 20), pts.slice(20)]) {
          ctx.beginPath()
          loop.forEach(([x, y], i) => {
            const px = c.width / 2 - (x - mx) * k
            const py = c.height / 2 + (y - my) * k
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          ctx.closePath()
          ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [engine.lipsRef])

  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 p-8">
      <p className="text-sm text-muted">
        {engine.connected ? 'engine connected' : 'reconnecting… (showing mock data)'} · mode {engine.mode}
      </p>
      <canvas ref={canvasRef} width={480} height={240} className="self-center text-sky" />
      <ol className="grid gap-3">
        {engine.candidates.map((c, i) => (
          <li
            key={c.phrase_id}
            className={`rounded-card p-6 text-candidate font-phrase ${i === engine.selected ? 'bg-sage-soft' : 'bg-surface'}`}
          >
            {c.text} <span className="text-base text-muted">{Math.round(c.prob * 100)}%</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">blink hold {Math.round(engine.blinkProgress * 100)}%</p>
      {engine.lastConfirmed && <p className="font-phrase text-phrase">{engine.lastConfirmed.text}</p>}
    </main>
  )
}
