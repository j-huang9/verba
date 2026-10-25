// Which patient Talk is with: remembered across launches so the app opens on them.
// A UI preference, kept apart from the shared store (lib/store.ts) on purpose.
import { useSyncExternalStore } from 'react'

const KEY = 'verba:lastPatient'
let last: string | null = null
try {
  last = localStorage.getItem(KEY)
} catch {
  // blocked storage: remember for this session only
}
const listeners = new Set<() => void>()

export function setLastPatient(id: string | null) {
  if (id === last) return
  last = id
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export const getLastPatient = () => last

export function useLastPatient(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => last,
  )
}
