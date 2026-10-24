// ?debug: live tuning numbers for real-phone testing (segmentation, blink, voice).
// Polls readDebug() 10x a second so the camera loop never re-renders React.
import { useEffect, useState } from 'react'
import type { DebugStats } from '../engine/useLipReader'

/** value vs. threshold as a bar; the tick marks the threshold */
function Meter({ label, value, limit, max, text }: { label: string; value: number; limit: number; max: number; text: string }) {
  const pct = (v: number) => `${Math.min(v / max, 1) * 100}%`
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span className="text-white/60">{label}</span>
        <span>{text}</span>
      </div>
      <div className="relative mt-0.5 h-1.5 rounded-full bg-white/15">
        <div className={`h-full rounded-full ${value > limit ? 'bg-sage' : 'bg-sky'}`} style={{ width: pct(value) }} />
        <div className="absolute -top-0.5 h-2.5 w-0.5 bg-honey" style={{ left: pct(limit) }} />
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/60">{label}</span>
      <span>{children}</span>
    </div>
  )
}

export function DebugOverlay({ read, voice }: { read: () => DebugStats; voice: string }) {
  const [d, setD] = useState(read)
  useEffect(() => {
    const id = window.setInterval(() => setD(read()), 100)
    return () => window.clearInterval(id)
  }, [read])

  return (
    <aside className="pointer-events-none absolute top-[calc(max(1rem,env(safe-area-inset-top))+5.5rem)] left-3 z-20 w-56 space-y-1.5 rounded-xl bg-black/65 p-3 font-mono text-[11px] leading-tight text-white tabular-nums backdrop-blur">
      <Row label="phase">{d.phase}</Row>
      <Row label="fps">{d.fps.toFixed(0)}</Row>
      <Meter
        label="motion"
        value={d.energy}
        limit={d.motionOn}
        max={Math.max(d.motionOn * 3, 0.02)}
        text={`${(d.energy * 1000).toFixed(1)} / ${(d.motionOn * 1000).toFixed(1)}`}
      />
      <Row label="baseline">{(d.baseline * 1000).toFixed(2)}</Row>
      <Meter label="blink" value={d.blink} limit={d.blinkClosed} max={1} text={`${d.blink.toFixed(2)} / ${d.blinkClosed}`} />
      <Row label="segment">
        {d.segFrames} fr · {(d.segMs / 1000).toFixed(1)} s{d.stopReason ? ` · ${d.stopReason}` : ''}
      </Row>
      {d.quietMs !== null && (
        <Row label="quiet">
          {(d.quietMs / 1000).toFixed(1)} / {(d.quietLimit / 1000).toFixed(1)} s
        </Row>
      )}
      <Row label="voice">{voice}</Row>
    </aside>
  )
}
