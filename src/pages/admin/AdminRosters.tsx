import { useState } from 'react'
import RosterEditor from '../../components/RosterEditor'
import { Loading } from '../../components/ui'
import { LEAGUE_NAME } from '../../lib/labels'
import { useTeams } from '../../lib/queries'
import type { League } from '../../lib/types'

export default function AdminRosters() {
  const teams = useTeams()
  const [teamId, setTeamId] = useState<number | null>(null)
  if (teams.isLoading || !teams.data) return <Loading />
  const selected = teamId ?? teams.data[0].id

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">
        Squadra{' '}
        <select
          className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          value={selected}
          onChange={(e) => setTeamId(Number(e.target.value))}
        >
          {(['A', 'B', 'C'] as League[]).map((league) => (
            <optgroup key={league} label={LEAGUE_NAME[league]}>
              {teams
                .data!.filter((t) => t.league === league)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <RosterEditor
        key={selected}
        teamId={selected}
        title="Rosa"
        subtitle="Come amministratore puoi modificare la rosa di qualsiasi squadra."
      />
    </div>
  )
}
