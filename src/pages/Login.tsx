import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Card, ErrorBox, PageTitle, buttonClass, inputClass } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [team, setTeam] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(team, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageTitle sub="Usa il nome della tua squadra come nome utente.">Accedi</PageTitle>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium">
            Nome squadra
            <input
              className={`${inputClass} mt-1`}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className={`${inputClass} mt-1`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className={`${buttonClass} w-full`} disabled={busy}>
            {busy ? 'Accesso…' : 'Accedi'}
          </button>
          <p className="text-xs text-slate-500">
            Maiuscole, accenti e punteggiatura non contano. Se hai dimenticato la password chiedila
            all&apos;amministratore.
          </p>
        </form>
      </Card>
    </div>
  )
}
