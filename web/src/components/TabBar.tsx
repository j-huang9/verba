// The bottom tab bar: Patients · Talk · Conversation. Floats above the safe area.
// Talk hides it with useHideTabBar() (lib/tabBar.ts) while listening, confirming or showing
// a sheet or the phrase board, so it never covers the Listen button or the sheets.
import { useSyncExternalStore } from 'react'
import { href } from '../lib/router'
import { subscribeTabBar, tabBarHidden, type Tab } from '../lib/tabBar'

const ICONS: Record<Tab, React.ReactNode> = {
  patients: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.4 3.5 5.2" />
    </>
  ),
  talk: (
    <>
      <path d="M4 12c2.5-3.5 5.5-4.5 8-2.5 2.5-2 5.5-1 8 2.5-2.5 3.5-5 4.5-8 4.5S6.5 15.5 4 12z" />
      <path d="M4 12h16" />
    </>
  ),
  log: (
    <>
      <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
}

const TABS: { tab: Tab; label: string; to: string }[] = [
  { tab: 'patients', label: 'Patients', to: '/patients' },
  { tab: 'talk', label: 'Talk', to: '/talk' },
  { tab: 'log', label: 'Conversation', to: '/log' },
]

export function TabBar({ active }: { active: Tab }) {
  const isHidden = useSyncExternalStore(subscribeTabBar, tabBarHidden)
  if (isHidden) return null
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md gap-1 rounded-full bg-sage p-1.5 shadow-[0_10px_30px_rgba(3,50,54,0.25)]"
    >
      {TABS.map(({ tab, label, to }) => {
        const on = tab === active
        return (
          <a
            key={tab}
            href={href(to)}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full px-2 text-sm font-medium transition-colors duration-200 ease-calm ${
              on ? 'bg-surface text-sage' : 'text-surface/75 active:bg-surface/10'
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[tab]}
            </svg>
            <span className={on ? '' : 'sr-only min-[380px]:not-sr-only'}>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
