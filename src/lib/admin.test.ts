import { describe, expect, it } from 'vitest'
import type { VoteRow } from '../engine'
import { computeMatchday } from './computeMatchday'
import { matchPlayerNames } from './lineupText'
import type { Fixture, LineupRow, Player } from './types'
import { findItaliaSheet, parseVotes } from './votesFile'

describe('parseVotes', () => {
  const header = [
    'Cod.',
    'Ruolo',
    'Nome',
    'Voto',
    'Gf',
    'Gs',
    'Rp',
    'Rs',
    'Rf',
    'Au',
    'Amm',
    'Esp',
    'Ass',
  ]
  const rows = [
    ['Voti Fantacalcio 5ª giornata', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Atalanta', null, null, null, null, null, null, null, null, null, null, null, null],
    header,
    [4431, 'P', 'Carnesecchi', 6.5, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    [4479, 'C', 'Elmas', '6*', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['184', 'C', 'Bernardeschi', '7,5', '1', 0, 0, 0, 0, 0, 1, 0, 2],
    [688, 'ALL', 'Sarri', 6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]

  it('reads players, treats 6* as no vote and skips coaches and headers', () => {
    const r = parseVotes(rows)
    expect(r.votes.map((v) => v.playerId)).toEqual([4431, 4479, 184])
    expect(r.votes[0]).toMatchObject({ vote: 6.5, gs: 2 })
    expect(r.votes[1].vote).toBeNull()
    expect(r.votes[2]).toMatchObject({ vote: 7.5, gf: 1, amm: 1, ass: 2 })
    expect(r.noVote).toBe(1)
    expect(r.coaches).toBe(1)
  })

  it('warns when there are no players', () => {
    expect(parseVotes([header]).warnings).toHaveLength(1)
  })
})

const vote = (playerId: number, v: number | null, extra: Partial<VoteRow> = {}): VoteRow => ({
  playerId,
  vote: v,
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

const lineup = (team: number, ids: Array<number | null>, oop: number[] = []): LineupRow[] =>
  ids.map((id, i) => ({
    matchday: 1,
    team_id: team,
    slot: i + 1,
    player_id: id,
    player_name: id === null ? null : `P${id}`,
    out_of_position: id !== null && oop.includes(id),
    vote: null,
    fantavoto: null,
    counted: null,
    stats: null,
  }))

describe('computeMatchday', () => {
  const fixtures: Fixture[] = [
    { id: 10, matchday: 1, home_team: 1, away_team: 2, tie_id: null },
    { id: 11, matchday: 1, home_team: 3, away_team: 4, tie_id: null },
  ]
  const name = (id: number) => `T${id}`
  // 11 players at 6.5 = 71.5 -> 2 goals; a weaker side with 11 x 6 = 66 -> 1 goal
  const strong = Array.from({ length: 11 }, (_, i) => 100 + i)
  const weak = Array.from({ length: 11 }, (_, i) => 200 + i)
  const votes = [...strong.map((id) => vote(id, 6.5)), ...weak.map((id) => vote(id, 6))]

  it('computes results, fills player scores and skips fixtures without lineups', () => {
    const out = computeMatchday({
      fixtures,
      lineups: [...lineup(1, strong), ...lineup(2, weak)],
      votes,
      teamName: name,
    })
    expect(out.results).toEqual([
      { fixture_id: 10, home_goals: 2, away_goals: 1, home_points: 71.5, away_points: 66 },
    ])
    expect(out.lineups).toHaveLength(22)
    expect(out.lineups[0]).toMatchObject({ vote: 6.5, fantavoto: 6.5, counted: true })
    expect(out.warnings.join(' ')).toContain('manca la formazione di T3 e T4')
  })

  it('applies the out-of-position malus and reports missing / s.v. players', () => {
    const ids = [...strong.slice(0, 8), 999, 998, null]
    const out = computeMatchday({
      fixtures: [fixtures[0]],
      lineups: [...lineup(1, ids, [100]), ...lineup(2, weak)],
      votes: [...votes, vote(998, null)],
      teamName: name,
    })
    const home = out.lineups.filter((l) => l.team_id === 1)
    expect(home[0].fantavoto).toBe(5.5) // 6.5 - 1
    expect(home[8]).toMatchObject({ counted: false, fantavoto: null })
    const text = out.warnings.join('\n')
    expect(text).toContain('P999 non è nel file dei voti')
    expect(text).toContain('P998 è senza voto')
    expect(text).toContain('formazione con 10 giocatori su 11')
  })

  it('stores non-zero bonus stats for the match page', () => {
    const out = computeMatchday({
      fixtures: [fixtures[0]],
      lineups: [...lineup(1, [100]), ...lineup(2, [200])],
      votes: [vote(100, 7, { gf: 1, ass: 2 }), vote(200, 6)],
      teamName: name,
    })
    expect(out.lineups[0].stats).toEqual({ gf: 1, ass: 2 })
    expect(out.lineups[0].fantavoto).toBe(12) // 7 + 3 + 2
  })

  it('recomputing with new votes gives new results (idempotent inputs)', () => {
    const run = (v: VoteRow[]) =>
      computeMatchday({
        fixtures: [fixtures[0]],
        lineups: [...lineup(1, strong), ...lineup(2, weak)],
        votes: v,
        teamName: name,
      }).results[0]
    const first = run(votes)
    const corrected = run([...votes.filter((v) => v.playerId !== 100), vote(100, 9)])
    expect(corrected.home_points).toBe(first.home_points + 2.5)
  })
})

describe('matchPlayerNames', () => {
  const p = (id: number, name: string): Player => ({
    id,
    name,
    role: 'C',
    mantra_roles: 'C',
    serie_a_team: 'X',
  })
  const players = [
    p(1, 'Martinez Jo.'),
    p(2, 'Martinez L.'),
    p(3, 'Di Lorenzo'),
    p(4, 'Sanchez Ro.'),
    p(5, "N'Dicka"),
    p(6, 'Lukaku'),
    p(7, 'Lukaku R.'),
  ]

  it('matches exact names, ignoring case and accents, one per line', () => {
    const r = matchPlayerNames('di lorenzo\nN’Dicka', players, new Set())
    expect(r.map((s) => s.player?.id)).toEqual([3, 5])
  })

  it('accepts commas and marks a trailing * as out of position', () => {
    const r = matchPlayerNames('Di Lorenzo*, Lukaku', players, new Set())
    expect(r.map((s) => [s.player?.id, s.outOfPosition])).toEqual([
      [3, true],
      [6, false], // exact match wins over "Lukaku R."
    ])
  })

  it('resolves ambiguity in favour of roster players, otherwise reports it', () => {
    expect(matchPlayerNames('Martinez', players, new Set([2]))[0].player?.id).toBe(2)
    const amb = matchPlayerNames('Martinez', players, new Set())[0]
    expect(amb.player).toBeNull()
    expect(amb.problem).toContain('Ambiguo')
  })

  it('finds partial names and reports unknown ones', () => {
    expect(matchPlayerNames('Sanchez', players, new Set())[0].player?.id).toBe(4)
    expect(matchPlayerNames('Zzz Nobody', players, new Set())[0].problem).toBe(
      'Giocatore non trovato',
    )
  })
})

describe('findItaliaSheet', () => {
  it('picks the Italia sheet, preferring "Redazione Italia"', () => {
    expect(findItaliaSheet(['Fantacalcio', 'Statistico', 'Italia'])).toBe('Italia')
    expect(findItaliaSheet(['Fantacalcio', 'Italia', 'Redazione Italia'])).toBe('Redazione Italia')
    expect(findItaliaSheet(['redazione italia'])).toBe('redazione italia')
  })

  it('returns undefined when there is no such sheet', () => {
    expect(findItaliaSheet(['Fantacalcio', 'Statistico'])).toBeUndefined()
  })
})
