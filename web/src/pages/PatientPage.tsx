// One patient: start talking, and the status of everything that makes it work for them.
import { useState } from 'react'
import { Avatar, btnPrimary, card, Screen } from '../components/Screen'
import { clock, displayName, entryMeta, initials, lipsStatus, voiceDetail } from '../lib/format'
import { href, navigate } from '../lib/router'
import { removePatient, useLog, usePatient } from '../lib/store'

function Row({ to, title, status, children }: { to: string; title: string; status?: string; children?: React.ReactNode }) {
  return (
    <a href={href(to)} className="flex items-center gap-4 px-5 py-4 active:bg-line">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{title}</p>
        {status && <p className="text-muted">{status}</p>}
        {children}
      </div>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

export default function PatientPage({ id }: { id: string }) {
  const p = usePatient(id)
  const log = useLog(id)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!p) {
    return (
      <Screen back="/" title="Patient not found">
        <p className="mt-3 text-muted">They may have been removed from this phone.</p>
      </Screen>
    )
  }
  const name = displayName(p)
  const recent = log.slice(-3).reverse()
  const lips = lipsStatus(p)

  return (
    <Screen back="/">
      <div className="mt-4 flex items-center gap-4">
        <Avatar text={initials(p)} size="lg" />
        <div className="min-w-0">
          <h1 className="font-phrase text-4xl leading-tight">{name}</h1>
          {(p.room || p.relationship) && (
            <p className="text-muted">{[p.room, p.relationship && `You: ${p.relationship.toLowerCase()}`].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </div>

      <a href={href(`/p/${id}/talk`)} className={`${btnPrimary} mt-8 block py-5 text-center text-xl`}>
        Start talking
      </a>

      <div className={`${card} mt-6 divide-y divide-line overflow-hidden`}>
        <Row to={`/p/${id}/talk?board`} title="Phrase board" status="Tap or blink to pick a phrase" />
        <Row
          to={`/p/${id}/teach`}
          title="Teach it their lips"
          status={lips ? `Taught ✓ · ${lips}` : 'Not yet · about 2 minutes'}
        />
        <Row to={`/p/${id}/voice`} title="Their voice" status={voiceDetail(p)} />
        <Row to={`/p/${id}/log`} title="Conversation" status={recent.length ? undefined : 'Nothing said yet'}>
          {recent.map((e) => (
            <p key={e.id} className={`mt-1 truncate ${e.undone ? 'text-muted line-through' : ''}`}>
              <span className="font-phrase">{e.text}</span>{' '}
              <span className="text-sm text-muted">
                · {clock(e.at)} · {entryMeta(e)}
              </span>
            </p>
          ))}
        </Row>
      </div>

      {p.notes && (
        <div className={`${card} mt-4 px-5 py-4`}>
          <p className="text-sm font-medium text-muted">Notes for the care team</p>
          <p className="mt-1 whitespace-pre-line">{p.notes}</p>
        </div>
      )}

      <div className="mt-10 text-center">
        {confirmRemove ? (
          <div className={`${card} p-5`}>
            <p>Remove {name} and their conversation from this phone?</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setConfirmRemove(false)} className="flex-1 rounded-full bg-canvas py-3 font-medium">
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  removePatient(id)
                  navigate('/', { replace: true })
                }}
                className="flex-1 rounded-full border border-line py-3 font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm text-muted underline underline-offset-4">
            Remove patient
          </button>
        )}
      </div>
    </Screen>
  )
}
