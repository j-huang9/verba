// Tab bar state shared by the TabBar and the pages that hide it (Talk).
import { useEffect } from 'react'

export type Tab = 'patients' | 'talk' | 'log'

/** height reserved at the bottom of tabbed pages: the bar (4rem) + its gap + the safe area */
export const TAB_SPACE = 'calc(5.5rem + env(safe-area-inset-bottom))'

let hidden = false
export const tabBarHidden = () => hidden
const listeners = new Set<() => void>()
export const subscribeTabBar = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useHideTabBar(hide: boolean) {
  useEffect(() => {
    hidden = hide
    listeners.forEach((l) => l())
    return () => {
      hidden = false
      listeners.forEach((l) => l())
    }
  }, [hide])
}
