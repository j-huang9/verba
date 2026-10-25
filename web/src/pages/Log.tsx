// Conversation tab: everything they said, grouped by day, for one patient or all of them.
// Undone messages stay, struck through; corrected ones say what they replaced.
// Share sends a text summary to the nurse.
import { useState } from 'react'
import { PatientPicker } from '../components/PatientPicker'
import { card, Screen } from '../components/Screen'
import { clock, dayLabel, displayName, entryMeta } from '../lib/format'
import { PHRASE_BY_ID } from '../lib/phrases'
import { navigate } from '../lib/router'
import { unlockAudio, useSpeaker } from '../lib/speaker'
import { getPatient, useAllLog, usePatients, type LogEntry, type Patient } from '../lib/store'
import { voiceUrl } from '../lib/voice'

function summary(patients: Patient[], entries: LogEntry[]) {
  const out: string[] = []
  for (const p of patients) {
    const lines = entries
      .filter((e) => e.patientId === p.id && !e.undone)
      .map((e) => `${dayLabel(e.at)} ${clock(e.at)}  "${e.text}"  (${entryMeta(e)})`)
    if (!lines.length) continue
    if (out.length) out.push('')
    out.push(`What ${displayName(p)} said${p.room ? ` (${p.room})` : ''}, from Verba:`, '', ...lines)
  }
  return out.join('\n')
}

/** `id` null = all patients */
export default function Log({ id }: { id: string | null }) {
  const patients = usePatients()
  const all = useAllLog()
  const speaker = useSpeaker()
  const [filter, setFilter] = useState<'all' | 'urgent'>('all')
  const [shared, setShared] = useState<string | null>(null)

  const patient = id ? (patients.find((p) => p.id === id) ?? null) : null
  const shown = id ? (patient ? [patient] : []) : patients
  const byId = new Map(patients.map((p) => [p.id, p]))
  const log = all.filter((e) => byId.has(e.patientId) && (!id || e.patientId === id))

  const entries = [...log].sort((a, b) => b.at - a.at).filter((e) => filter === 'all' || PHRASE_BY_ID[e.phraseId]?.urgent)
  const days: [string, LogEntry[]][] = []
  for (const e of entries) {
    const d = dayLabel(e.at)
    if (days.at(-1)?.[0] !== d) days.push([d, []])
    days.at(-1)![1].push(e)
  }

  const replay = async (e: LogEntry) => {
    unlockAudio() // inside the tap, so iOS plays it after the voice URL resolves
    const p = getPatient(e.patientId)
    speaker.speak(e.phraseId, e.text, p ? await voiceUrl(p, e.phraseId) : null)
  }

  const share = async () => {
    const text = summary(shown, log)
    try {
      if (navigator.share) await navigator.share({ title: patient ? `${displayName(patient)}: conversation` : 'Verba: conversations', text })
      else {
        await navigator.clipboard.writeText(text)
        setShared('Copied. Paste it in a message to the nurse.')
      }
    } catch {
      // share sheet dismissed
    }
  }

  const tab = (f: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      aria-pressed={filter === f}
      className={`min-h-11 rounded-full px-5 text-sm font-medium ${filter === f ? 'bg-sage text-surface' : 'text-muted'}`}
    >
      {label}
    </button>
  )

  return (
    <Screen
      title="Conversation"
      action={
        log.some((e) => !e.undone) && (
          <button type="button" onClick={share} className="min-h-11 rounded-full border border-line bg-surface px-5 font-medium active:bg-line">
            Share
          </button>
        )
      }
    >
      {patients.length > 0 && (
        <div className="mt-4">
          <PatientPicker value={id} allOption onChange={(pid) => navigate(pid ? `/p/${pid}/log` : '/log', { replace: true })} />
        </div>
      )}
      {shared && <p className="mt-3 text-sm text-sage">{shared}</p>}

      <div className="mt-4 inline-flex rounded-full bg-surface p-1 shadow-card">
        {tab('all', 'All')}
        {tab('urgent', 'Urgent')}
      </div>

      {days.length === 0 && (
        <p className="mt-10 text-center text-muted">
          {filter === 'urgent' ? 'Nothing urgent yet.' : 'Nothing said yet. Messages appear here as they’re spoken.'}
        </p>
      )}

      {days.map(([day, list]) => (
        <section key={day} className="mt-6">
          <h2 className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">{day}</h2>
          <ul className={`${card} mt-2 divide-y divide-line overflow-hidden`}>
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className={`font-phrase text-2xl leading-tight ${e.undone ? 'text-muted line-through' : ''}`}>{e.text}</p>
                  <p className="mt-1 text-sm text-muted">
                    {!id && `${displayName(byId.get(e.patientId)!)} · `}
                    {clock(e.at)} · {entryMeta(e)}
                    {e.undone && ' · Undone'}
                  </p>
                  {e.correctedFrom && e.correctedFrom !== e.phraseId && (
                    <p className="mt-0.5 text-sm text-muted">Replaced “{PHRASE_BY_ID[e.correctedFrom]?.text ?? e.correctedFrom}”</p>
                  )}
                </div>
                {!e.undone && (
                  <button
                    type="button"
                    onClick={() => replay(e)}
                    aria-label={`Replay “${e.text}”`}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-soft text-sage active:opacity-80"
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Screen>
  )
}
