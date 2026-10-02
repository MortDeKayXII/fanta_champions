import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { formatPoints } from '../lib/labels'
import type { Fixture, ResultRow, Team } from '../lib/types'
import { TeamLink } from './ui'

/**
 * One match: teams (each opens its roster for logged users), score or "vs", and the fantapoints.
 * For logged users the score opens the match detail (lineups and votes).
 */
export default function FixtureRow({
  fixture,
  result,
  teamById,
  myTeamId,
}: {
  fixture: Fixture
  result?: ResultRow
  teamById: Map<number, Team>
  myTeamId?: number
}) {
  const { session } = useAuth()
  const home = teamById.get(fixture.home_team)
  const away = teamById.get(fixture.away_team)
  const mine =
    myTeamId !== undefined && (fixture.home_team === myTeamId || fixture.away_team === myTeamId)

  const score = result && (
    <>
      <div className="font-bold text-blue-900">
        {result.home_goals} - {result.away_goals}
      </div>
      <div className="text-xs text-slate-500">
        {formatPoints(result.home_points)} · {formatPoints(result.away_points)}
      </div>
    </>
  )

  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-2 py-2 text-sm ${
        mine ? 'bg-blue-100' : ''
      }`}
    >
      <div className="text-right">
        <TeamLink team={home} bold={fixture.home_team === myTeamId} />
      </div>
      <div className="min-w-16 text-center">
        {!result ? (
          <span className="text-slate-400">vs</span>
        ) : session ? (
          <Link
            to={`/partita/${fixture.id}`}
            className="block rounded px-1 hover:bg-blue-100"
            title="Vedi formazioni e voti"
          >
            {score}
          </Link>
        ) : (
          score
        )}
      </div>
      <div>
        <TeamLink team={away} bold={fixture.away_team === myTeamId} />
      </div>
    </div>
  )
}
