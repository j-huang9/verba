// Patients and the conversation log, saved on this phone (localStorage).
// Shared contract with A (CLAUDE.md "Saturday build"): change the types only together.
// Storage can throw or come back empty (private mode, blocked site data), so every read
// and write is wrapped and the app still works in memory.
import { useSyncExternalStore } from 'react'
import type { Personal } from '../engine/mlp'

export interface Patient {
  id: string
  name: string
  /** what they like to be called */
  preferredName: string
  /** hospital and room */
  room: string
  /** the family member's relationship to them, e.g. "Daughter" */
  relationship: string
  /** notes for the care team */
  notes: string
  createdAt: number
  voice: {
    /** demo = the pre-generated /audio/<id>.mp3, clone = their Cartesia clone, device = phone voice */
    kind: 'demo' | 'clone' | 'device'
    voiceId?: string
    source?: 'upload' | 'record'
    /** how many phrases of the clone bank are cached (0..50) */
    bank?: number
  }
  calibration: {
    at: number
    takes: number
    personal: Personal | null
    /** honest held-out check: first-guess accuracy before and after, out of n */
    check?: { before: number; after: number; n: number }
  } | null
}

export interface LogEntry {
  id: string
  patientId: string
  at: number
  phraseId: string
  text: string
  how: 'lips' | 'board' | 'scan'
  confirmedBy: 'confident' | 'blink' | 'tap'
  confidence?: number
  undone?: boolean
  /** phraseId this entry replaced ("Not right?" on the same reading) */
  correctedFrom?: string
}

interface State {
  patients: Patient[]
  log: LogEntry[]
}

const KEY = 'silentvoice:v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<State>
      return { patients: s.patients ?? [], log: s.log ?? [] }
    }
  } catch {
    // unreadable or blocked: start empty
  }
  return { patients: [], log: [] }
}

let state = load()
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // full or blocked: keep it in memory for this session
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// another tab changed it
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = load()
    listeners.forEach((l) => l())
  })
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)

// ---- actions ----

export function addPatient(p: Omit<Patient, 'id' | 'createdAt'>): Patient {
  const patient: Patient = { ...p, id: newId(), createdAt: Date.now() }
  set({ ...state, patients: [...state.patients, patient] })
  return patient
}

/** patch, or a function of the latest patient (safe for async updates like the voice bank) */
export function updatePatient(id: string, patch: Partial<Patient> | ((p: Patient) => Partial<Patient>)) {
  set({
    ...state,
    patients: state.patients.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)),
  })
}

/** removes the patient and their conversation log from this phone */
export function removePatient(id: string) {
  set({ patients: state.patients.filter((p) => p.id !== id), log: state.log.filter((e) => e.patientId !== id) })
}

export function addEntry(e: Omit<LogEntry, 'id' | 'at'> & { at?: number }): LogEntry {
  const entry: LogEntry = { at: Date.now(), ...e, id: newId() }
  set({ ...state, log: [...state.log, entry] })
  return entry
}

export function updateEntry(id: string, patch: Partial<LogEntry>) {
  set({ ...state, log: state.log.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
}

/** non-hook read, for code outside React (e.g. the voice bank builder) */
export const getPatient = (id: string) => state.patients.find((p) => p.id === id) ?? null
export const getPatients = () => state.patients

// ---- hooks ----

export function usePatients(): Patient[] {
  return useSyncExternalStore(subscribe, () => state.patients)
}

export function usePatient(id: string): Patient | null {
  return useSyncExternalStore(subscribe, () => getPatient(id))
}

/** a patient's log, oldest first. Undone entries are included (shown struck through). */
export function useLog(patientId: string): LogEntry[] {
  const log = useSyncExternalStore(subscribe, () => state.log)
  return log.filter((e) => e.patientId === patientId)
}

/** every patient's log, oldest first (the Conversation tab's "All patients") */
export function useAllLog(): LogEntry[] {
  return useSyncExternalStore(subscribe, () => state.log)
}
