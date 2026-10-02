import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Card,
  ErrorBox,
  Loading,
  Notice,
  TeamName,
  buttonClass,
  inputClass,
} from '../../components/ui'
import { useTeams } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import type { Team } from '../../lib/types'

function ResetRow({ team }: { team: Team }) {
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { teamId: team.id, password },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => setPassword(''),
  })

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-56 text-sm">
          <TeamName team={team} />
        </span>
        <input
          className={`${inputClass} !w-56`}
          type="text"
          autoComplete="off"
          placeholder="Nuova password (min. 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label={`Nuova password per ${team.name}`}
        />
        <button
          className={buttonClass}
          disabled={password.length < 8 || reset.isPending}
          onClick={() => reset.mutate()}
        >
          Reimposta
        </button>
        {reset.isSuccess && <span className="text-sm text-green-700">Password cambiata.</span>}
      </div>
      {reset.error && (
        <div className="mt-1">
          <ErrorBox>Non riuscito: {reset.error.message}</ErrorBox>
        </div>
      )}
    </li>
  )
}

export default function AdminTeams() {
  const teams = useTeams()
  if (teams.isLoading || !teams.data) return <Loading />
  return (
    <Card title="Reimposta la password di una squadra">
      <Notice>
        Non c&apos;è il recupero via email: se una squadra dimentica la password, impostane una
        nuova qui e comunicagliela. La squadra potrà poi cambiarla dal proprio profilo. Serve la
        funzione <code>admin-reset-password</code> pubblicata su Supabase.
      </Notice>
      <ul className="mt-3 divide-y divide-blue-50">
        {teams.data.map((t) => (
          <ResetRow key={t.id} team={t} />
        ))}
      </ul>
    </Card>
  )
}
