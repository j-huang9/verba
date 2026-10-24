// Add a patient: 1. details  2. their voice (A's VoiceSetup)  3. teach it their lips now or later.
import { useState } from 'react'
import { btnPrimary, btnSecondary, Screen } from '../components/Screen'
import { VoiceSetup } from '../components/VoiceSetup'
import { navigate } from '../lib/router'
import { addPatient, usePatient } from '../lib/store'

const RELATIONSHIPS = ['Daughter', 'Son', 'Partner', 'Parent', 'Sibling', 'Friend', 'Other']

const input =
  'mt-1.5 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-lg text-ink placeholder:text-muted/70 focus:border-sage focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function Details({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [room, setRoom] = useState('')
  const [relationship, setRelationship] = useState('')
  const [notes, setNotes] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const p = addPatient({
      name: name.trim(),
      preferredName: preferredName.trim(),
      room: room.trim(),
      relationship,
      notes: notes.trim(),
      voice: { kind: 'device' }, // until VoiceSetup gives them theirs
      calibration: null,
    })
    onCreated(p.id)
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <Field label="Their name">
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="What they like to be called">
        <input className={input} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="e.g. Grandpa Joe" autoComplete="off" />
      </Field>
      <Field label="Hospital and room">
        <input className={input} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. St. Mary’s ICU, bed 4" autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="font-medium">You are their…</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRelationship(r === relationship ? '' : r)}
              aria-pressed={r === relationship}
              className={`rounded-full border px-4 py-2.5 ${r === relationship ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-ink'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Notes for the care team">
        <textarea className={`${input} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, hearing, what calms them" />
      </Field>
      <button type="submit" disabled={!name.trim()} className={btnPrimary}>
        Continue
      </button>
    </form>
  )
}

function TeachNow({ id }: { id: string }) {
  const p = usePatient(id)
  const name = p ? p.preferredName || p.name : 'them'
  return (
    <div className="mt-6">
      <p className="text-lg text-muted">
        {name} mouths each phrase 3 times while you hold the phone. It takes about 2 minutes, and the lip reader gets noticeably
        better at reading {name}.
      </p>
      <div className="mt-8 space-y-3">
        <button type="button" onClick={() => navigate(`/p/${id}/teach`, { replace: true })} className={btnPrimary}>
          Start
        </button>
        <button type="button" onClick={() => navigate(`/p/${id}`, { replace: true })} className={btnSecondary}>
          Later
        </button>
      </div>
    </div>
  )
}

export default function NewPatient() {
  const [id, setId] = useState<string | null>(null)
  const [step, setStep] = useState<'details' | 'voice' | 'teach'>('details')

  const titles = { details: 'Who are they?', voice: 'Give them their voice', teach: 'Teach it their lips now?' }
  return (
    <Screen back={step === 'details' ? '/' : undefined} title={titles[step]}>
      <p className="mt-2 text-sm font-medium text-muted">Step {step === 'details' ? 1 : step === 'voice' ? 2 : 3} of 3</p>
      {step === 'details' && (
        <Details
          onCreated={(newId) => {
            setId(newId)
            setStep('voice')
          }}
        />
      )}
      {step === 'voice' && id && (
        <div className="mt-6">
          <VoiceSetup patientId={id} onDone={() => setStep('teach')} />
        </div>
      )}
      {step === 'teach' && id && <TeachNow id={id} />}
    </Screen>
  )
}
