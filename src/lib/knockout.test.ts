import { describe, expect, it } from 'vitest'
import {
  fixturesForRound,
  groupStageComplete,
  nextRound,
  pendingLabel,
  pendingShort,
  resolveKnockout,
  type KnockoutInput,
} from './knockout'
import type { Fixture, Matchday, ResultRow } from './types'

const ranking = Array.from({ length: 30 }, (_, i) => `T${i + 1}`)
const teamIdByName = new Map(ranking.map((n, i) => [n, i + 1]))

const matchdays: Matchday[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    phase: 'group' as const,
    leg: 1 as const,
  })),
  { number: 9, phase: 'playoff', leg: 1 },
  { number: 10, phase: 'playoff', leg: 2 },
  { number: 11, phase: 'r16', leg: 1 },
  { number: 12, phase: 'r16', leg: 2 },
  { number: 13, phase: 'quarter', leg: 1 },
  { number: 14, phase: 'quarter', leg: 2 },
  { number: 15, phase: 'semi', leg: 1 },
  { number: 16, phase: 'semi', leg: 2 },
  { number: 17, phase: 'final', leg: 1 },
]

/** Test harness: creates fixtures for a round, plays them, and resolves again. */
function makeWorld() {
  let fixtures: Fixture[] = []
  let results: ResultRow[] = []
  let decisions: Array<{ tie_id: string; winner_team: number }> = []
  let nextId = 1

  const input = (): KnockoutInput => ({ ranking, teamIdByName, fixtures, results, decisions })
  const views = () => resolveKnockout(input())

  return {
    views,
    generate(round: Parameters<typeof fixturesForRound>[1]) {
      for (const nf of fixturesForRound(views(), round, matchdays)) {
        fixtures = [...fixtures, { id: nextId++, ...nf }]
      }
    },
    /** Plays every unplayed fixture: `score(homeTeam, awayTeam)` -> [homeGoals, awayGoals, homePts, awayPts] */
    play(score: (home: number, away: number) => [number, number, number, number]) {
      for (const f of fixtures.filter((x) => !results.some((r) => r.fixture_id === x.id))) {
        const [hg, ag, hp, ap] = score(f.home_team, f.away_team)
        results = [
          ...results,
          { fixture_id: f.id, home_goals: hg, away_goals: ag, home_points: hp, away_points: ap },
        ]
      }
    },
    decide(tie_id: string, winner_team: number) {
      decisions = [...decisions.filter((d) => d.tie_id !== tie_id), { tie_id, winner_team }]
    },
    get fixtures() {
      return fixtures
    },
  }
}

// Better-ranked (lower id) team always wins 2-0
const betterWins = (h: number, a: number): [number, number, number, number] =>
  h < a ? [2, 0, 75, 60] : [0, 2, 60, 75]

