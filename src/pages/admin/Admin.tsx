import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Loading, PageTitle } from '../../components/ui'
import { useAuth } from '../../lib/auth'

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'bg-white text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50'
  }`

/** Admin area: the database rules enforce admin-only writes, this guard just hides the pages. */
export default function Admin() {
  const { profile, profileLoading } = useAuth()
  if (profileLoading) return <Loading />
  if (!profile?.is_admin) return <Navigate to="/" replace />

  return (
    <div>
      <PageTitle
        sub={
          <>
            Formazioni, voti, calcolo delle giornate, rose e segnalazioni.{' '}
            <a
              className="underline"
              href="https://github.com/MortDeKayXII/fanta_champions/blob/main/docs/guida-admin.md"
              target="_blank"
              rel="noreferrer"
            >
              Guida amministratore
            </a>
          </>
        }
      >
        Amministrazione
      </PageTitle>
      <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Sezioni admin">
        <NavLink to="/admin/formazioni" className={tab}>
          Formazioni
        </NavLink>
        <NavLink to="/admin/calcolo" className={tab}>
          Voti e calcolo
        </NavLink>
        <NavLink to="/admin/eliminazione" className={tab}>
          Eliminazione
        </NavLink>
        <NavLink to="/admin/rose" className={tab}>
          Rose
        </NavLink>
        <NavLink to="/admin/segnalazioni" className={tab}>
          Segnalazioni
        </NavLink>
        <NavLink to="/admin/squadre" className={tab}>
          Squadre
        </NavLink>
        <NavLink to="/admin/backup" className={tab}>
          Backup
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
