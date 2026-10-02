import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  LEAGUE_COLOR,
  LEAGUE_NAME,
  MANTRA_NAME,
  mantraColor,
  mantraLabel,
  splitMantraRoles,
} from '../lib/labels'
import type { League, Team } from '../lib/types'

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-blue-100 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-blue-900">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-blue-900">{children}</h1>
      {sub && <p className="text-sm text-slate-600">{sub}</p>}
    </div>
  )
}

export function Loading({ what = 'dati' }: { what?: string }) {
  return <p className="p-4 text-sm text-slate-500">Caricamento {what}…</p>
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
      {children}
    </p>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{children}</p>
}

/** Team name tinted with the colour of its league (subtle, text only). */
export function TeamName({
  team,
  bold = false,
  className = '',
}: {
  team: Pick<Team, 'name' | 'league'> | undefined
  bold?: boolean
  className?: string
}) {
  if (!team) return <span className={className}>?</span>
  return (
    <span
      style={{ color: LEAGUE_COLOR[team.league] }}
      className={`${bold ? 'font-semibold' : ''} ${className}`}
      title={LEAGUE_NAME[team.league]}
    >
      {team.name}
    </span>
  )
}

export function LeagueLegend() {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"
      aria-label="Legenda leghe"
    >
      {(['A', 'B', 'C'] as League[]).map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: LEAGUE_COLOR[l] }}
          />
          <span style={{ color: LEAGUE_COLOR[l] }}>{LEAGUE_NAME[l]}</span>
        </li>
      ))}
    </ul>
  )
}

export const buttonClass =
  'inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50'
export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 disabled:opacity-50'
export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

/** Mantra roles as small chips, e.g. "Dd Dc"; hover for the full name. */
export function MantraRoles({ roles }: { roles: string }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {splitMantraRoles(roles).map((r) => (
        <abbr
          key={r}
          title={MANTRA_NAME[r] ?? r}
          style={{ backgroundColor: mantraColor(r) }}
          className="rounded px-1 text-[10px] font-bold leading-4 text-white no-underline"
        >
          {mantraLabel(r)}
        </abbr>
      ))}
    </span>
  )
}

/**
 * Team name that opens the team's roster when the visitor is logged in (the rosters page is for
 * logged users); otherwise it is plain text.
 */
export function TeamLink({
  team,
  bold = false,
}: {
  team: Pick<Team, 'id' | 'name' | 'league'> | undefined
  bold?: boolean
}) {
  const { session } = useAuth()
  if (!session || !team) return <TeamName team={team} bold={bold} />
  return (
    <Link
      to={`/rose?squadra=${team.id}`}
      className="hover:underline"
      title={`Rosa di ${team.name}`}
    >
      <TeamName team={team} bold={bold} />
    </Link>
  )
}
