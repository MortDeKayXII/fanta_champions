import { beforeAll, describe, expect, it } from 'vitest'
import { computeMatchday } from '../lib/computeMatchday'
import { importRows, type BuiltLineup } from '../lib/formazioni'
import type { Fixture, LineupRow, Player } from '../lib/types'
import { parseVotes } from '../lib/votesFile'
import { ADMIN, USER1, createTestDb } from './testdb'

/**
 * The admin workflow against the real schema: save lineups, store votes, compute, write results,
 * recompute after a correction. The SQL mirrors the upserts the admin page sends through PostgREST.
 */

let as: Awaited<ReturnType<typeof createTestDb>>['as']
let fixture: Fixture

const upsertLineups = (rows: unknown[]) =>
  as(
    ADMIN,
    `insert into lineups select * from json_populate_recordset(null::lineups, $1::json)
     on conflict (matchday, team_id, slot) do update set
       player_id = excluded.player_id, player_name = excluded.player_name,
       out_of_position = excluded.out_of_position, vote = excluded.vote,
       fantavoto = excluded.fantavoto, counted = excluded.counted, stats = excluded.stats
     returning 1`,
    [JSON.stringify(rows)],
  )

async function lineupFor(teamId: number): Promise<LineupRow[]> {
  const players = await as<{ player_id: number; name: string }>(
    ADMIN,
    `select r.player_id, p.name from roster_entries r join players p on p.id = r.player_id
     where r.team_id = ${teamId} order by r.player_id limit 11`,
  )
  return players.map((p, i) => ({
    matchday: 1,
    team_id: teamId,
    slot: i + 1,
    player_id: p.player_id,
    player_name: p.name,
    out_of_position: i === 0,
    vote: null,
    fantavoto: null,
    counted: null,
    stats: null,
  }))
}

