import { playMatch, scoreLineup, type LineupSlot, type VoteRow } from '../engine'
import type { Fixture, LineupRow, ResultRow } from './types'

export interface ComputeInput {
  fixtures: readonly Fixture[]
  /** Lineup rows of this matchday (all teams). */
  lineups: readonly LineupRow[]
  /** Votes stored for this matchday. */
  votes: readonly VoteRow[]
  teamName: (teamId: number) => string
}

export interface ComputeOutput {
  results: ResultRow[]
  /** Every lineup row of the computed teams, with vote / fantavoto / counted / stats filled in. */
  lineups: LineupRow[]
  warnings: string[]
}

const STAT_KEYS = ['gf', 'gs', 'rp', 'rs', 'rf', 'au', 'amm', 'esp', 'ass'] as const

/**
 * Computes every fixture of one matchday from the stored lineups and votes.
 * Fixtures where a team has no lineup are skipped (and reported), never computed as 0-0.
 * Pure: the caller writes the output to the database, so it can be re-run at any time.
 */
export function computeMatchday({
  fixtures,
  lineups,
  votes,
  teamName,
}: ComputeInput): ComputeOutput {
  const voteById = new Map(votes.map((v) => [v.playerId, v]))
  const slotsByTeam = new Map<number, LineupRow[]>()
  for (const l of lineups) slotsByTeam.set(l.team_id, [...(slotsByTeam.get(l.team_id) ?? []), l])

  const results: ResultRow[] = []
  const outLineups: LineupRow[] = []
  const warnings: string[] = []
  const scored = new Set<number>()

  const score = (teamId: number) => {
    const rows = [...(slotsByTeam.get(teamId) ?? [])].sort((a, b) => a.slot - b.slot)
    const slots: LineupSlot[] = rows.map((r) => ({
      playerId: r.player_id,
      outOfPosition: r.out_of_position,
    }))
    const team = scoreLineup(slots, voteById)

    if (!scored.has(teamId)) {
      scored.add(teamId)
      rows.forEach((r, i) => {
        const p = team.players[i]
        const vote = p.playerId === null ? undefined : voteById.get(p.playerId)
        const stats = vote
          ? Object.fromEntries(STAT_KEYS.filter((k) => vote[k] > 0).map((k) => [k, vote[k]]))
          : null
        outLineups.push({
          ...r,
          vote: p.vote,
          fantavoto: p.counted ? p.fantavoto : null,
          counted: p.counted,
          stats,
        })
        if (r.player_id !== null && !p.counted) {
          warnings.push(
            vote
              ? `${teamName(teamId)}: ${r.player_name} è senza voto (s.v.), vale 0.`
              : `${teamName(teamId)}: ${r.player_name} non è nel file dei voti, vale 0.`,
          )
        }
      })
      const filled = rows.filter((r) => r.player_id !== null).length
      if (filled < 11)
        warnings.push(`${teamName(teamId)}: formazione con ${filled} giocatori su 11.`)
    }
    return team
  }

  for (const f of fixtures) {
    const missing = [f.home_team, f.away_team].filter((t) => !slotsByTeam.has(t))
    if (missing.length > 0) {
      warnings.push(
        `Partita saltata (${teamName(f.home_team)} - ${teamName(f.away_team)}): manca la formazione di ${missing.map(teamName).join(' e ')}.`,
      )
      continue
    }
    const home = score(f.home_team)
    const away = score(f.away_team)
    const m = playMatch(teamName(f.home_team), teamName(f.away_team), home, away)
    results.push({
      fixture_id: f.id,
      home_goals: m.homeGoals,
      away_goals: m.awayGoals,
      home_points: m.homePoints,
      away_points: m.awayPoints,
    })
  }

  return { results, lineups: outLineups, warnings }
}
