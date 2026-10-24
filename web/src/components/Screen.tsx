// The light page shell (Home, New patient, Patient, Log, Voice). Camera screens stay dark.
import { href } from '../lib/router'

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title?: React.ReactNode
  /** route path for the back button, e.g. '/' */
  back?: string
  /** small element on the right of the header */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto max-w-xl px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="flex min-h-11 items-center justify-between gap-3">
          {back !== undefined ? (
            <a href={href(back)} aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full active:bg-line">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </a>
          ) : (
            <p className="font-phrase text-xl">Silent Voice</p>
          )}
          {action}
        </header>
        {title && <h1 className="mt-4 font-phrase text-4xl leading-tight text-balance">{title}</h1>}
        {children}
      </div>
    </main>
  )
}

export const btnPrimary =
  'w-full rounded-full bg-sage py-4 text-lg font-medium text-surface active:opacity-90 disabled:opacity-40'
export const btnSecondary =
  'w-full rounded-full border border-line bg-surface py-3.5 text-lg font-medium text-ink active:bg-line'
export const card = 'rounded-card bg-surface shadow-sm'

export function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'sage' | 'honey' }) {
  const tones = { muted: 'bg-canvas text-muted', sage: 'bg-sage-soft text-sage', honey: 'bg-honey-soft text-honey' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Avatar({ text, size = 'md' }: { text: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-sage-soft font-medium text-sage ${size === 'lg' ? 'size-16 text-2xl' : 'size-12 text-lg'}`}
    >
      {text}
    </span>
  )
}
