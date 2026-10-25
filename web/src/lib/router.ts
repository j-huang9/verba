// A tiny hash router. Routes live in location.hash, so ?mock and ?debug stay in
// location.search and keep working on every page.
//   #/              opens Talk with the last patient (or Patients if there are none)
//   #/patients      Patients tab: the list
//   #/new           add a patient
//   #/p/:id         a patient: edit details, voice, teach, delete
//   #/talk          Talk tab with the last patient;  #/p/:id/talk  with that patient
//                   (add ?board to the hash to open the phrase board, e.g. #/p/:id/talk?board)
//   #/p/:id/teach   teach it their lips (A)
//   #/p/:id/voice   their voice (A's VoiceSetup)
//   #/log           Conversation tab, all patients;  #/p/:id/log  one patient
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' | 'patients' | 'new' }
  | { name: 'patient' | 'teach' | 'voice'; id: string }
  | { name: 'talk'; id: string | null; board: boolean }
  | { name: 'log'; id: string | null }

const SUBPAGES = ['teach', 'voice'] as const

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const board = new URLSearchParams(query).has('board')
  if (parts.length === 1) {
    if (parts[0] === 'new' || parts[0] === 'patients') return { name: parts[0] }
    if (parts[0] === 'talk') return { name: 'talk', id: null, board }
    if (parts[0] === 'log') return { name: 'log', id: null }
  }
  if (parts[0] === 'p' && parts[1]) {
    const id = decodeURIComponent(parts[1])
    if (parts.length === 2) return { name: 'patient', id }
    if (parts.length === 3) {
      if (parts[2] === 'talk') return { name: 'talk', id, board }
      if (parts[2] === 'log') return { name: 'log', id }
      const sub = SUBPAGES.find((s) => s === parts[2])
      if (sub) return { name: sub, id }
    }
  }
  return { name: 'home' }
}

/** '#/p/abc/talk' style link for href=, e.g. href('/p/' + id + '/talk') */
export const href = (path: string) => `#${path}`

/** go to a route; `replace` skips a history entry (e.g. after removing a patient) */
export function navigate(path: string, { replace = false } = {}) {
  if (replace) {
    // replaceState doesn't fire hashchange, so notify subscribers ourselves
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${path}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = path
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** the current route; re-renders on navigation. Compare fields, not identity. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parse(hash)
}
