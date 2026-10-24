// Home: the patients on this phone, or a 3-step empty state with the demo patient.
import { Avatar, btnPrimary, btnSecondary, card, Chip, Screen } from '../components/Screen'
import { displayName, initials, lipsStatus, timeAgo, voiceStatus } from '../lib/format'
import { href, navigate } from '../lib/router'
import { addPatient, useLog, usePatients, type Patient } from '../lib/store'

function tryDemo() {
  const p = addPatient({
    name: 'Sam',
    preferredName: '',
    room: 'ICU, bed 4',
    relationship: 'Family',
    notes: '',
    voice: { kind: 'demo' },
    calibration: null,
  })
  navigate(`/p/${p.id}`)
}

function PatientCard({ p }: { p: Patient }) {
  const log = useLog(p.id)
  const last = [...log].reverse().find((e) => !e.undone)
  return (
    <a href={href(`/p/${p.id}`)} className={`${card} flex gap-4 p-5 active:bg-line`}>
      <Avatar text={initials(p)} />
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold">{displayName(p)}</p>
        {p.room && <p className="text-muted">{p.room}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone={p.voice.kind === 'device' ? 'muted' : 'sage'}>{voiceStatus(p)}</Chip>
          {lipsStatus(p) ? <Chip tone="sage">Lips taught ✓</Chip> : <Chip>Lips not taught</Chip>}
        </div>
        {last && (
          <p className="mt-3 truncate text-muted">
            <span className="font-phrase text-ink">“{last.text}”</span> · {timeAgo(last.at)}
          </p>
        )}
      </div>
    </a>
  )
}

const STEPS = [
  ['Add them', 'Their name and room, so the care team knows who it is.'],
  ['Give them their voice', 'From an old family video or voice memo. It takes about a minute.'],
  ['Talk', 'Point the phone at them, tap Listen, and they mouth what they want to say.'],
]

export default function Home() {
  const patients = usePatients()
  return (
    <Screen>
      {patients.length > 0 ? (
        <>
          <h1 className="mt-4 font-phrase text-4xl">Who are you with?</h1>
          <div className="mt-6 space-y-3">
            {patients.map((p) => (
              <PatientCard key={p.id} p={p} />
            ))}
          </div>
          <a href={href('/new')} className={`${btnSecondary} mt-4 block text-center`}>
            Add a patient
          </a>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-phrase text-4xl leading-tight text-balance">A voice for someone who can’t speak right now</h1>
          <ol className="mt-8 space-y-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-soft font-medium text-sage">{i + 1}</span>
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href={href('/new')} className={`${btnPrimary} mt-10 block text-center`}>
            Add a patient
          </a>
          <button type="button" onClick={tryDemo} className={`${btnSecondary} mt-3`}>
            Try the demo patient
          </button>
        </>
      )}
      <p className="mt-10 text-center text-sm text-muted">Everything stays on this phone. Not a medical device.</p>
    </Screen>
  )
}
