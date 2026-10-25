// Add a patient: 1. details  2. their voice (A's VoiceSetup)  3. teach it their lips now or later.
import { useState } from 'react'
import { PatientFields, type Details } from '../components/PatientFields'
import { btnPrimary, btnSecondary, Screen } from '../components/Screen'
import { VoiceSetup } from '../components/VoiceSetup'
import { navigate } from '../lib/router'
import { setLastPatient } from '../lib/selection'
import { addPatient, usePatient } from '../lib/store'

function DetailsStep({ onCreated }: { onCreated: (id: string) => void }) {
  const [d, setD] = useState<Details>({ name: '', preferredName: '', room: '', relationship: '', notes: '' })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) return
    const p = addPatient({
      name: d.name.trim(),
      preferredName: d.preferredName.trim(),
      room: d.room.trim(),
      relationship: d.relationship,
      notes: d.notes.trim(),
      voice: { kind: 'device' }, // until VoiceSetup gives them theirs
      calibration: null,
    })
    setLastPatient(p.id)
    onCreated(p.id)
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <PatientFields value={d} onChange={setD} />
      <button type="submit" disabled={!d.name.trim()} className={btnPrimary}>
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
        <button type="button" onClick={() => navigate(`/p/${id}/talk`, { replace: true })} className={btnSecondary}>
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
    <Screen back={step === 'details' ? '/patients' : undefined} title={titles[step]}>
      <p className="mt-2 text-sm font-medium text-muted">Step {step === 'details' ? 1 : step === 'voice' ? 2 : 3} of 3</p>
      {step === 'details' && (
        <DetailsStep
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
