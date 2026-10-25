// "Who are you with?" dropdown for Talk and Conversation. A native <select>, so the phone
// shows its own large, accessible picker. The last option adds a patient.
import { displayName } from '../lib/format'
import { navigate } from '../lib/router'
import { usePatients } from '../lib/store'

const ALL = '__all'
const ADD = '__add'

export function PatientPicker({
  value,
  onChange,
  allOption = false,
  tone = 'light',
}: {
  /** patient id, or null for "All patients" */
  value: string | null
  onChange: (id: string | null) => void
  allOption?: boolean
  /** dark = over the camera */
  tone?: 'light' | 'dark'
}) {
  const patients = usePatients()
  const tones = {
    light: 'bg-surface text-ink border border-line shadow-sm',
    dark: 'bg-black/45 text-white backdrop-blur',
  }
  return (
    <label className={`relative inline-flex min-h-11 max-w-full items-center rounded-full ${tones[tone]}`}>
      <span className="sr-only">Patient</span>
      <select
        value={value ?? ALL}
        onChange={(e) => {
          const v = e.target.value
          if (v === ADD) navigate('/new')
          else onChange(v === ALL ? null : v)
        }}
        className="min-h-11 max-w-full cursor-pointer appearance-none truncate rounded-full bg-transparent py-2 pr-10 pl-4 text-lg font-semibold *:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      >
        {allOption && <option value={ALL}>All patients</option>}
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {displayName(p)}
          </option>
        ))}
        <option value={ADD}>+ Add a patient…</option>
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3.5 size-5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  )
}
