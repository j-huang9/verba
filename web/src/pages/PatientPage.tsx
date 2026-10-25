// One patient (Patients tab): edit their details, change their voice, redo Teach it their lips,
// see their conversation, or delete them from this phone. Details save as you type.
import { useState } from 'react'
import { PatientFields, type Details } from '../components/PatientFields'
import { Avatar, btnPrimary, card, Screen } from '../components/Screen'
import { displayName, initials, lipsStatus, voiceDetail } from '../lib/format'
import { deletePatient } from '../lib/forget'
import { href, navigate } from '../lib/router'
import { updatePatient, useLog, usePatient, type Patient } from '../lib/store'

function Row({ to, title, status }: { to: string; title: string; status?: string }) {
  return (
    <a href={href(to)} className="flex min-h-16 items-center gap-4 px-5 py-4 active:bg-line">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{title}</p>
        {status && <p className="text-muted">{status}</p>}
      </div>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

function EditDetails({ p }: { p: Patient }) {
  const [d, setD] = useState<Details>({ name: p.name, preferredName: p.preferredName, room: p.room, relationship: p.relationship, notes: p.notes })
  const change = (next: Details) => {
    setD(next)
    // save as they type; never save a blank name
    updatePatient(p.id, { ...next, name: next.name.trim() ? next.name : p.name })
  }
  return <PatientFields value={d} onChange={change} />
}

export default function PatientPage({ id }: { id: string }) {
  const p = usePatient(id)
  const log = useLog(id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!p) {
    return (
      <Screen back="/patients" title="Patient not found">
        <p className="mt-3 text-muted">They may have been deleted from this phone.</p>
      </Screen>
    )
  }
  const name = displayName(p)
  const lips = lipsStatus(p)
  const said = log.filter((e) => !e.undone).length

  return (
    <Screen back="/patients">
      <div className="mt-4 flex items-center gap-4">
        <Avatar text={initials(p)} size="lg" />
        <div className="min-w-0">
          <h1 className="font-phrase text-4xl leading-tight">{name}</h1>
          {p.room && <p className="text-muted">{p.room}</p>}
        </div>
      </div>

      <a href={href(`/p/${id}/talk`)} className={`${btnPrimary} mt-6 block text-center`}>
        Talk with {name}
      </a>

      <div className={`${card} mt-6 divide-y divide-line overflow-hidden`}>
        <Row to={`/p/${id}/voice`} title="Their voice" status={voiceDetail(p)} />
        <Row
          to={`/p/${id}/teach`}
          title={lips ? 'Redo Teach it their lips' : 'Teach it their lips'}
          status={lips ? `Taught ✓ · ${lips}` : 'Not yet · about 2 minutes'}
        />
        <Row to={`/p/${id}/log`} title="Conversation" status={said ? `${said} message${said === 1 ? '' : 's'}` : 'Nothing said yet'} />
      </div>

      <h2 className="mt-8 text-sm font-semibold tracking-wide text-muted uppercase">Details</h2>
      <div className={`${card} mt-2 p-5`}>
        <EditDetails key={p.id} p={p} />
        <p className="mt-4 text-sm text-muted">Changes save automatically.</p>
      </div>

      <div className="mt-8">
        {confirmDelete ? (
          <div className={`${card} p-5`} role="alertdialog" aria-labelledby="delete-q">
            <p id="delete-q" className="text-lg">
              Delete {name}? Their conversation and saved voice will be removed from this phone.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-12 rounded-full bg-canvas font-medium">
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePatient(id)
                  navigate('/patients', { replace: true })
                }}
                className="min-h-12 rounded-full border border-ink/30 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mx-auto block min-h-11 px-4 text-muted underline underline-offset-4">
            Delete {name}
          </button>
        )}
      </div>
    </Screen>
  )
}
