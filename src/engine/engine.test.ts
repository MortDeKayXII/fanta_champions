import { describe, expect, it } from 'vitest'
import {
  LEGS,
  buildBracket,
  computeStandings,
  fantavoto,
  goalsFromPoints,
  playMatch,
  resolveTie,
  scoreLineup,
  type LineupSlot,
  type VoteRow,
} from './index'

const row = (playerId: number, vote: number | null, extra: Partial<VoteRow> = {}): VoteRow => ({
  playerId,
  vote,
  gf: 0,
  gs: 0,
  rp: 0,
  rs: 0,
  rf: 0,
  au: 0,
  amm: 0,
  esp: 0,
  ass: 0,
  ...extra,
})

describe('fantavoto', () => {
  it('returns the plain vote without bonus/malus', () => {
    expect(fantavoto({ ...row(1, 6), vote: 6 })).toBe(6)
  })

  it('applies every bonus/malus of the conversion table', () => {
    const r = row(1, 6, { gf: 1, gs: 1, rp: 1, rs: 1, rf: 1, au: 1, amm: 1, esp: 1, ass: 1 })
    // 6 +3 -1 +3 -3 +3 -2 -0.5 -1 +1
    expect(fantavoto({ ...r, vote: 6 })).toBe(8.5)
  })

  it('goalkeeper conceding two goals', () => {
    expect(fantavoto({ ...row(1, 6.5, { gs: 2 }), vote: 6.5 })).toBe(4.5)
  })
})

describe('goalsFromPoints', () => {
  it.each([
    [0, 0],
    [65.5, 0],
    [66, 1],
    [69.5, 1],
    [70, 2],
    [73.5, 2],
    [74, 3],
    [90, 7],
  ])('%s points -> %s goals', (points, goals) => {
    expect(goalsFromPoints(points)).toBe(goals)
  })
})

describe('scoreLineup', () => {
  const votes = new Map<number, VoteRow>([
    [1, row(1, 6)],
    [2, row(2, 7, { gf: 1 })],
    [3, row(3, null)], // s.v.
  ])

  it('sums fantavoti, skipping holes, missing players and s.v.', () => {
    const lineup: LineupSlot[] = [
      { playerId: 1, outOfPosition: false },
      { playerId: 2, outOfPosition: false },
      { playerId: 3, outOfPosition: false },
      { playerId: 999, outOfPosition: false }, // not in the votes file
      { playerId: null, outOfPosition: false }, // hole
    ]
    const score = scoreLineup(lineup, votes)
    expect(score.total).toBe(16)
    expect(score.players.map((p) => p.counted)).toEqual([true, true, false, false, false])
  })

  it('applies -1 to out-of-position players that have a vote', () => {
    const lineup: LineupSlot[] = [
      { playerId: 1, outOfPosition: true },
      { playerId: 3, outOfPosition: true }, // no vote: no malus either
    ]
    expect(scoreLineup(lineup, votes).total).toBe(5)
  })

  it('converts the total into goals', () => {
    const many = new Map<number, VoteRow>(
      Array.from({ length: 11 }, (_, i) => [i, row(i, 6.5)] as const),
    )
    const lineup = Array.from({ length: 11 }, (_, i): LineupSlot => ({
      playerId: i,
      outOfPosition: false,
    }))
    const score = scoreLineup(lineup, many)
    expect(score.total).toBe(71.5)
    expect(score.goals).toBe(2)
  })
})

describe('computeStandings', () => {
  const teams = ['A', 'B', 'C']
  const result = (home: string, away: string, hg: number, ag: number, hp: number, ap: number) => ({
    home,
    away,
    homeGoals: hg,
    awayGoals: ag,
    homePoints: hp,
    awayPoints: ap,
  })

  it('awards 3/1/0 and tracks goals', () => {
    const table = computeStandings(teams, [
      result('A', 'B', 2, 1, 75, 68),
      result('B', 'C', 1, 1, 66, 67),
    ])
    expect(table.map((r) => [r.team, r.points])).toEqual([
      ['A', 3],
      ['B', 1], // same league points as C, more fantapoints
      ['C', 1],
    ])
    const a = table[0]
    expect(a).toMatchObject({
      played: 1,
      won: 1,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDiff: 1,
      totalPoints: 75,
    })
  })

  it('breaks ties on total fantapoints', () => {
    const table = computeStandings(teams, [result('A', 'B', 1, 1, 66, 70)])
    expect(table[0].team).toBe('B')
  })

  it('rejects unknown teams', () => {
    expect(() => computeStandings(teams, [result('A', 'Z', 0, 0, 0, 0)])).toThrow()
  })
})

