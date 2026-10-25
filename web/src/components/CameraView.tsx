// Full-bleed camera preview with the live lip outline drawn over the mouth (motion moment #1).
import { useEffect, useRef, type RefObject } from 'react'
import type { TrackedFace } from '../engine/types'

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

export function CameraView({
  videoRef,
  faceRef,
  mirrored,
  listening,
  mock,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  faceRef: RefObject<TrackedFace | null>
  mirrored: boolean
  listening: boolean
  mock: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const listeningRef = useRef(listening)
  useEffect(() => {
    listeningRef.current = listening
  })

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let raf = 0
    let smooth: Pt[] | null = null
    let glow = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = window.devicePixelRatio || 1
      const cw = c.clientWidth * dpr
      const ch = c.clientHeight * dpr
      if (c.width !== cw || c.height !== ch) {
        c.width = cw
        c.height = ch
      }
      ctx.clearRect(0, 0, cw, ch)
      const face = faceRef.current
      if (!face) {
        smooth = null
        return
      }
      // map 0..1 video coords to the object-fit: cover canvas
      const video = videoRef.current
      const vw = video?.videoWidth || 720
      const vh = video?.videoHeight || 960
      const s = Math.max(cw / vw, ch / vh)
      const ox = (cw - vw * s) / 2
      const oy = (ch - vh * s) / 2
      const pts: Pt[] = []
      for (let i = 0; i < face.lips.length; i += 2) {
        const x = ox + face.lips[i] * vw * s
        pts.push([mirrored ? cw - x : x, oy + face.lips[i + 1] * vh * s])
      }
      smooth = smooth ? smooth.map((p, i) => [p[0] + (pts[i][0] - p[0]) * 0.5, p[1] + (pts[i][1] - p[1]) * 0.5]) : pts
      glow += ((listeningRef.current ? 1 : 0) - glow) * 0.12

      const color = getComputedStyle(c).color
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineJoin = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur = (4 + glow * 14) * dpr
      loop(ctx, smooth.slice(0, 20))
      ctx.globalAlpha = 0.18 + glow * 0.12
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.lineWidth = (2.5 + glow * 1.5) * dpr
      ctx.stroke()
      loop(ctx, smooth.slice(20))
      ctx.lineWidth = (1.5 + glow) * dpr
      ctx.stroke()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [faceRef, videoRef, mirrored])

  return (
    <div className="absolute inset-0 overflow-hidden bg-night">
      {mock ? (
        <div className="absolute inset-0 bg-night bg-[radial-gradient(ellipse_at_50%_45%,rgb(127_227_203/0.14)_0%,transparent_70%)]" />
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 size-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        />
      )}
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full text-sky" />
    </div>
  )
}
