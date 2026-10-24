// Routes (lib/router.ts). Home, New, Patient and Log are placeholders until C's Step 2 pages;
// Teach and Voice are placeholders until A's Teach.tsx and VoiceSetup land.
import PatientApp from './pages/PatientApp'
import { href, navigate, useRoute } from './lib/router'
import { addPatient, usePatient, usePatients } from './lib/store'

function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-ink">
      <a href={href('/')} className="font-phrase text-xl">
        Silent Voice
      </a>
      <h1 className="mt-6 font-phrase text-4xl">{title}</h1>
      <div className="mt-6 space-y-3">{children}</div>
    </main>
  )
}

const linkClass = 'block rounded-card bg-surface px-5 py-4 text-lg font-medium shadow-sm active:bg-line'

function tryDemo() {
  const p = addPatient({
    name: 'Demo patient',
    preferredName: 'Sam',
    room: '',
    relationship: 'Family',
    notes: '',
    voice: { kind: 'demo' },
    calibration: null,
  })
  navigate(`/p/${p.id}/talk`)
}

function HomePlaceholder() {
  const patients = usePatients()
  return (
    <Page title="Patients">
      {patients.map((p) => (
        <a key={p.id} href={href(`/p/${p.id}`)} className={linkClass}>
          {p.preferredName || p.name}
        </a>
      ))}
      <button type="button" onClick={tryDemo} className="w-full rounded-full bg-sage py-3.5 font-medium text-surface">
        Try the demo patient
      </button>
    </Page>
  )
}

function PatientPlaceholder({ id }: { id: string }) {
  const p = usePatient(id)
  if (!p) return <Page title="Patient not found" />
  return (
    <Page title={p.preferredName || p.name}>
      <a href={href(`/p/${id}/talk`)} className={linkClass}>Start talking</a>
      <a href={href(`/p/${id}/teach`)} className={linkClass}>Teach it their lips</a>
      <a href={href(`/p/${id}/voice`)} className={linkClass}>Their voice</a>
      <a href={href(`/p/${id}/log`)} className={linkClass}>Conversation</a>
    </Page>
  )
}

export default function App() {
  const route = useRoute()
  switch (route.name) {
    case 'home':
      return <HomePlaceholder />
    case 'new':
      return <Page title="Add a patient">Coming soon.</Page>
    case 'patient':
      return <PatientPlaceholder id={route.id} />
    case 'talk':
      return <PatientApp />
    case 'teach':
      return <Page title="Teach it their lips">Coming soon (A).</Page>
    case 'voice':
      return <Page title="Their voice">Coming soon (A).</Page>
    case 'log':
      return <Page title="Conversation">Coming soon.</Page>
  }
}
