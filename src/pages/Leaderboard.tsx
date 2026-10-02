import Standings from '../components/Standings'
import { Card, LeagueLegend, Loading, Notice, PageTitle } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useCompetition, useStandings } from '../lib/queries'

export default function Leaderboard() {
  const { profile } = useAuth()
  const { teams } = useCompetition()
  const { rows, isLoading } = useStandings()
  if (isLoading) return <Loading />
  const teamByName = new Map(teams.map((t) => [t.name, t]))

  return (
    <div>
      <PageTitle sub="Punti (3 vittoria, 1 pareggio); a parità conta il totale dei punti fanta.">
        Classifica
      </PageTitle>
      <Card>
        {rows.every((r) => r.played === 0) && (
          <div className="mb-3">
            <Notice>
              Nessuna giornata è ancora stata giocata: l'ordine è provvisorio (alfabetico).
            </Notice>
          </div>
        )}
        <Standings rows={rows} teamByName={teamByName} highlightTeamId={profile?.team_id} full />
        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <p>
            <span className="mr-1 inline-block h-3 w-1.5 bg-blue-600 align-middle" /> 1°–8°:
            direttamente agli ottavi ·{' '}
            <span className="mx-1 inline-block h-3 w-1.5 bg-sky-300 align-middle" /> 9°–24°: playoff
            · <span className="mx-1 inline-block h-3 w-1.5 bg-slate-300 align-middle" /> 25°–30°:
            eliminate
          </p>
          <LeagueLegend />
        </div>
      </Card>
    </div>
  )
}
