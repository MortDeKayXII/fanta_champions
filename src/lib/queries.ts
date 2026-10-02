import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { computeStandings, type MatchResult, type StandingRow } from '../engine'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type {
  ErrorReport,
  Fixture,
  LineupRow,
  Matchday,
  Player,
  ResultRow,
  RosterEntry,
  RosterHistoryRow,
  Team,
} from './types'

async function fetchTable<T>(table: string, order?: string): Promise<T[]> {
  let q = supabase.from(table).select('*')
  if (order) q = q.order(order)
  const { data, error } = await q
  if (error) throw error
  return data as T[]
}

const STATIC = { staleTime: 5 * 60_000 }

export const useTeams = () =>
  useQuery({ queryKey: ['teams'], queryFn: () => fetchTable<Team>('teams', 'id'), ...STATIC })
export const usePlayers = () =>
  useQuery({ queryKey: ['players'], queryFn: () => fetchTable<Player>('players', 'id'), ...STATIC })
export const useMatchdays = () =>
  useQuery({
    queryKey: ['matchdays'],
    queryFn: () => fetchTable<Matchday>('matchdays', 'number'),
    ...STATIC,
  })
export const useFixtures = () =>
  useQuery({ queryKey: ['fixtures'], queryFn: () => fetchTable<Fixture>('fixtures', 'id') })
export const useResults = () =>
  useQuery({ queryKey: ['results'], queryFn: () => fetchTable<ResultRow>('results') })
export const useRosterEntries = () =>
  useQuery({
    queryKey: ['roster_entries'],
    queryFn: () => fetchTable<RosterEntry>('roster_entries'),
  })

export function useLineups(matchday: number | undefined) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['lineups', matchday],
    enabled: Boolean(session) && matchday !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lineups')
        .select('*')
        .eq('matchday', matchday!)
        .order('slot')
      if (error) throw error
      return data as LineupRow[]
    },
  })
}

export function useRosterHistory(teamId: number | undefined) {
  return useQuery({
    queryKey: ['roster_history', teamId],
    enabled: teamId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roster_history')
        .select('*')
        .eq('team_id', teamId!)
        .order('changed_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as RosterHistoryRow[]
    },
  })
}

export function useMyReports() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['error_reports'],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ErrorReport[]
    },
  })
}

/** Everything the competition pages need, with lookups by id. */
export function useCompetition() {
  const teams = useTeams()
  const matchdays = useMatchdays()
  const fixtures = useFixtures()
  const results = useResults()

  const value = useMemo(() => {
    const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
    const resultByFixture = new Map((results.data ?? []).map((r) => [r.fixture_id, r]))
    const fixtureById = new Map((fixtures.data ?? []).map((f) => [f.id, f]))
    const matchdayByNumber = new Map((matchdays.data ?? []).map((m) => [m.number, m]))
    return { teamById, resultByFixture, fixtureById, matchdayByNumber }
  }, [teams.data, results.data, fixtures.data, matchdays.data])

  return {
    teams: teams.data ?? [],
    matchdays: matchdays.data ?? [],
    fixtures: fixtures.data ?? [],
    results: results.data ?? [],
    ...value,
    isLoading: teams.isLoading || matchdays.isLoading || fixtures.isLoading || results.isLoading,
    error: teams.error ?? matchdays.error ?? fixtures.error ?? results.error,
  }
}

/** Group-stage table, computed from the stored results. */
export function useStandings(): { rows: StandingRow[]; isLoading: boolean } {
  const { teams, fixtures, results, teamById, matchdayByNumber, isLoading } = useCompetition()
  const rows = useMemo(() => {
    if (teams.length === 0) return []
    const fixtureById = new Map(fixtures.map((f) => [f.id, f]))
    const matches: MatchResult[] = []
    for (const r of results) {
      const f = fixtureById.get(r.fixture_id)
      if (!f || matchdayByNumber.get(f.matchday)?.phase !== 'group') continue
      matches.push({
        home: teamById.get(f.home_team)!.name,
        away: teamById.get(f.away_team)!.name,
        homeGoals: r.home_goals,
        awayGoals: r.away_goals,
        homePoints: r.home_points,
        awayPoints: r.away_points,
      })
    }
    return computeStandings(
      teams.map((t) => t.name),
      matches,
    )
  }, [teams, fixtures, results, teamById, matchdayByNumber])
  return { rows, isLoading }
}
