import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ErrorBox, Loading } from './components/ui'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import Bracket from './pages/Bracket'
import Calendar from './pages/Calendar'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import Match from './pages/Match'
import MyRoster from './pages/MyRoster'
import Profile from './pages/Profile'
import Report from './pages/Report'
import Rosters from './pages/Rosters'

/** Pages reserved to logged users: others are sent to the login page. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()
  if (loading) return <Loading />
  return session ? children : <Navigate to="/accedi" replace />
}

export default function App() {
  const { loading } = useAuth()
  if (!isConfigured) {
    return (
      <main className="p-8">
        <ErrorBox>Configurazione mancante: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</ErrorBox>
      </main>
    )
  }
  if (loading) return <Loading />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="accedi" element={<Login />} />
        <Route path="calendario" element={<Calendar />} />
        <Route path="classifica" element={<Leaderboard />} />
        <Route path="tabellone" element={<Bracket />} />
        <Route
          path="rose"
          element={
            <RequireAuth>
              <Rosters />
            </RequireAuth>
          }
        />
        <Route
          path="la-mia-rosa"
          element={
            <RequireAuth>
              <MyRoster />
            </RequireAuth>
          }
        />
        <Route
          path="partita/:fixtureId"
          element={
            <RequireAuth>
              <Match />
            </RequireAuth>
          }
        />
        <Route
          path="segnala"
          element={
            <RequireAuth>
              <Report />
            </RequireAuth>
          }
        />
        <Route
          path="profilo"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
