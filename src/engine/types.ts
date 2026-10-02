/** One row of the Fantacalcio votes file (coaches excluded). `vote` is null for "s.v." (no vote). */
export interface VoteRow {
  playerId: number
  vote: number | null
  gf: number // goals scored
  gs: number // goals conceded
  rp: number // penalties saved
  rs: number // penalties missed
  rf: number // penalties scored
  au: number // own goals
  amm: number // yellow cards
  esp: number // red cards
  ass: number // assists
}

/** A lineup slot. `playerId` null = hole left by the admin. */
export interface LineupSlot {
  playerId: number | null
  /** Out-of-position malus (-1), decided by the admin. */
  outOfPosition: boolean
}

export interface PlayerScore {
  playerId: number | null
  vote: number | null
  fantavoto: number
  /** false when the slot is empty or the player has no vote: contributes 0. */
  counted: boolean
}

export interface TeamScore {
  total: number
  goals: number
  players: PlayerScore[]
}

/** Result of one match between two teams. */
export interface MatchResult {
  home: string
  away: string
  homeGoals: number
  awayGoals: number
  homePoints: number
  awayPoints: number
}

export interface StandingRow {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  /** League points: 3 per win, 1 per draw. */
  points: number
  /** Sum of all fantapoints scored. */
  totalPoints: number
}
