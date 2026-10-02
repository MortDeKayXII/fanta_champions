/**
 * Knockout stage for 30 teams: ranks 1-8 skip the playoff, 9-24 play it, 25-30 are out.
 * Rounds: playoff (8 ties) -> round of 16 (8) -> quarter-finals (4) -> semi-finals (2) -> final (1).
 * Every round except the final is two-legged.
 */

export type Round = 'playoff' | 'r16' | 'quarter' | 'semi' | 'final'

/** A side of a tie: a known team, or the winner of an earlier tie. */
export type Entrant = { team: string } | { winnerOf: string }

export interface Tie {
  id: string
  round: Round
  a: Entrant
  b: Entrant
}

export const LEGS: Record<Round, 1 | 2> = { playoff: 2, r16: 2, quarter: 2, semi: 2, final: 1 }

/** Playoff ties as [better rank, worse rank], 1-based. */
const PLAYOFF: ReadonlyArray<readonly [number, number]> = [
  [9, 24],
  [10, 23],
  [11, 22],
  [12, 21],
  [13, 20],
  [14, 19],
  [15, 18],
  [16, 17],
]

/** Seed (1-8) -> the playoff tie whose winner it meets in the round of 16. */
const R16_OPPONENT: Record<number, string> = {
  1: 'PO-16-17',
  8: 'PO-9-24',
  5: 'PO-12-21',
  4: 'PO-13-20',
  3: 'PO-14-19',
  6: 'PO-11-22',
  7: 'PO-10-23',
  2: 'PO-15-18',
}

/** `ranking` is the final group-stage order, best first (30 teams). */
export function buildBracket(ranking: readonly string[]): Tie[] {
  if (ranking.length !== 30) throw new Error(`Expected 30 teams, got ${ranking.length}`)
  const at = (rank: number) => ({ team: ranking[rank - 1] })
  const ties: Tie[] = []

  for (const [hi, lo] of PLAYOFF) {
    ties.push({ id: `PO-${hi}-${lo}`, round: 'playoff', a: at(hi), b: at(lo) })
  }
  for (const seed of [1, 8, 5, 4, 3, 6, 7, 2]) {
    ties.push({ id: `R16-${seed}`, round: 'r16', a: at(seed), b: { winnerOf: R16_OPPONENT[seed] } })
  }
  // Seeds 1 and 2 are kept in opposite halves of the bracket.
  const quarters: Array<[number, number]> = [
    [1, 8],
    [4, 5],
    [3, 6],
    [2, 7],
  ]
  quarters.forEach(([x, y], i) => {
    ties.push({
      id: `QF-${i + 1}`,
      round: 'quarter',
      a: { winnerOf: `R16-${x}` },
      b: { winnerOf: `R16-${y}` },
    })
  })
  ties.push({ id: 'SF-1', round: 'semi', a: { winnerOf: 'QF-1' }, b: { winnerOf: 'QF-2' } })
  ties.push({ id: 'SF-2', round: 'semi', a: { winnerOf: 'QF-3' }, b: { winnerOf: 'QF-4' } })
  ties.push({ id: 'F', round: 'final', a: { winnerOf: 'SF-1' }, b: { winnerOf: 'SF-2' } })
  return ties
}

/** One leg seen from the two sides of the tie (a, b), independent of who hosted. */
export interface LegResult {
  goalsA: number
  goalsB: number
  pointsA: number
  pointsB: number
}

export interface TieOutcome {
  winner: 'a' | 'b' | null
  /**
   * 'pending' = legs still missing; 'undecided' = level on goals and points, the admin must
   * pick; 'manual' = the admin's pick was applied.
   */
  decidedBy: 'goals' | 'points' | 'manual' | 'undecided' | 'pending'
}

/** Aggregate goals, then aggregate points, then the admin's manual choice. */
export function resolveTie(
  legs: readonly LegResult[],
  expectedLegs: 1 | 2,
  manualWinner?: 'a' | 'b',
): TieOutcome {
  if (legs.length < expectedLegs) return { winner: null, decidedBy: 'pending' }
  const sum = (f: (l: LegResult) => number) => legs.reduce((s, l) => s + f(l), 0)
  const goalsA = sum((l) => l.goalsA)
  const goalsB = sum((l) => l.goalsB)
  if (goalsA !== goalsB) return { winner: goalsA > goalsB ? 'a' : 'b', decidedBy: 'goals' }
  const pointsA = sum((l) => l.pointsA)
  const pointsB = sum((l) => l.pointsB)
  if (pointsA !== pointsB) return { winner: pointsA > pointsB ? 'a' : 'b', decidedBy: 'points' }
  if (manualWinner) return { winner: manualWinner, decidedBy: 'manual' }
  return { winner: null, decidedBy: 'undecided' }
}
