import { useSearchParams } from 'react-router-dom'
import {
  Card,
  ErrorBox,
  LeagueLegend,
  Loading,
  MantraRoles,
  PageTitle,
  TeamName,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { LEAGUE_NAME, ROLE_NAME, ROLE_ORDER } from '../lib/labels'
import { usePlayers, useRosterEntries, useTeams } from '../lib/queries'
import type { League } from '../lib/types'

export default function Rosters() {
  const { profile } = useAuth()
  const teams = useTeams()
  const players = usePlayers()
  const entries = useRosterEntries()
  const [params, setParams] = useSearchParams()

  if (teams.isLoading || players.isLoading || entries.isLoading) return <Loading />
  if (teams.error || players.error || entries.error)
    return <ErrorBox>Impossibile caricare le rose.</ErrorBox>

  const selectedId = Number(params.get('squadra')) || profile?.team_id || teams.data![0].id
  const team = teams.data!.find((t) => t.id === selectedId)
  const playerById = new Map(players.data!.map((p) => [p.id, p]))
  const roster = entries
    .data!.filter((e) => e.team_id === selectedId)
    .map((e) => ({ ...e, player: playerById.get(e.player_id)! }))
    .sort((a, b) => b.cost - a.cost || a.player.name.localeCompare(b.player.name))
  const total = roster.reduce((s, e) => s + e.cost, 0)

  return (
    <div>
      <PageTitle sub="Le rose sono indicative: le formazioni di giornata sono inserite dall'amministratore.">
        Rose
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <Card>
          {(['A', 'B', 'C'] as League[]).map((league) => (
            <div key={league} className="mb-3 last:mb-0">
              <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                {LEAGUE_NAME[league]}
              </h3>
              <ul>
                {teams
                  .data!.filter((t) => t.league === league)
                  .map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setParams({ squadra: String(t.id) })}
                        className={`w-full rounded-md px-2 py-1 text-left text-sm ${
                          t.id === selectedId ? 'bg-blue-100' : 'hover:bg-blue-50'
                        }`}
                      >
                        <TeamName team={t} bold={t.id === profile?.team_id} />
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <LeagueLegend />
        </Card>

        <Card
          title={<TeamName team={team} />}
          action={
            <span className="text-sm text-slate-500">
              {roster.length} giocatori · costo {total}
            </span>
          }
        >
          {ROLE_ORDER.map((role) => {
            const list = roster.filter((e) => e.player.role === role)
            return (
              <div key={role} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-sm font-semibold text-blue-900">
                  {ROLE_NAME[role]} ({list.length})
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.player_id} className="odd:bg-blue-50/40">
                        <td className="py-1 pl-2">{e.player.name}</td>
                        <td>
                          <MantraRoles roles={e.player.mantra_roles} />
                        </td>
                        <td className="text-slate-500">{e.player.serie_a_team}</td>
                        <td className="pr-2 text-right tabular-nums text-slate-600">{e.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
