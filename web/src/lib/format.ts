// Display helpers shared by Home, the patient page and the log.
import type { LogEntry, Patient } from './store'

export const displayName = (p: Patient) => p.preferredName || p.name

export function initials(p: Patient) {
  const words = (p.name || p.preferredName).trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?'
}

export const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function dayLabel(at: number) {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

export function timeAgo(at: number) {
  const min = Math.round((Date.now() - at) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 24 * 60) return clock(at)
  return dayLabel(at)
}

/** "Lip reading · 82% sure", "Confirmed by blink", "Phrase board" */
export function entryMeta(e: LogEntry) {
  if (e.how === 'board') return 'Phrase board'
  if (e.how === 'scan') return 'Phrase board · blink scan'
  if (e.confirmedBy === 'blink') return 'Lip reading · confirmed by blink'
  if (e.confirmedBy === 'tap') return 'Lip reading · picked by tap'
  return e.confidence !== undefined ? `Lip reading · ${Math.round(e.confidence * 100)}% sure` : 'Lip reading'
}

/** short, for chips: "Their voice", "Their voice · 12/50", "Demo voice", "Phone voice" */
export function voiceStatus(p: Patient) {
  if (p.voice.kind === 'demo') return 'Demo voice'
  if (p.voice.kind === 'device') return 'Phone voice'
  const bank = p.voice.bank ?? 0
  return bank < 50 ? `Their voice · ${bank}/50` : 'Their voice ✓'
}

/** longer, for the patient page row */
export function voiceDetail(p: Patient) {
  if (p.voice.kind === 'demo') return 'Using the demo voice'
  if (p.voice.kind === 'device') return 'Using the phone’s voice · tap to give them theirs'
  const from = p.voice.source === 'record' ? 'recorded' : 'cloned from a family clip'
  const bank = p.voice.bank ?? 0
  return bank < 50 ? `Their own voice, ${from} · ${bank}/50 phrases ready` : `Their own voice, ${from} · all phrases ready`
}

export function lipsStatus(p: Patient) {
  const c = p.calibration
  if (!c) return null
  return c.check ? `${c.check.before}/${c.check.n} → ${c.check.after}/${c.check.n} on new takes` : `${c.takes} takes`
}
