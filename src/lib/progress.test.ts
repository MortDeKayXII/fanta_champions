import { describe, expect, it } from 'vitest'
import { findProgress, fixturesWithLineups } from './progress'
import type { Fixture, ResultRow } from './types'

const fx = (id: number, matchday: number): Fixture => ({
  id,
  matchday,
  home_team: 1,
  away_team: 2,
  tie_id: null,
})
const res = (fixture_id: number): ResultRow => ({
  fixture_id,
  home_goals: 0,
  away_goals: 0,
  home_points: 0,
  away_points: 0,
})

describe('findProgress', () => {
  it('before any result, next is the first matchday', () => {
    expect(findProgress([fx(1, 1), fx(2, 2)], [])).toEqual({ last: undefined, next: 1 })
  })

  it('tracks the last played and the first unplayed matchday', () => {
    const fixtures = [fx(1, 1), fx(2, 1), fx(3, 2), fx(4, 2), fx(5, 3)]
    expect(findProgress(fixtures, [res(1), res(2), res(3)])).toEqual({ last: 2, next: 2 })
    expect(findProgress(fixtures, [res(1), res(2), res(3), res(4)])).toEqual({ last: 2, next: 3 })
  })

  it('has no next matchday when everything is played', () => {
    expect(findProgress([fx(1, 1)], [res(1)])).toEqual({ last: 1, next: undefined })
  })
})

describe('fixturesWithLineups', () => {
  const f = (id: number, home_team: number, away_team: number): Fixture => ({
    id,
    matchday: 1,
    home_team,
    away_team,
    tie_id: null,
  })

  it('includes only fixtures where both teams have a lineup', () => {
    const fixtures = [f(1, 1, 2), f(2, 3, 4), f(3, 5, 6)]
    const lineups = [1, 2, 3, 5].flatMap((team_id) => [{ team_id }, { team_id }])
    expect([...fixturesWithLineups(fixtures, lineups)]).toEqual([1])
  })

  it('is empty when no lineups are entered', () => {
    expect(fixturesWithLineups([f(1, 1, 2)], []).size).toBe(0)
  })
})
