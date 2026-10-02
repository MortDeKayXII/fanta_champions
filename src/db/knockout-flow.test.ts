import { beforeAll, describe, expect, it } from 'vitest'
import { fixturesForRound, nextRound, resolveKnockout } from '../lib/knockout'
import type { Fixture, Matchday, ResultRow, Team } from '../lib/types'
import { ADMIN, USER1, createTestDb } from './testdb'

/** Knockout administration against the real schema, driven by the same functions as the admin page. */

let as: Awaited<ReturnType<typeof createTestDb>>['as']
let teams: Team[]
let matchdays: Matchday[]

async function views() {
  const fixtures = await as<Fixture>(ADMIN, 'select * from fixtures order by id')
  const results = (await as<Record<string, string | number>>(ADMIN, 'select * from results')).map(
    (r) =>
      ({
        fixture_id: Number(r.fixture_id),
        home_goals: Number(r.home_goals),
        away_goals: Number(r.away_goals),
        home_points: Number(r.home_points),
        away_points: Number(r.away_points),
      }) satisfies ResultRow,
  )
  const decisions = await as<{ tie_id: string; winner_team: number }>(
    ADMIN,
    'select tie_id, winner_team from tie_decisions',
  )
  // Ranking: team ids 1..30 in order (the group table is not what is under test here)
  return resolveKnockout({
    ranking: teams.map((t) => t.name),
    teamIdByName: new Map(teams.map((t) => [t.name, t.id])),
    fixtures,
    results,
    decisions,
  })
}

const insertRound = async (round: Parameters<typeof fixturesForRound>[1]) => {
  const rows = fixturesForRound(await views(), round, matchdays)
  return as(
    ADMIN,
    `insert into fixtures (matchday, home_team, away_team, tie_id)
     select matchday, home_team, away_team, tie_id from json_populate_recordset(null::fixtures, $1::json)
     returning id`,
    [JSON.stringify(rows)],
  )
}

beforeAll(async () => {
  ;({ as } = await createTestDb())
  teams = await as<Team>(ADMIN, 'select * from teams order by id')
  matchdays = await as<Matchday>(ADMIN, 'select * from matchdays order by number')
})

describe('knockout administration', () => {
  it('only the admin can create knockout fixtures', async () => {
    await expect(
      as(
        USER1,
        "insert into fixtures (matchday, home_team, away_team, tie_id) values (9, 1, 2, 'X')",
      ),
    ).rejects.toThrow()
  })

  it('creates the playoff on matchdays 9 and 10, 16 fixtures with reversed hosts', async () => {
    expect(await insertRound('playoff')).toHaveLength(16)
    const legs = await as<{ matchday: number; n: number }>(
      ADMIN,
      'select matchday, count(*)::int n from fixtures where tie_id is not null group by matchday order by matchday',
    )
    expect(legs).toEqual([
      { matchday: 9, n: 8 },
      { matchday: 10, n: 8 },
    ])
    expect((await views()).find((t) => t.id === 'PO-9-24')).toMatchObject({
      a: 9,
      b: 24,
      generated: true,
    })
    expect(nextRound(await views())).toEqual({ round: 'r16', ready: false })
  })

  it('records a manual decision and advances the winner', async () => {
    // Level on goals and points in tie PO-9-24
    for (const f of await as<Fixture>(ADMIN, "select * from fixtures where tie_id = 'PO-9-24'")) {
      await as(
        ADMIN,
        'insert into results (fixture_id, home_goals, away_goals, home_points, away_points) values ($1, 1, 1, 70, 70)',
        [f.id],
      )
    }
    expect((await views()).find((t) => t.id === 'PO-9-24')!.outcome.decidedBy).toBe('undecided')

    await as(ADMIN, "insert into tie_decisions (tie_id, winner_team) values ('PO-9-24', 24)")
    const after = await views()
    expect(after.find((t) => t.id === 'PO-9-24')).toMatchObject({ winner: 24 })
    expect(after.find((t) => t.id === 'R16-8')).toMatchObject({ a: 8, b: 24 })

    await expect(
      as(USER1, "insert into tie_decisions (tie_id, winner_team) values ('PO-10-23', 10)"),
    ).rejects.toThrow()
    expect(await as(USER1, 'select * from tie_decisions')).toHaveLength(1) // public read
  })

  it('removing a round deletes its fixtures, results and decisions', async () => {
    const ids = (await views()).filter((t) => t.round === 'playoff').map((t) => t.id)
    await as(ADMIN, 'delete from fixtures where tie_id = any($1)', [ids])
    await as(ADMIN, 'delete from tie_decisions where tie_id = any($1)', [ids])
    expect(await as(ADMIN, 'select * from fixtures where tie_id is not null')).toHaveLength(0)
    expect(await as(ADMIN, 'select * from results')).toHaveLength(0) // cascade
    expect(await as(ADMIN, 'select * from tie_decisions')).toHaveLength(0)
    expect(nextRound(await views())).toEqual({ round: 'playoff', ready: true })
  })
})
