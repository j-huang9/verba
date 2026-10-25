// The patient's details form, shared by "Add a patient" and the patient's edit page.
import type { Patient } from '../lib/store'

export type Details = Pick<Patient, 'name' | 'preferredName' | 'room' | 'relationship' | 'notes'>

const RELATIONSHIPS = ['Daughter', 'Son', 'Partner', 'Parent', 'Sibling', 'Friend', 'Other']

export const input =
  'mt-1.5 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-lg text-ink placeholder:text-muted focus:border-sage focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export function PatientFields({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const set = (k: keyof Details) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-5">
      <Field label="Their name">
        <input className={input} value={value.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="What they like to be called">
        <input className={input} value={value.preferredName} onChange={(e) => set('preferredName')(e.target.value)} placeholder="e.g. Grandpa Joe" autoComplete="off" />
      </Field>
      <Field label="Hospital and room">
        <input className={input} value={value.room} onChange={(e) => set('room')(e.target.value)} placeholder="e.g. St. Mary’s ICU, bed 4" autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="font-medium">You are their…</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('relationship')(r === value.relationship ? '' : r)}
              aria-pressed={r === value.relationship}
              className={`min-h-11 rounded-full border px-4 py-2.5 ${r === value.relationship ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-ink'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Notes for the care team">
        <textarea className={`${input} min-h-24`} value={value.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Allergies, hearing, what calms them" />
      </Field>
    </div>
  )
}
