import type { LineupSlot, MatchResult, PlayerScore, TeamScore, VoteRow } from './types'

/** Bonus/malus values from the conversion table. */
export const BONUS = {
  gf: 3,
  gs: -1,
  rp: 3,
  rs: -3,
  rf: 3,
  au: -2,
  amm: -0.5,
  esp: -1,
  ass: 1,
} as const

export const OUT_OF_POSITION_MALUS = -1

/** Vote + bonus/malus. Caller must ensure `row.vote` is not null. */
export function fantavoto(row: VoteRow & { vote: number }): number {
  return (
    row.vote +
    row.gf * BONUS.gf +
    row.gs * BONUS.gs +
    row.rp * BONUS.rp +
    row.rs * BONUS.rs +
    row.rf * BONUS.rf +
    row.au * BONUS.au +
    row.amm * BONUS.amm +
    row.esp * BONUS.esp +
    row.ass * BONUS.ass
  )
}

/** Below 66 points: 0 goals. From 66: one goal, plus one every further 4 points. */
export function goalsFromPoints(points: number): number {
  return points < 66 ? 0 : Math.floor((points - 66) / 4) + 1
}

export function scorePlayer(slot: LineupSlot, votes: ReadonlyMap<number, VoteRow>): PlayerScore {
  const row = slot.playerId === null ? undefined : votes.get(slot.playerId)
  if (!row || row.vote === null) {
    return { playerId: slot.playerId, vote: null, fantavoto: 0, counted: false }
  }
  const score =
    fantavoto({ ...row, vote: row.vote }) + (slot.outOfPosition ? OUT_OF_POSITION_MALUS : 0)
  return { playerId: slot.playerId, vote: row.vote, fantavoto: score, counted: true }
}

export function scoreLineup(
  lineup: readonly LineupSlot[],
  votes: ReadonlyMap<number, VoteRow>,
): TeamScore {
  const players = lineup.map((slot) => scorePlayer(slot, votes))
  const total = players.reduce((sum, p) => sum + p.fantavoto, 0)
  return { total, goals: goalsFromPoints(total), players }
}

export function playMatch(
  home: string,
  away: string,
  homeScore: TeamScore,
  awayScore: TeamScore,
): MatchResult {
  return {
    home,
    away,
    homeGoals: homeScore.goals,
    awayGoals: awayScore.goals,
    homePoints: homeScore.total,
    awayPoints: awayScore.total,
  }
}
