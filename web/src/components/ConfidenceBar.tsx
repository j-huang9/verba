// How sure the lip reader is. Fills on mount; sage when it will speak, honey when unsure.
import { useEffect, useState } from 'react'

export function ConfidenceBar({ value, threshold }: { value: number; threshold: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  const sure = value >= threshold
  const pct = Math.round(value * 100)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{sure ? 'Confident' : 'Not entirely sure'}</span>
        <span className={`tabular-nums font-semibold ${sure ? 'text-sage' : 'text-honey'}`}>{pct}% sure</span>
      </div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Translation confidence"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-calm motion-reduce:transition-none ${
            sure ? 'bg-sage' : 'bg-honey'
          }`}
          style={{ width: `${shown * 100}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${threshold * 100}%` }} />
      </div>
    </div>
  )
}
