import type { Fixture, ResultRow } from './types'

/**
 * Last matchday with at least one result, and the first matchday that still has a fixture
 * without a result (the "next" one). Either can be undefined.
 */
export function findProgress(fixtures: readonly Fixture[], results: readonly ResultRow[]) {
  const played = new Set(results.map((r) => r.fixture_id))
  let last: number | undefined
  let next: number | undefined
  for (const f of fixtures) {
    if (played.has(f.id)) {
      if (last === undefined || f.matchday > last) last = f.matchday
    } else if (next === undefined || f.matchday < next) {
      next = f.matchday
    }
  }
  return { last, next }
}

/** Fixtures whose two teams both have a lineup entered. */
export function fixturesWithLineups(
  fixtures: readonly Fixture[],
  lineups: ReadonlyArray<{ team_id: number }>,
): Set<number> {
  const teams = new Set(lineups.map((l) => l.team_id))
  return new Set(
    fixtures.filter((f) => teams.has(f.home_team) && teams.has(f.away_team)).map((f) => f.id),
  )
}
