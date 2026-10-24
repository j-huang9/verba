import { ConfirmRing } from './ConfirmRing'

export function CandidateCard({
  index,
  text,
  selected,
  progress,
  onSelect,
}: {
  index: number
  text: string
  selected: boolean
  progress: number
  /** caregiver tap = override select */
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`flex w-full items-center gap-6 rounded-card px-6 py-5 text-left transition-colors duration-200 sm:gap-8 sm:px-8 sm:py-6 ${
        selected ? 'bg-sage-soft shadow-sm' : 'bg-surface'
      }`}
    >
      <ConfirmRing progress={selected ? progress : 0}>{index + 1}</ConfirmRing>
      <span className={`font-phrase text-4xl text-balance sm:text-candidate ${selected ? 'text-ink' : 'text-muted'}`}>
        {text}
      </span>
    </button>
  )
}
