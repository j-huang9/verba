// Circular confirm ring (motion moment #2), filled by blink_progress. Wraps the card number.
import type { ReactNode } from 'react'

export function ConfirmRing({ progress, size = 76, children }: { progress: number; size?: number; children: ReactNode }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          className="stroke-sage transition-[stroke-dashoffset] duration-75 ease-linear"
          style={{ opacity: progress > 0 ? 1 : 0 }}
        />
      </svg>
      <span className="font-sans text-2xl font-semibold text-muted">{children}</span>
    </div>
  )
}
