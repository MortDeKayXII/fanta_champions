import type { MatchResult, StandingRow } from './types'

/**
 * League table: league points (3/1/0), then total fantapoints (as in the old sheet),
 * then goal difference, goals for and name so the order is always deterministic.
 */
export function computeStandings(
  teams: readonly string[],
  results: readonly MatchResult[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((team) => [
      team,
      {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        totalPoints: 0,
      },
    ]),
  )

  const apply = (team: string, gf: number, ga: number, fantapoints: number) => {
    const row = rows.get(team)
    if (!row) throw new Error(`Unknown team in results: ${team}`)
    row.played++
    row.goalsFor += gf
    row.goalsAgainst += ga
    row.totalPoints += fantapoints
    if (gf > ga) {
      row.won++
      row.points += 3
    } else if (gf === ga) {
      row.drawn++
      row.points += 1
    } else {
      row.lost++
    }
  }

  for (const r of results) {
    apply(r.home, r.homeGoals, r.awayGoals, r.homePoints)
    apply(r.away, r.awayGoals, r.homeGoals, r.awayPoints)
  }

  for (const row of rows.values()) row.goalDiff = row.goalsFor - row.goalsAgainst

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.totalPoints - a.totalPoints ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team),
  )
}
