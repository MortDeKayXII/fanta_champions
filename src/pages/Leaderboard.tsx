import Standings from '../components/Standings'
import { Card, LeagueLegend, Loading, Notice, PageTitle } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useCompetition, useStandings } from '../lib/queries'
import { PLAYOFF_FROM, PLAYOFF_TO, ZONE_GREEN, ZONE_RED } from '../lib/zones'

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
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1.5" style={{ backgroundColor: ZONE_GREEN }} />
              1°–8°: direttamente agli ottavi
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-1.5"
                style={{
                  backgroundImage: `linear-gradient(to bottom, ${PLAYOFF_FROM}, ${PLAYOFF_TO})`,
                }}
              />
              9°–24°: playoff (più scuro = più vicino agli ottavi)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1.5" style={{ backgroundColor: ZONE_RED }} />
              25°–30°: eliminate
            </span>
          </p>
          <LeagueLegend />
        </div>
      </Card>
    </div>
  )
}
