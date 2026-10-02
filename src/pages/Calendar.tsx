import { useSearchParams } from 'react-router-dom'
import FixtureRow from '../components/FixtureRow'
import { Card, ErrorBox, LeagueLegend, Loading, PageTitle } from '../components/ui'
import { useAuth } from '../lib/auth'
import { matchdayTitle } from '../lib/labels'
import { findProgress, fixturesWithLineups } from '../lib/progress'
import { useCompetition, useLineups } from '../lib/queries'

export default function Calendar() {
  const { profile } = useAuth()
  const comp = useCompetition()
  const [params, setParams] = useSearchParams()

  // Matchdays that have fixtures (knockout ones appear once the admin generates them).
  const withFixtures = new Set(comp.fixtures.map((f) => f.matchday))
  const { last, next } = findProgress(comp.fixtures, comp.results)
  const requested = Number(params.get('g'))
  const selected = withFixtures.has(requested) ? requested : (next ?? last ?? 1)
  // Logged users can open the lineups as soon as both are entered, before the match is played.
  const lineups = useLineups(comp.isLoading ? undefined : selected)

  if (comp.isLoading) return <Loading />
  if (comp.error) return <ErrorBox>Impossibile caricare il calendario.</ErrorBox>

  const matchdays = comp.matchdays.filter((m) => withFixtures.has(m.number))
  const md = comp.matchdayByNumber.get(selected)
  const fixtures = comp.fixtures.filter((f) => f.matchday === selected)
  const ready = fixturesWithLineups(fixtures, lineups.data ?? [])

  return (
    <div>
      <PageTitle sub="Scegli una giornata. Formazioni e voti sono riservati agli utenti registrati.">
        Calendario
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Giornate">
        {matchdays.map((m) => (
          <button
            key={m.number}
            role="tab"
            aria-selected={m.number === selected}
            title={matchdayTitle(m)}
            onClick={() => setParams({ g: String(m.number) })}
            className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold ring-1 ${
              m.number === selected
                ? 'bg-blue-600 text-white ring-blue-600'
                : 'bg-white text-blue-800 ring-blue-200 hover:bg-blue-50'
            }`}
          >
            {m.number}
          </button>
        ))}
      </div>
      <Card title={md ? matchdayTitle(md) : `Giornata ${selected}`}>
        <div className="divide-y divide-blue-50">
          {fixtures.map((f) => (
            <FixtureRow
              key={f.id}
              fixture={f}
              result={comp.resultByFixture.get(f.id)}
              teamById={comp.teamById}
              myTeamId={profile?.team_id}
              lineupsReady={ready.has(f.id)}
            />
          ))}
        </div>
        <div className="mt-3">
          <LeagueLegend />
        </div>
      </Card>
    </div>
  )
}
