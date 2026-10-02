import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  ErrorBox,
  Notice,
  PageTitle,
  TeamName,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { LEAGUE_NAME } from '../lib/labels'
import { useTeams } from '../lib/queries'

export default function Profile() {
  const { profile, changePassword, signOut } = useAuth()
  const teams = useTeams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const team = teams.data?.find((t) => t.id === profile?.team_id)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(false)
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri.')
    if (password !== confirm) return setError('Le due password non coincidono.')
    const err = await changePassword(password)
    setError(err)
    if (!err) {
      setDone(true)
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageTitle>Profilo</PageTitle>
      <Card>
        <p className="text-sm text-slate-600">Squadra</p>
        <p className="text-lg">
          <TeamName team={team} bold />
        </p>
        {team && <p className="text-sm text-slate-500">{LEAGUE_NAME[team.league]}</p>}
      </Card>

      <Card title="Cambia password">
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium">
            Nuova password
            <input
              className={`${inputClass} mt-1`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Ripeti la nuova password
            <input
              className={`${inputClass} mt-1`}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          {done && <Notice>Password aggiornata.</Notice>}
          <button className={buttonClass}>Salva password</button>
        </form>
      </Card>

      <button
        className={secondaryButtonClass}
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
      >
        Esci
      </button>
    </div>
  )
}
