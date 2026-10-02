export type League = 'A' | 'B' | 'C'
export type Role = 'P' | 'D' | 'C' | 'A'
export type Phase = 'group' | 'playoff' | 'r16' | 'quarter' | 'semi' | 'final'

export interface Team {
  id: number
  name: string
  slug: string
  league: League
}

export interface Player {
  id: number
  name: string
  role: Role
  mantra_roles: string
  serie_a_team: string
}

export interface Matchday {
  number: number
  phase: Phase
  leg: 1 | 2
}

export interface Fixture {
  id: number
  matchday: number
  home_team: number
  away_team: number
  tie_id: string | null
}

export interface ResultRow {
  fixture_id: number
  home_goals: number
  away_goals: number
  home_points: number
  away_points: number
}

export interface RosterEntry {
  team_id: number
  player_id: number
  cost: number
}

export interface RosterHistoryRow {
  id: number
  team_id: number
  player_id: number
  action: 'add' | 'remove' | 'cost'
  cost: number | null
  changed_at: string
}

export interface LineupRow {
  matchday: number
  team_id: number
  slot: number
  player_id: number | null
  player_name: string | null
  out_of_position: boolean
  /** Module of the team's lineup, e.g. "4-3-1-2" (same on the 11 slots; optional). */
  module?: string | null
  vote: number | null
  fantavoto: number | null
  counted: boolean | null
  stats: Partial<
    Record<'gf' | 'gs' | 'rp' | 'rs' | 'rf' | 'au' | 'amm' | 'esp' | 'ass', number>
  > | null
}

export type ReportStatus = 'open' | 'resolved' | 'rejected'

export interface ErrorReport {
  id: number
  team_id: number
  matchday: number | null
  fixture_id: number | null
  player_id: number | null
  message: string
  status: ReportStatus
  admin_note: string | null
  created_at: string
}

export interface Profile {
  user_id: string
  team_id: number
  is_admin: boolean
}
