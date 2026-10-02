import { Link, useParams } from 'react-router-dom'
import {
  Card,
  ErrorBox,
  Loading,
  Notice,
  PageTitle,
  TeamLink,
  secondaryButtonClass,
} from '../components/ui'
import { formatPoints, matchdayTitle } from '../lib/labels'
import { useCompetition, useLineups } from '../lib/queries'
import type { LineupRow } from '../lib/types'

const STAT_ICONS: Array<[keyof NonNullable<LineupRow['stats']>, string, string]> = [
  ['gf', '⚽', 'Gol'],
  ['ass', '🅰️', 'Assist'],
  ['rp', '🧤', 'Rigore parato'],
  ['rf', '🎯', 'Rigore segnato'],
  ['gs', '🥅', 'Gol subito'],
  ['rs', '❌', 'Rigore sbagliato'],
  ['au', '↩️', 'Autogol'],
  ['amm', '🟨', 'Ammonizione'],
  ['esp', '🟥', 'Espulsione'],
]

function Stats({ row }: { row: LineupRow }) {
  if (!row.stats) return null
  return (
    <span className="ml-1 whitespace-nowrap text-xs">
      {STAT_ICONS.filter(([k]) => (row.stats?.[k] ?? 0) > 0).map(([k, icon, label]) => (
        <span key={k} title={label}>
          {icon}
          {(row.stats?.[k] ?? 0) > 1 ? `×${row.stats?.[k]}` : ''}
        </span>
      ))}
    </span>
  )
}

function LineupTable({ rows }: { rows: LineupRow[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.slot} className="border-b border-blue-50 last:border-0">
            <td className={`py-1.5 pr-2 ${r.counted === false ? 'text-slate-400' : ''}`}>
              {r.player_name ?? <span className="italic text-slate-400">—</span>}
              {r.out_of_position && (
                <span className="ml-1 text-xs text-amber-700" title="Fuori ruolo (−1)">
                  (fuori ruolo)
                </span>
              )}
              <Stats row={r} />
            </td>
            <td className="w-10 text-right text-slate-500">
              {r.vote !== null ? formatPoints(r.vote) : r.counted === false ? 's.v.' : ''}
            </td>
            <td className="w-14 text-right font-semibold text-blue-900">
              {r.fantavoto === null ? '' : formatPoints(r.fantavoto)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Match() {
  const { fixtureId } = useParams()
  const comp = useCompetition()
  const fixture = comp.fixtureById.get(Number(fixtureId))
  const lineups = useLineups(fixture?.matchday)

  if (comp.isLoading || lineups.isLoading) return <Loading />
  if (!fixture) return <ErrorBox>Partita non trovata.</ErrorBox>

  const home = comp.teamById.get(fixture.home_team)
  const away = comp.teamById.get(fixture.away_team)
  const result = comp.resultByFixture.get(fixture.id)
  const md = comp.matchdayByNumber.get(fixture.matchday)
  const rowsOf = (teamId: number) => (lineups.data ?? []).filter((l) => l.team_id === teamId)

  return (
    <div>
      <PageTitle sub={md ? matchdayTitle(md) : undefined}>
        <TeamLink team={home} /> vs <TeamLink team={away} />
      </PageTitle>
      {result ? (
        <Card className="mb-4 text-center">
          <p className="text-4xl font-extrabold text-blue-900">
            {result.home_goals} - {result.away_goals}
          </p>
          <p className="text-sm text-slate-500">
            {formatPoints(result.home_points)} · {formatPoints(result.away_points)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Da 66 punti un gol, poi uno ogni 4 punti in più.
          </p>
        </Card>
      ) : (
        <Notice>
          Questa partita non è ancora stata giocata: queste sono le formazioni schierate finora,
          voti e punteggi arriveranno dopo il calcolo.
        </Notice>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {[home, away].map((team) => (
          <Card key={team?.id} title={<TeamLink team={team} />}>
            {team && rowsOf(team.id).length > 0 ? (
              <LineupTable rows={rowsOf(team.id)} />
            ) : (
              <p className="text-sm text-slate-500">Formazione non ancora inserita.</p>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Link to={`/segnala?partita=${fixture.id}`} className={secondaryButtonClass}>
          Segnala un errore in questa partita
        </Link>
        <Link to={`/calendario?g=${fixture.matchday}`} className={secondaryButtonClass}>
          ← Torna al calendario
        </Link>
      </div>
    </div>
  )
}
