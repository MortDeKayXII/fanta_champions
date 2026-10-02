import { useState } from 'react'
import { Link } from 'react-router-dom'
import FixtureRow from '../components/FixtureRow'
import Standings from '../components/Standings'
import {
  Card,
  ErrorBox,
  LeagueLegend,
  Loading,
  Notice,
  TeamName,
  buttonClass,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatPoints, matchdayTitle } from '../lib/labels'
import { findProgress, fixturesWithLineups } from '../lib/progress'
import { useCompetition, useLineups, useStandings } from '../lib/queries'

export default function Home() {
  const { session, profile, passwordChanged } = useAuth()
  const [hideNudge, setHideNudge] = useState(
    () => localStorage.getItem('hide-password-nudge') === '1',
  )
  const comp = useCompetition()
  const { rows } = useStandings()
  const { last, next } = findProgress(comp.fixtures, comp.results)
  const nextLineups = useLineups(next)

  if (comp.isLoading) return <Loading />
  if (comp.error) return <ErrorBox>Impossibile caricare i dati. Riprova più tardi.</ErrorBox>

  const teamByName = new Map(comp.teams.map((t) => [t.name, t]))
  const myTeam = profile ? comp.teamById.get(profile.team_id) : undefined
  const myPos = myTeam ? rows.findIndex((r) => r.team === myTeam.name) : -1
  const myRow = myPos >= 0 ? rows[myPos] : undefined

  const matchdayCard = (number: number | undefined, title: string) => {
    if (number === undefined) return null
    const md = comp.matchdayByNumber.get(number)
    let fixtures = comp.fixtures.filter((f) => f.matchday === number)
    // Logged users see their own match first; the homepage shows a short list.
    if (profile)
      fixtures = fixtures.filter(
        (f) => f.home_team === profile.team_id || f.away_team === profile.team_id,
      )
    else fixtures = fixtures.slice(0, 5)
    return (
      <Card
        title={`${title} · ${md ? matchdayTitle(md) : number}`}
        action={
          <Link
            to={`/calendario?g=${number}`}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Tutta la giornata →
          </Link>
        }
      >
        {fixtures.map((f) => (
          <FixtureRow
            key={f.id}
            fixture={f}
            result={comp.resultByFixture.get(f.id)}
            teamById={comp.teamById}
            myTeamId={profile?.team_id}
            lineupsReady={
              number === next && fixturesWithLineups([f], nextLineups.data ?? []).has(f.id)
            }
          />
        ))}
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {session && !passwordChanged && !hideNudge && (
          <Notice>
            Stai usando la password iniziale uguale per tutti:{' '}
            <Link to="/profilo" className="font-semibold underline">
              cambiala dal tuo profilo
            </Link>
            .{' '}
            <button
              className="ml-2 text-xs underline"
              onClick={() => {
                localStorage.setItem('hide-password-nudge', '1')
                setHideNudge(true)
              }}
            >
              Nascondi
            </button>
          </Notice>
        )}
        {session && myTeam ? (
          <Card className="bg-gradient-to-br from-blue-700 to-blue-500 !text-white !ring-0">
            <p className="text-sm text-blue-100">Benvenuto</p>
            <h1 className="text-2xl font-bold">
              <TeamName team={myTeam} className="!text-white" />
            </h1>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ['Posizione', myPos >= 0 ? `${myPos + 1}°` : '-'],
                ['Punti', myRow?.points ?? 0],
                ['Partite', myRow?.played ?? 0],
                ['Tot. fanta', formatPoints(myRow?.totalPoints ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/15 p-2">
                  <dt className="text-xs text-blue-100">{label}</dt>
                  <dd className="text-xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-blue-700 to-blue-500 !text-white !ring-0">
            <h1 className="text-2xl font-bold">Fanta Champions</h1>
            <p className="mt-1 text-blue-50">
              30 squadre da tre leghe fantacalcio si sfidano: prima la fase a gironi, poi
              l&apos;eliminazione diretta.
            </p>
            <Link
              to="/accedi"
              className={`${buttonClass} mt-4 !bg-white !text-blue-800 hover:!bg-blue-50`}
            >
              Accedi con la tua squadra
            </Link>
          </Card>
        )}

        {matchdayCard(next, 'Prossima')}
        {matchdayCard(last, 'Ultima')}
        {last === undefined && next === undefined && <Card>Nessuna partita in calendario.</Card>}
      </div>

      <aside className="space-y-4">
        <Card title="Classifica">
          <Standings
            rows={rows}
            teamByName={teamByName}
            highlightTeamId={profile?.team_id}
            limit={10}
          />
        </Card>
        <Card title="Leghe">
          <LeagueLegend />
        </Card>
      </aside>
    </div>
  )
}
