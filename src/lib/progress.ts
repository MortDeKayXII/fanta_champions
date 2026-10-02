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
