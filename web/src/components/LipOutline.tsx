// Live lip outline (motion moment #1). Reads lipsRef in its own rAF loop, so 20 fps lip
// events never re-render React. Points are smoothed, mirrored and zoomed onto the mouth.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { LipsFrame } from '../lib/useEngine'

type Pt = [number, number]

function loop(ctx: CanvasRenderingContext2D, p: Pt[]) {
  const n = p.length
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(p[n - 1], p[0])
  ctx.beginPath()
  ctx.moveTo(start[0], start[1])
  for (let i = 0; i < n; i++) {
    const m = mid(p[i], p[(i + 1) % n])
    ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1])
  }
  ctx.closePath()
}

export function LipOutline({
  lipsRef,
  active,
  face,
  className = '',
}: {
  lipsRef: RefObject<LipsFrame | null>
  /** patient is mouthing: thicker stroke + soft glow */
  active: boolean
  face: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ active, face })
  useLayoutEffect(() => {
    props.current = { active, face }
  })

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let raf = 0
    let smooth: Pt[] | null = null
    let scale = 0
    let glow = 0
    let alpha = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    resize()

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const frame = lipsRef.current
      if (!frame || frame.points.length < 40) return
      const pts = frame.points.map(([x, y]) => [x * frame.aspect, y] as Pt)
      if (!smooth) smooth = pts
      else smooth = smooth.map((s, i) => [s[0] + (pts[i][0] - s[0]) * 0.35, s[1] + (pts[i][1] - s[1]) * 0.35])

      const { active, face } = props.current
      glow += ((active ? 1 : 0) - glow) * 0.1
      alpha += ((face ? 1 : 0.3) - alpha) * 0.1

      const w = c.width
      const h = c.height
      const outer = smooth.slice(0, 20)
      const mx = outer.reduce((a, p) => a + p[0], 0) / 20
      const my = outer.reduce((a, p) => a + p[1], 0) / 20
      const mouthW = Math.hypot(smooth[10][0] - smooth[0][0], smooth[10][1] - smooth[0][1])
      // Slow-moving zoom (in mouth-widths) so the mouth fills ~60% of the canvas without jitter.
      // Kept independent of canvas size so resizing between views doesn't overshoot.
      const fit = Math.min(w * 0.6, h * 1.1)
      const target = 1 / Math.max(mouthW, 1e-4)
      scale = scale ? scale + (target - scale) * 0.03 : target
      const project = (p: Pt): Pt => [w / 2 - (p[0] - mx) * scale * fit, h / 2 + (p[1] - my) * scale * fit]
      const o = outer.map(project)
      const inner = smooth.slice(20).map(project)

      const color = getComputedStyle(c).color
      const dpr = window.devicePixelRatio || 1
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineJoin = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur = glow * 18 * dpr

      loop(ctx, o)
      ctx.globalAlpha = alpha * 0.12
      ctx.fill()
      ctx.globalAlpha = alpha
      ctx.lineWidth = (3 + glow * 2) * dpr
      ctx.stroke()

      loop(ctx, inner)
      ctx.lineWidth = (2 + glow) * dpr
      ctx.stroke()
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [lipsRef])

  return <canvas ref={canvasRef} aria-hidden className={`text-sky ${className}`} />
}
