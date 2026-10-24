// A tiny hash router. Routes live in location.hash, so ?mock and ?debug stay in
// location.search and keep working on every page.
//   #/              home
//   #/new           add a patient
//   #/p/:id         patient page
//   #/p/:id/talk    lip reading + phrase board (#/p/:id/talk?board opens the board)
//   #/p/:id/teach   teach it their lips (A)
//   #/p/:id/voice   their voice (A's VoiceSetup)
//   #/p/:id/log     conversation log
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'patient' | 'teach' | 'voice' | 'log'; id: string }
  | { name: 'talk'; id: string; board: boolean }

const SUBPAGES = ['teach', 'voice', 'log'] as const

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'new' && parts.length === 1) return { name: 'new' }
  if (parts[0] === 'p' && parts[1]) {
    const id = decodeURIComponent(parts[1])
    if (parts.length === 2) return { name: 'patient', id }
    if (parts[2] === 'talk' && parts.length === 3) return { name: 'talk', id, board: new URLSearchParams(query).has('board') }
    const sub = SUBPAGES.find((s) => s === parts[2])
    if (sub && parts.length === 3) return { name: sub, id }
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
