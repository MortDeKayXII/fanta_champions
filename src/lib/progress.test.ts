import { describe, expect, it } from 'vitest'
import { findProgress } from './progress'
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
