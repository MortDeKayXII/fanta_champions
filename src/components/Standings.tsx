import { Link } from 'react-router-dom'
import type { StandingRow } from '../engine'
import { formatPoints } from '../lib/labels'
import { zoneColor } from '../lib/zones'
import type { Team } from '../lib/types'
import { TeamLink } from './ui'

/** Group-stage table. Ranks 1-8 go straight to the knockout, 9-24 to the playoff, 25+ are out. */
export default function Standings({
  rows,
  teamByName,
  highlightTeamId,
  limit,
  full = false,
}: {
  rows: StandingRow[]
  teamByName: Map<string, Team>
  highlightTeamId?: number
  limit?: number
  full?: boolean
}) {
  const shown = limit ? rows.slice(0, limit) : rows

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-1 pl-2 pr-1">#</th>
            <th className="py-1 pr-2">Squadra</th>
            {full && (
              <>
                <th className="px-1 text-center" title="Giocate">
                  G
                </th>
                <th className="px-1 text-center" title="Vinte">
                  V
                </th>
                <th className="px-1 text-center" title="Pareggiate">
                  N
                </th>
                <th className="px-1 text-center" title="Perse">
                  P
                </th>
                <th className="px-1 text-center" title="Gol fatti">
                  GF
                </th>
                <th className="px-1 text-center" title="Gol subiti">
                  GS
                </th>
                <th className="px-1 text-center" title="Differenza reti">
                  DR
                </th>
              </>
            )}
            <th className="px-1 text-center" title="Punti classifica">
              Pt
            </th>
            <th className="px-1 text-right" title="Punti totali fanta">
              Tot
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => {
            const team = teamByName.get(row.team)
            const mine = team?.id === highlightTeamId
            return (
              <tr
                key={row.team}
                style={{ borderLeftColor: zoneColor(i + 1) }}
                className={`border-l-4 ${mine ? 'bg-blue-100' : 'odd:bg-blue-50/40'}`}
              >
                <td className="py-1.5 pl-2 pr-1 text-slate-500">{i + 1}</td>
                <td className="pr-2">
                  <TeamLink team={team} bold={mine} />
                </td>
                {full && (
                  <>
                    <td className="px-1 text-center">{row.played}</td>
                    <td className="px-1 text-center">{row.won}</td>
                    <td className="px-1 text-center">{row.drawn}</td>
                    <td className="px-1 text-center">{row.lost}</td>
                    <td className="px-1 text-center">{row.goalsFor}</td>
                    <td className="px-1 text-center">{row.goalsAgainst}</td>
                    <td className="px-1 text-center">{row.goalDiff}</td>
                  </>
                )}
                <td className="px-1 text-center font-bold text-blue-900">{row.points}</td>
                <td className="px-1 text-right tabular-nums text-slate-600">
                  {formatPoints(row.totalPoints)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <p className="mt-2 text-right text-sm">
          <Link to="/classifica" className="font-medium text-blue-700 hover:underline">
            Vai alla classifica completa →
          </Link>
        </p>
      )}
    </div>
  )
}