const votesSheet = (playerIds: number[], vote: number) => [
  ['Cod.', 'Ruolo', 'Nome', 'Voto', 'Gf', 'Gs', 'Rp', 'Rs', 'Rf', 'Au', 'Amm', 'Esp', 'Ass'],
  ...playerIds.map((id) => [id, 'C', `P${id}`, vote, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
]

const storeVotes = async (ids: number[], vote: number) => {
  await as(ADMIN, 'delete from votes where matchday = 1')
  for (const v of parseVotes(votesSheet(ids, vote)).votes) {
    await as(
      ADMIN,
      'insert into votes (matchday, player_id, vote, gf, gs, rp, rs, rf, au, amm, esp, ass) values (1, $1, $2, 0, 0, 0, 0, 0, 0, 0, 0, 0)',
      [v.playerId, v.vote],
    )
  }
}

async function compute() {
  const dbVotes = await as<{ player_id: number; vote: string | null }>(
    ADMIN,
    'select * from votes where matchday = 1',
  )
  const dbLineups = await as<LineupRow>(ADMIN, 'select * from lineups where matchday = 1')
  const out = computeMatchday({
    fixtures: [fixture],
    lineups: dbLineups,
    votes: dbVotes.map((v) => ({
      playerId: v.player_id,
      vote: v.vote === null ? null : Number(v.vote),
      gf: 0,
      gs: 0,
      rp: 0,
      rs: 0,
      rf: 0,
      au: 0,
      amm: 0,
      esp: 0,
      ass: 0,
    })),
    teamName: (id) => `T${id}`,
  })
  await upsertLineups(out.lineups)
  await as(
    ADMIN,
    `insert into results select * from json_populate_recordset(null::results, $1::json)
     on conflict (fixture_id) do update set home_goals = excluded.home_goals,
       away_goals = excluded.away_goals, home_points = excluded.home_points,
       away_points = excluded.away_points`,
    [JSON.stringify(out.results.map((r) => ({ ...r, computed_at: new Date().toISOString() })))],
  )
  return out
}

beforeAll(async () => {
  ;({ as } = await createTestDb())
  fixture = (
    await as<Fixture>(ADMIN, 'select * from fixtures where matchday = 1 order by id limit 1')
  )[0]
})

describe('admin workflow', () => {
  it('saves lineups, stores votes, computes and publishes the result', async () => {
    const home = await lineupFor(fixture.home_team)
    const away = await lineupFor(fixture.away_team)
    expect(await upsertLineups([...home, ...away])).toHaveLength(22)
    await storeVotes(
      [...home, ...away].map((l) => l.player_id!),
      6.5,
    )

    const out = await compute()
    expect(out.warnings).toEqual([])
    // each side: 10 players x 6.5 + 1 out of position (6.5 - 1) = 70.5 -> 2 goals
    expect(out.results[0]).toMatchObject({
      home_points: 70.5,
      away_points: 70.5,
      home_goals: 2,
      away_goals: 2,
    })

    const stored = await as<{ home_points: string }>(ADMIN, 'select * from results')
    expect(stored).toHaveLength(1)
    expect(Number(stored[0].home_points)).toBe(70.5)
  })

  it('a normal user sees the result and the per-player scores, but not the raw votes', async () => {
    expect(await as(USER1, 'select * from results')).toHaveLength(1)
    const rows = await as<{ fantavoto: string; counted: boolean }>(
      USER1,
      `select fantavoto, counted from lineups where matchday = 1 and slot = 1 and team_id = ${fixture.home_team}`,
    )
    expect(rows[0]).toMatchObject({ counted: true })
    expect(Number(rows[0].fantavoto)).toBe(5.5)
    expect(await as(USER1, 'select * from votes')).toHaveLength(0)
  })

  it('recomputing after a corrected votes file overwrites the result (no duplicates)', async () => {
    const all = await as<{ player_id: number }>(
      ADMIN,
      'select player_id from votes where matchday = 1',
    )
    await storeVotes(
      all.map((v) => v.player_id),
      7,
    )
    await compute()
    const stored = await as<{ home_points: string; away_points: string }>(
      ADMIN,
      'select * from results',
    )
    expect(stored).toHaveLength(1)
    expect(Number(stored[0].home_points)).toBe(76) // 10 x 7 + (7 - 1)
    expect(Number(stored[0].away_points)).toBe(76)
  })

  it('editing a lineup clears its computed scores until the next calculation', async () => {
    const home = await lineupFor(fixture.home_team)
    await upsertLineups(home) // same players, scores reset to null
    const row = await as<{ fantavoto: string | null; counted: boolean | null }>(
      ADMIN,
      `select fantavoto, counted from lineups where matchday = 1 and team_id = ${fixture.home_team} and slot = 2`,
    )
    expect(row[0]).toEqual({ fantavoto: null, counted: null })
    await compute()
    const again = await as<{ fantavoto: string }>(
      ADMIN,
      `select fantavoto from lineups where matchday = 1 and team_id = ${fixture.home_team} and slot = 2`,
    )
    expect(Number(again[0].fantavoto)).toBe(7)
  })

  it('resetting a matchday clears results, votes and scores but keeps the lineups', async () => {
    await as(ADMIN, `delete from results where fixture_id = ${fixture.id}`)
    await as(ADMIN, 'delete from votes where matchday = 1')
    await as(
      ADMIN,
      'update lineups set vote = null, fantavoto = null, counted = null, stats = null where matchday = 1',
    )
    expect(await as(ADMIN, 'select * from results')).toHaveLength(0)
    expect(await as(ADMIN, 'select * from votes')).toHaveLength(0)
    const left = await as<{ n: string; scored: string }>(
      ADMIN,
      'select count(*) n, count(fantavoto) scored from lineups where matchday = 1',
    )
    expect(Number(left[0].n)).toBe(22)
    expect(Number(left[0].scored)).toBe(0)
  })
})

describe('importing lineups twice for the same matchday', () => {
  it('the second import (final lineup) overwrites the first (initial), keeping 11 rows per team', async () => {
    const pool = await as<Player>(ADMIN, 'select * from players order by id limit 12')
    const slotsOf = (ps: typeof pool) => ps.map((p) => ({ fileName: p.name, player: p }))
    const build = (ps: typeof pool): BuiltLineup => ({
      teamName: 'X',
      module: '4-3-1-2',
      slots: slotsOf(ps),
      substitutions: [],
      ignored: [],
      warnings: [],
    })
    const upsert = (rows: unknown[]) => upsertLineups(rows).then((r) => r.length)
    const read = () =>
      as<{ slot: number; player_id: number; out_of_position: boolean }>(
        ADMIN,
        'select slot, player_id, out_of_position from lineups where matchday = 2 and team_id = 5 order by slot',
      )

    // 1st upload: the eleven starters as fielded
    const initial = pool.slice(0, 11)
    expect(await upsert(importRows(2, 5, build(initial), []))).toBe(11)
    expect((await read()).map((r) => r.player_id)).toEqual(initial.map((p) => p.id))

    // the admin flags one player out of position
    await as(
      ADMIN,
      'update lineups set out_of_position = true where matchday = 2 and team_id = 5 and slot = 9',
    )
    const saved = await as<{ team_id: number; player_id: number; out_of_position: boolean }>(
      ADMIN,
      'select team_id, player_id, out_of_position from lineups where matchday = 2 and team_id = 5',
    )

    // 2nd upload: slot 6 replaced by the substitute; nothing else changes
    const final = [...initial.slice(0, 5), pool[11], ...initial.slice(6)]
    expect(await upsert(importRows(2, 5, build(final), saved))).toBe(11)
    const after = await read()
    expect(after).toHaveLength(11) // overwritten, not duplicated
    expect(after[5].player_id).toBe(pool[11].id)
    expect(after.find((r) => r.out_of_position)?.slot).toBe(9) // flag survived the re-import
    // the module from the file is stored on every slot and the format is checked by the database
    const modules = await as<{ module: string | null }>(
      ADMIN,
      'select distinct module from lineups where matchday = 2 and team_id = 5',
    )
    expect(modules).toEqual([{ module: '4-3-1-2' }])
    await expect(
      as(ADMIN, "update lineups set module = 'abc' where matchday = 2 and team_id = 5"),
    ).rejects.toThrow()
    expect(
      await as(
        ADMIN,
        "update lineups set module = '3-5-2' where matchday = 2 and team_id = 5 returning 1",
      ),
    ).toHaveLength(11)
  })
})

describe('deleting all lineups of a matchday', () => {
  const lineupRow = (matchday: number, team: number, slot: number, player: number) => ({
    matchday,
    team_id: team,
    slot,
    player_id: player,
    player_name: `P${player}`,
    out_of_position: false,
    vote: null,
    fantavoto: null,
    counted: null,
    stats: null,
  })

  it('removes lineups and results of that matchday only, keeps votes, and only for the admin', async () => {
    const fx = await as<Fixture>(
      ADMIN,
      'select * from fixtures where matchday = 3 order by id limit 1',
    )
    const other = await as<Fixture>(
      ADMIN,
      'select * from fixtures where matchday = 4 order by id limit 1',
    )
    const ps = await as<{ id: number }>(ADMIN, 'select id from players order by id limit 3')
    // lineups on matchday 3 (both teams) and 4 (one team), one result on 3, votes on 3
    await upsertLineups([
      lineupRow(3, fx[0].home_team, 1, ps[0].id),
      lineupRow(3, fx[0].away_team, 1, ps[1].id),
      lineupRow(4, other[0].home_team, 1, ps[2].id),
    ])
    await as(
      ADMIN,
      'insert into results (fixture_id, home_goals, away_goals, home_points, away_points) values ($1, 1, 0, 70, 60)',
      [fx[0].id],
    )
    await as(ADMIN, 'insert into votes (matchday, player_id, vote) values (3, $1, 6)', [ps[0].id])

    // a normal user cannot delete anything (row level security hides the rows)
    expect(await as(USER1, 'delete from lineups where matchday = 3 returning 1')).toHaveLength(0)
    expect(await as(USER1, 'delete from results returning 1')).toHaveLength(0)

    // the admin: results first, then lineups, exactly as the admin page does
    const fixtureIds = (
      await as<{ id: number }>(ADMIN, 'select id from fixtures where matchday = 3')
    ).map((f) => f.id)
    await as(ADMIN, 'delete from results where fixture_id = any($1)', [fixtureIds])
    await as(ADMIN, 'delete from lineups where matchday = 3')

    expect(await as(ADMIN, 'select * from lineups where matchday = 3')).toHaveLength(0)
    expect(await as(ADMIN, 'select * from results where fixture_id = $1', [fx[0].id])).toHaveLength(
      0,
    )
    expect(await as(ADMIN, 'select * from votes where matchday = 3')).toHaveLength(1) // votes stay
    expect(await as(ADMIN, 'select * from lineups where matchday = 4')).toHaveLength(1) // other matchday untouched
  })
})