describe('playMatch', () => {
  it('copies goals and points from the two team scores', () => {
    const votes = new Map([[1, row(1, 70)]])
    const home = scoreLineup([{ playerId: 1, outOfPosition: false }], votes)
    const away = scoreLineup([], votes)
    expect(playMatch('H', 'A', home, away)).toEqual({
      home: 'H',
      away: 'A',
      homeGoals: 2,
      awayGoals: 0,
      homePoints: 70,
      awayPoints: 0,
    })
  })
})

describe('buildBracket', () => {
  const ranking = Array.from({ length: 30 }, (_, i) => `T${i + 1}`)
  const ties = buildBracket(ranking)
  const byId = new Map(ties.map((t) => [t.id, t]))

  it('has 8 + 8 + 4 + 2 + 1 ties', () => {
    const count = (round: string) => ties.filter((t) => t.round === round).length
    expect([
      count('playoff'),
      count('r16'),
      count('quarter'),
      count('semi'),
      count('final'),
    ]).toEqual([8, 8, 4, 2, 1])
  })

  it('pairs ranks 9-24 in the playoff and leaves 1-8 and 25-30 out of it', () => {
    const playoffTeams = ties
      .filter((t) => t.round === 'playoff')
      .flatMap((t) => [t.a, t.b])
      .map((e) => ('team' in e ? e.team : ''))
    expect(playoffTeams).toHaveLength(16)
    expect(new Set(playoffTeams)).toEqual(new Set(ranking.slice(8, 24)))
    expect(byId.get('PO-9-24')).toMatchObject({ a: { team: 'T9' }, b: { team: 'T24' } })
    expect(byId.get('PO-16-17')).toMatchObject({ a: { team: 'T16' }, b: { team: 'T17' } })
  })

  it('gives each top-8 seed a playoff winner', () => {
    expect(byId.get('R16-1')).toMatchObject({ a: { team: 'T1' }, b: { winnerOf: 'PO-16-17' } })
    expect(byId.get('R16-8')).toMatchObject({ a: { team: 'T8' }, b: { winnerOf: 'PO-9-24' } })
    const opponents = ties.filter((t) => t.round === 'r16').map((t) => JSON.stringify(t.b))
    expect(new Set(opponents).size).toBe(8)
  })

  it('every winnerOf reference points to an existing tie, used once', () => {
    const refs = ties
      .flatMap((t) => [t.a, t.b])
      .flatMap((e) => ('winnerOf' in e ? [e.winnerOf] : []))
    expect(refs.every((id) => byId.has(id))).toBe(true)
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('is two-legged except the final', () => {
    expect(LEGS.playoff + LEGS.r16 + LEGS.quarter + LEGS.semi).toBe(8)
    expect(LEGS.final).toBe(1)
  })

  it('needs exactly 30 teams', () => {
    expect(() => buildBracket(ranking.slice(1))).toThrow()
  })
})

describe('resolveTie', () => {
  const leg = (goalsA: number, goalsB: number, pointsA = 70, pointsB = 70) => ({
    goalsA,
    goalsB,
    pointsA,
    pointsB,
  })

  it('is pending until all legs are in', () => {
    expect(resolveTie([leg(1, 0)], 2)).toEqual({ winner: null, decidedBy: 'pending' })
  })

  it('uses aggregate goals first', () => {
    expect(resolveTie([leg(2, 0), leg(0, 1)], 2)).toEqual({ winner: 'a', decidedBy: 'goals' })
  })

  it('uses aggregate points when goals are level', () => {
    expect(resolveTie([leg(1, 1, 70, 68), leg(0, 0, 60, 55)], 2)).toEqual({
      winner: 'a',
      decidedBy: 'points',
    })
  })

  it('asks the admin when goals and points are level, then applies the choice', () => {
    const legs = [leg(1, 1), leg(0, 0)]
    expect(resolveTie(legs, 2)).toEqual({ winner: null, decidedBy: 'undecided' })
    expect(resolveTie(legs, 2, 'b')).toEqual({ winner: 'b', decidedBy: 'manual' })
  })

  it('a single-leg final works the same way', () => {
    expect(resolveTie([leg(0, 1)], 1)).toEqual({ winner: 'b', decidedBy: 'goals' })
  })
})
