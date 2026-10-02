import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useBracketPublished, useTeams } from '../lib/queries'
import ErrorBoundary from './ErrorBoundary'
import { Loading, TeamName } from './ui'

const link = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-white text-blue-800' : 'text-blue-50 hover:bg-white/15'
  }`

export default function Layout() {
  const { session, profile } = useAuth()
  const { data: teams } = useTeams()
  const location = useLocation()
  const bracket = useBracketPublished()
  const myTeam = teams?.find((t) => t.id === profile?.team_id)

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-500 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <NavLink to="/" className="text-xl font-extrabold tracking-tight">
            Fanta Champions
          </NavLink>
          {session && myTeam && (
            <NavLink to="/profilo" className="text-sm text-blue-50 hover:underline">
              <TeamName team={myTeam} className="!text-white" bold /> · Profilo
            </NavLink>
          )}
        </div>
        <nav
          className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3"
          aria-label="Menu principale"
        >
          <NavLink to="/" end className={link}>
            {session ? 'Dashboard' : 'Home'}
          </NavLink>
          {session && (
            <NavLink to="/rose" className={link}>
              Rose
            </NavLink>
          )}
          <NavLink to="/calendario" className={link}>
            Calendario
          </NavLink>
          <NavLink to="/classifica" className={link}>
            Classifica
          </NavLink>
          {(bracket.published || profile?.is_admin) && (
            <NavLink to="/tabellone" className={link}>
              Tabellone
            </NavLink>
          )}
          {session && (
            <NavLink to="/la-mia-rosa" className={link}>
              La mia rosa
            </NavLink>
          )}
          {session && (
            <NavLink to="/segnala" className={link}>
              Segnala errore
            </NavLink>
          )}
          {profile?.is_admin && (
            <NavLink to="/admin" className={link}>
              Admin
            </NavLink>
          )}
          {!session && (
            <NavLink to="/accedi" className={link}>
              Accedi
            </NavLink>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-500">
        Fanta Champions · competizione tra Fanta Montelparo, Fanta Pepe e Fanta Ortezzano ·{' '}
        <a
          className="underline hover:text-blue-700"
          href="https://docs.google.com/document/d/1DKtrNdVbzRW_mo1pVZ3mNrnEP4dRGD-xIxjfEm6s5_c/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
        >
          Guida
        </a>
      </footer>
    </div>
  )
}
