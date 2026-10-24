// The conversation log: everything they said, grouped by day. Undone messages stay, struck
// through; corrected ones say what they replaced. Share sends a text summary to the nurse.
import { useState } from 'react'
import { card, Screen } from '../components/Screen'
import { clock, dayLabel, displayName, entryMeta } from '../lib/format'
import { PHRASE_BY_ID } from '../lib/phrases'
import { unlockAudio, useSpeaker } from '../lib/speaker'
import { getPatient, useLog, usePatient, type LogEntry, type Patient } from '../lib/store'
import { voiceUrl } from '../lib/voice'

function summary(p: Patient, entries: LogEntry[]) {
  const lines = entries
    .filter((e) => !e.undone)
    .map((e) => `${dayLabel(e.at)} ${clock(e.at)}  "${e.text}"  (${entryMeta(e)})`)
  return [`What ${displayName(p)} said${p.room ? ` (${p.room})` : ''}, from Verba:`, '', ...lines].join('\n')
}

export default function Log({ id }: { id: string }) {
  const p = usePatient(id)
  const log = useLog(id)
  const speaker = useSpeaker()
  const [filter, setFilter] = useState<'all' | 'urgent'>('all')
  const [shared, setShared] = useState<string | null>(null)

  if (!p) {
    return (
      <Screen back="/" title="Patient not found">
        <p className="mt-3 text-muted">They may have been removed from this phone.</p>
      </Screen>
    )
  }

  const entries = [...log].sort((a, b) => b.at - a.at).filter((e) => filter === 'all' || PHRASE_BY_ID[e.phraseId]?.urgent)
  const days: [string, LogEntry[]][] = []
  for (const e of entries) {
    const d = dayLabel(e.at)
    if (days.at(-1)?.[0] !== d) days.push([d, []])
    days.at(-1)![1].push(e)
  }

  const replay = async (e: LogEntry) => {
    unlockAudio() // inside the tap, so iOS plays it after the voice URL resolves
    const patient = getPatient(id)
    speaker.speak(e.phraseId, e.text, patient ? await voiceUrl(patient, e.phraseId) : null)
  }

  const share = async () => {
    const text = summary(p, [...log])
    try {
      if (navigator.share) await navigator.share({ title: `${displayName(p)}: conversation`, text })
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
      className={`rounded-full px-4 py-2 text-sm font-medium ${filter === f ? 'bg-sage text-surface' : 'text-muted'}`}
    >
      {label}
    </button>
  )

  return (
    <Screen
      back={`/p/${id}`}
      title="Conversation"
      action={
        log.some((e) => !e.undone) && (
          <button type="button" onClick={share} className="rounded-full border border-line bg-surface px-4 py-2 font-medium active:bg-line">
            Share
          </button>
        )
      }
    >
      <p className="mt-1 text-muted">Everything {displayName(p)} said on this phone.</p>
      {shared && <p className="mt-3 text-sm text-sage">{shared}</p>}

      <div className="mt-5 inline-flex rounded-full bg-surface p-1 shadow-sm">
        {tab('all', 'All')}
        {tab('urgent', 'Urgent')}
      </div>

      {days.length === 0 && (
        <p className="mt-10 text-center text-muted">{filter === 'urgent' ? 'Nothing urgent yet.' : 'Nothing said yet. Start talking from their page.'}</p>
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
