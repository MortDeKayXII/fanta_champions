import { Link, useParams } from 'react-router-dom'
import {
  Card,
  ErrorBox,
  Loading,
  MantraRoles,
  Notice,
  PageTitle,
  TeamLink,
  secondaryButtonClass,
} from '../components/ui'
import FormationPitch from '../components/FormationPitch'
import { formatPoints, matchdayTitle } from '../lib/labels'
import { STAT_ICONS } from '../lib/statIcons'
import { useCompetition, useLineups, usePlayers } from '../lib/queries'
import type { LineupRow, Player, Team } from '../lib/types'

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

export function LineupTable({
  rows,
  playerById,
}: {
  rows: LineupRow[]
  playerById: Map<number, Player>
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.slot} className="border-b border-blue-50 last:border-0">
            <td className={`py-1.5 pr-2 ${r.counted === false ? 'text-slate-400' : ''}`}>
              {r.player_name ?? <span className="italic text-slate-400">—</span>}
              {r.player_id !== null && playerById.get(r.player_id) && (
                <span className="ml-1.5">
                  <MantraRoles roles={playerById.get(r.player_id)!.mantra_roles} />
                </span>
              )}
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

/** Team name (opens the roster) with the lineup module in grey: a visible but secondary detail. */
export function TeamTitle({ team, module }: { team: Team | undefined; module?: string | null }) {
  return (
    <>
      <TeamLink team={team} />
      {module && (
        <span className="ml-1.5 text-sm font-normal text-slate-500" title="Modulo">
          ({module})
        </span>
      )}
    </>
  )
}

export default function Match() {
  const { fixtureId } = useParams()
  const comp = useCompetition()
  const fixture = comp.fixtureById.get(Number(fixtureId))
  const lineups = useLineups(fixture?.matchday)
  const players = usePlayers()

  if (comp.isLoading || lineups.isLoading || players.isLoading) return <Loading />
  if (!fixture) return <ErrorBox>Partita non trovata.</ErrorBox>

  const home = comp.teamById.get(fixture.home_team)
  const away = comp.teamById.get(fixture.away_team)
  const result = comp.resultByFixture.get(fixture.id)
  const md = comp.matchdayByNumber.get(fixture.matchday)
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]))
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
          <Card
            key={team?.id}
            title={<TeamTitle team={team} module={team ? rowsOf(team.id)[0]?.module : null} />}
          >
            {team && rowsOf(team.id).length > 0 ? (
              <LineupTable rows={rowsOf(team.id)} playerById={playerById} />
            ) : (
              <p className="text-sm text-slate-500">Formazione non ancora inserita.</p>
            )}
          </Card>
        ))}
      </div>
      <Card title="Formazioni in campo" className="mt-4">
        <FormationPitch
          home={{
            team: home,
            rows: rowsOf(fixture.home_team),
            points: result?.home_points,
          }}
          away={{
            team: away,
            rows: rowsOf(fixture.away_team),
            points: result?.away_points,
          }}
          playerById={playerById}
        />
        <p className="mt-2 text-xs text-slate-500">
          {home?.name} gioca a sinistra, {away?.name} a destra (su telefono: in alto e in basso).
          Ogni giocatore è nella posizione del modulo adatta ai suoi ruoli; un cerchio tratteggiato
          indica un giocatore fuori posizione.
        </p>
      </Card>
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