describe('resolveKnockout', () => {
  it('projects the playoff from the ranking before anything is generated', () => {
    const views = makeWorld().views()
    const po = views.filter((t) => t.round === 'playoff')
    expect(po).toHaveLength(8)
    expect(po[0]).toMatchObject({ id: 'PO-9-24', a: 9, b: 24, generated: false })
    expect(views.find((t) => t.id === 'R16-1')).toMatchObject({ a: 1, b: null, bFrom: 'PO-16-17' })
    expect(nextRound(views)).toEqual({ round: 'playoff', ready: true })
  })

  it('generates two legs per tie with reversed hosts', () => {
    const w = makeWorld()
    w.generate('playoff')
    expect(w.fixtures).toHaveLength(16)
    const leg1 = w.fixtures.find((f) => f.tie_id === 'PO-9-24' && f.matchday === 9)!
    const leg2 = w.fixtures.find((f) => f.tie_id === 'PO-9-24' && f.matchday === 10)!
    expect([leg1.home_team, leg1.away_team]).toEqual([9, 24])
    expect([leg2.home_team, leg2.away_team]).toEqual([24, 9])
  })

  it('waits for both legs, then advances the winner into the next round', () => {
    const w = makeWorld()
    w.generate('playoff')
    expect(w.views().find((t) => t.id === 'PO-9-24')!.outcome.decidedBy).toBe('pending')
    expect(nextRound(w.views())).toEqual({ round: 'r16', ready: false })

    w.play(betterWins)
    const po = w.views().find((t) => t.id === 'PO-9-24')!
    expect(po.winner).toBe(9)
    expect(po.aggregate).toEqual({ goalsA: 4, goalsB: 0, pointsA: 150, pointsB: 120 })
    expect(w.views().find((t) => t.id === 'R16-8')).toMatchObject({ a: 8, b: 9 })
    expect(nextRound(w.views())).toEqual({ round: 'r16', ready: true })
  })

  it('runs a whole tournament to a champion', () => {
    const w = makeWorld()
    for (const round of ['playoff', 'r16', 'quarter', 'semi', 'final'] as const) {
      expect(nextRound(w.views())).toEqual({ round, ready: true })
      w.generate(round)
      w.play(betterWins)
    }
    const final = w.views().find((t) => t.id === 'F')!
    expect(final.legs).toHaveLength(1)
    expect(final.winner).toBe(1) // the best seed wins everything
    expect(nextRound(w.views())).toBeNull()
    // seeds 1 and 2 meet only in the final
    expect([final.a, final.b].sort()).toEqual([1, 2])
    expect(w.fixtures).toHaveLength(8 * 2 + 8 * 2 + 4 * 2 + 2 * 2 + 1)
  })

  it('needs the admin when a tie is level on goals and points, and applies the decision', () => {
    const w = makeWorld()
    w.generate('playoff')
    w.play((h, a) => (h === 9 || a === 9 ? [1, 1, 70, 70] : betterWins(h, a)))
    let po = w.views().find((t) => t.id === 'PO-9-24')!
    expect(po.outcome).toEqual({ winner: null, decidedBy: 'undecided' })
    expect(nextRound(w.views())).toEqual({ round: 'r16', ready: false })

    w.decide('PO-9-24', 24)
    po = w.views().find((t) => t.id === 'PO-9-24')!
    expect(po).toMatchObject({ winner: 24 })
    expect(po.outcome.decidedBy).toBe('manual')
    expect(w.views().find((t) => t.id === 'R16-8')).toMatchObject({ a: 8, b: 24 })
  })

  it('keeps generated pairings frozen even if the ranking changes afterwards', () => {
    const w = makeWorld()
    w.generate('playoff')
    const swapped = [...ranking]
    ;[swapped[8], swapped[23]] = [swapped[23], swapped[8]]
    const views = resolveKnockout({
      ranking: swapped,
      teamIdByName,
      fixtures: w.fixtures,
      results: [],
      decisions: [],
    })
    expect(views.find((t) => t.id === 'PO-9-24')).toMatchObject({ a: 9, b: 24 })
  })

  it('decides by aggregate points when goals are level', () => {
    const w = makeWorld()
    w.generate('playoff')
    w.play((h, a) =>
      h === 10 || a === 10 ? [1, 1, h === 10 ? 71 : 65, a === 10 ? 71 : 65] : betterWins(h, a),
    )
    const po = w.views().find((t) => t.id === 'PO-10-23')!
    expect(po.winner).toBe(10)
    expect(po.outcome.decidedBy).toBe('points')
  })
})

describe('helpers', () => {
  it('rejects fixtures for a round whose sides are unknown', () => {
    expect(() => fixturesForRound(makeWorld().views(), 'r16', matchdays)).toThrow()
  })

  it('labels pending sides', () => {
    expect(pendingLabel('PO-9-24')).toBe('Vincente playoff 9°–24°')
    expect(pendingLabel('QF-2')).toBe('Vincente quarto 2')
    expect(pendingLabel(undefined)).toBe('Da definire')
  })

  it('has short labels for the bracket drawing', () => {
    expect(pendingShort('PO-9-24')).toBe('V. 9°–24°')
    expect(pendingShort('R16-1')).toBe('V. ottavi 1ª TdS')
    expect(pendingShort('QF-3')).toBe('V. quarto 3')
    expect(pendingShort('SF-2')).toBe('V. semifinale 2')
    expect(pendingShort(undefined)).toBe('Da definire')
  })

  it('detects the end of the group stage', () => {
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
    const fixtures = [fx(1, 1), fx(2, 2), fx(3, 9)]
    expect(groupStageComplete(fixtures, [res(1)], matchdays)).toBe(false)
    expect(groupStageComplete(fixtures, [res(1), res(2)], matchdays)).toBe(true) // playoff fixture ignored
    expect(groupStageComplete([], [], matchdays)).toBe(false)
  })
})
