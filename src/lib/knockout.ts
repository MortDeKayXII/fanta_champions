import {
  LEGS,
  buildBracket,
  resolveTie,
  type Entrant,
  type Round,
  type TieOutcome,
} from '../engine'
import type { Fixture, Matchday, ResultRow } from './types'

export const ROUND_ORDER: Round[] = ['playoff', 'r16', 'quarter', 'semi', 'final']

export const ROUND_NAME: Record<Round, string> = {
  playoff: 'Playoff',
  r16: 'Ottavi di finale',
  quarter: 'Quarti di finale',
  semi: 'Semifinali',
  final: 'Finale',
}

/** One leg of a tie, seen from the two sides of the tie (A = first team of the tie). */
export interface LegView {
  fixtureId: number
  matchday: number
  played: boolean
  goalsA: number
  goalsB: number
  pointsA: number
  pointsB: number
}

export interface TieView {
  id: string
  round: Round
  /** Team ids; null while they depend on an earlier tie that is not decided yet. */
  a: number | null
  b: number | null
  /** Tie whose winner will fill the side (when the team is still unknown). */
  aFrom?: string
  bFrom?: string
  legs: LegView[]
  aggregate: { goalsA: number; goalsB: number; pointsA: number; pointsB: number }
  outcome: TieOutcome
  winner: number | null
  /** true once the fixtures of this tie exist in the database (pairings are then frozen). */
  generated: boolean
}

export interface KnockoutInput {
  /** Group-stage order, best first, as team names (30 teams). */
  ranking: readonly string[]
  teamIdByName: ReadonlyMap<string, number>
  fixtures: readonly Fixture[]
  results: readonly ResultRow[]
  decisions: ReadonlyArray<{ tie_id: string; winner_team: number }>
}

/**
 * Builds the state of every tie. Before a round is generated the pairings are projected from the
 * ranking / earlier winners; once its fixtures exist they are the source of truth, so later
 * changes to the group table cannot move teams around.
 */
export function resolveKnockout({
  ranking,
  teamIdByName,
  fixtures,
  results,
  decisions,
}: KnockoutInput): TieView[] {
  const bracket = buildBracket(ranking)
  const resultByFixture = new Map(results.map((r) => [r.fixture_id, r]))
  const fixturesByTie = new Map<string, Fixture[]>()
  for (const f of fixtures) {
    if (f.tie_id) fixturesByTie.set(f.tie_id, [...(fixturesByTie.get(f.tie_id) ?? []), f])
  }
  const winners = new Map<string, number>()

  return bracket.map((tie) => {
    const fx = [...(fixturesByTie.get(tie.id) ?? [])].sort((x, y) => x.matchday - y.matchday)
    const side = (e: Entrant): number | null =>
      'team' in e ? (teamIdByName.get(e.team) ?? null) : (winners.get(e.winnerOf) ?? null)
    let a = side(tie.a)
    let b = side(tie.b)
    if (fx.length > 0) {
      a = fx[0].home_team
      b = fx[0].away_team
    }

    const legs: LegView[] = fx.map((f) => {
      const r = resultByFixture.get(f.id)
      const homeIsA = f.home_team === a
      return {
        fixtureId: f.id,
        matchday: f.matchday,
        played: Boolean(r),
        goalsA: r ? (homeIsA ? r.home_goals : r.away_goals) : 0,
        goalsB: r ? (homeIsA ? r.away_goals : r.home_goals) : 0,
        pointsA: r ? (homeIsA ? r.home_points : r.away_points) : 0,
        pointsB: r ? (homeIsA ? r.away_points : r.home_points) : 0,
      }
    })
    const played = legs.filter((l) => l.played)
    const aggregate = played.reduce(
      (s, l) => ({
        goalsA: s.goalsA + l.goalsA,
        goalsB: s.goalsB + l.goalsB,
        pointsA: s.pointsA + l.pointsA,
        pointsB: s.pointsB + l.pointsB,
      }),
      { goalsA: 0, goalsB: 0, pointsA: 0, pointsB: 0 },
    )

    const decision = decisions.find((d) => d.tie_id === tie.id)
    const manual =
      decision && a !== null && b !== null
        ? decision.winner_team === a
          ? 'a'
          : decision.winner_team === b
            ? 'b'
            : undefined
        : undefined
    const outcome =
      a === null || b === null
        ? ({ winner: null, decidedBy: 'pending' } as const)
        : resolveTie(played, LEGS[tie.round], manual)
    const winner = outcome.winner === 'a' ? a : outcome.winner === 'b' ? b : null
    if (winner !== null) winners.set(tie.id, winner)

    return {
      id: tie.id,
      round: tie.round,
      a,
      b,
      aFrom: 'winnerOf' in tie.a ? tie.a.winnerOf : undefined,
      bFrom: 'winnerOf' in tie.b ? tie.b.winnerOf : undefined,
      legs,
      aggregate,
      outcome,
      winner,
      generated: fx.length > 0,
    }
  })
}

/**
 * The next round the admin can create: the first round whose fixtures do not exist yet.
 * `ready` is false while a side still waits for an earlier tie to be decided.
 */
export function nextRound(views: readonly TieView[]): { round: Round; ready: boolean } | null {
  for (const round of ROUND_ORDER) {
    const ties = views.filter((t) => t.round === round)
    if (ties.some((t) => !t.generated)) {
      return { round, ready: ties.every((t) => t.a !== null && t.b !== null) }
    }
  }
  return null
}

export interface NewFixture {
  matchday: number
  home_team: number
  away_team: number
  tie_id: string
}

/** Fixtures of one round: leg 1 hosted by side A, leg 2 (if any) by side B. */
export function fixturesForRound(
  views: readonly TieView[],
  round: Round,
  matchdays: readonly Matchday[],
): NewFixture[] {
  const matchdayFor = (leg: 1 | 2) => {
    const m = matchdays.find((x) => x.phase === round && x.leg === leg)
    if (!m) throw new Error(`Nessuna giornata definita per ${ROUND_NAME[round]} (gara ${leg})`)
    return m.number
  }
  return views
    .filter((t) => t.round === round)
    .flatMap((t) => {
      if (t.a === null || t.b === null) throw new Error(`Il turno ${t.id} non è ancora definito`)
      const out: NewFixture[] = [
        { matchday: matchdayFor(1), home_team: t.a, away_team: t.b, tie_id: t.id },
      ]
      if (LEGS[round] === 2) {
        out.push({ matchday: matchdayFor(2), home_team: t.b, away_team: t.a, tie_id: t.id })
      }
      return out
    })
}

/** Human label for a side that is not known yet, e.g. "Vincente 9°–24°". */
export function pendingLabel(tieId: string | undefined): string {
  if (!tieId) return 'Da definire'
  const po = /^PO-(\d+)-(\d+)$/.exec(tieId)
  if (po) return `Vincente playoff ${po[1]}°–${po[2]}°`
  const r16 = /^R16-(\d+)$/.exec(tieId)
  if (r16) return `Vincente ottavi (testa di serie ${r16[1]})`
  const qf = /^QF-(\d+)$/.exec(tieId)
  if (qf) return `Vincente quarto ${qf[1]}`
  const sf = /^SF-(\d+)$/.exec(tieId)
  if (sf) return `Vincente semifinale ${sf[1]}`
  return 'Da definire'
}

/** Short version of {@link pendingLabel} for the bracket drawing, e.g. "V. 9°–24°". */
export function pendingShort(tieId: string | undefined): string {
  if (!tieId) return 'Da definire'
  const po = /^PO-(\d+)-(\d+)$/.exec(tieId)
  if (po) return `V. ${po[1]}°–${po[2]}°`
  const r16 = /^R16-(\d+)$/.exec(tieId)
  if (r16) return `V. ottavi ${r16[1]}ª TdS`
  const qf = /^QF-(\d+)$/.exec(tieId)
  if (qf) return `V. quarto ${qf[1]}`
  const sf = /^SF-(\d+)$/.exec(tieId)
  if (sf) return `V. semifinale ${sf[1]}`
  return 'Da definire'
}

/** True when every group fixture has a result. */
export function groupStageComplete(
  fixtures: readonly Fixture[],
  results: readonly ResultRow[],
  matchdays: readonly Matchday[],
): boolean {
  const group = new Set(matchdays.filter((m) => m.phase === 'group').map((m) => m.number))
  const played = new Set(results.map((r) => r.fixture_id))
  const groupFixtures = fixtures.filter((f) => group.has(f.matchday))
  return groupFixtures.length > 0 && groupFixtures.every((f) => played.has(f.id))
}
