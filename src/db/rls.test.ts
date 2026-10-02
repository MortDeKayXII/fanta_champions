import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Runs the real schema + seed on an in-process Postgres and checks the access rules.
 * Supabase's `auth` schema and roles are stubbed.
 */

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USER1 = '00000000-0000-0000-0000-000000000001' // team 1
const USER2 = '00000000-0000-0000-0000-000000000002' // team 2

let db: PGlite

/** Runs `sql` as a Supabase client would: role `anon` or `authenticated` with a given user. */
async function as<T = Record<string, unknown>>(user: string | null, sql: string) {
  await db.exec(
    user
      ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`
      : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
  )
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)
  await db.exec(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'))
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'))
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${USER1}'), ('${USER2}');
    insert into profiles (user_id, team_id, is_admin) values
      ('${ADMIN}', 3, true), ('${USER1}', 1, false), ('${USER2}', 2, false);
  `)
})

describe('seed', () => {
  it('loads teams, players, rosters, matchdays and the group calendar', async () => {
    const count = async (table: string) =>
      Number((await db.query<{ n: string }>(`select count(*) n from ${table}`)).rows[0].n)
    expect(await count('teams')).toBe(30)
    expect(await count('players')).toBe(535)
    expect(await count('roster_entries')).toBe(810)
    expect(await count('matchdays')).toBe(17)
    expect(await count('fixtures')).toBe(120)
    expect(await count('roster_history')).toBe(0) // initial import is not logged
  })

  it('has 10 teams per league', async () => {
    const rows = await db.query<{ league: string; n: string }>(
      'select league, count(*) n from teams group by league order by league',
    )
    expect(rows.rows.map((r) => Number(r.n))).toEqual([10, 10, 10])
  })
})

describe('public access', () => {
  it('anon can read standings data but not votes, profiles or reports', async () => {
    expect(await as(null, 'select id from teams')).toHaveLength(30)
    expect(await as(null, 'select id from fixtures')).toHaveLength(120)
    await expect(as(null, 'select * from votes')).rejects.toThrow()
    await expect(as(null, 'select * from profiles')).rejects.toThrow()
    await expect(as(null, 'select * from error_reports')).rejects.toThrow()
  })

  it('anon cannot write', async () => {
    await expect(as(null, 'delete from roster_entries')).rejects.toThrow()
  })
})

describe('rosters', () => {
  it('a user edits their own roster and the change is logged', async () => {
    const [{ player_id }] = await as<{ player_id: number }>(
      USER1,
      'select player_id from roster_entries where team_id = 1 limit 1',
    )
    const deleted = await as(
      USER1,
      `delete from roster_entries where team_id = 1 and player_id = ${player_id} returning 1`,
    )
    expect(deleted).toHaveLength(1)
    const log = await db.query<{ action: string; changed_by: string }>(
      `select action, changed_by from roster_history where team_id = 1 and player_id = ${player_id}`,
    )
    expect(log.rows).toEqual([{ action: 'remove', changed_by: USER1 }])
  })

  it("a user cannot touch another team's roster", async () => {
    const deleted = await as(USER1, 'delete from roster_entries where team_id = 2 returning 1')
    expect(deleted).toHaveLength(0)
    await expect(
      as(USER1, 'insert into roster_entries (team_id, player_id, cost) values (2, 1, 1)'),
    ).rejects.toThrow()
  })

  it('the admin edits any team', async () => {
    const deleted = await as(
      ADMIN,
      'delete from roster_entries where team_id = 2 and cost = 1 returning 1',
    )
    expect(deleted.length).toBeGreaterThan(0)
  })
})

describe('competition data', () => {
  it('only the admin writes lineups and reads votes', async () => {
    const insertLineup = `insert into lineups (matchday, team_id, slot, player_id) values (1, 1, 1, null)`
    await expect(as(USER1, insertLineup)).rejects.toThrow()
    expect(await as(ADMIN, `${insertLineup} returning 1`)).toHaveLength(1)
    expect(await as(USER1, 'select * from lineups')).toHaveLength(1) // public read

    await as(ADMIN, 'insert into votes (matchday, player_id, vote) values (1, 4431, 6.5)')
    expect(await as(USER1, 'select * from votes')).toHaveLength(0) // RLS hides the rows
    expect(await as(ADMIN, 'select * from votes')).toHaveLength(1)
  })

  it('lineups accept any player, not only roster players', async () => {
    const rows = await as(
      ADMIN,
      `insert into lineups (matchday, team_id, slot, player_id, player_name)
       select 1, 1, 2, id, name from players
       where id not in (select player_id from roster_entries where team_id = 1) limit 1 returning 1`,
    )
    expect(rows).toHaveLength(1)
  })

  it('users cannot write results or tie decisions', async () => {
    await expect(
      as(USER1, "insert into tie_decisions (tie_id, winner_team) values ('F', 1)"),
    ).rejects.toThrow()
  })
})

describe('profiles and error reports', () => {
  it('a user sees only their own profile, the admin sees all', async () => {
    expect(await as(USER1, 'select * from profiles')).toHaveLength(1)
    expect(await as(ADMIN, 'select * from profiles')).toHaveLength(3)
  })

  it('a user cannot promote themselves', async () => {
    await expect(
      as(USER1, `update profiles set is_admin = true where user_id = '${USER1}'`),
    ).rejects.toThrow()
  })

  it('a user files reports for their own team only', async () => {
    const own = `insert into error_reports (team_id, matchday, message) values (1, 1, 'voto sbagliato')`
    expect(await as(USER1, `${own} returning 1`)).toHaveLength(1)
    await expect(
      as(USER1, `insert into error_reports (team_id, message) values (2, 'x')`),
    ).rejects.toThrow()
    await expect(
      as(USER1, `insert into error_reports (team_id, message, status) values (1, 'x', 'resolved')`),
    ).rejects.toThrow()
  })

  it('reports are private to their team and the admin', async () => {
    expect(await as(USER1, 'select * from error_reports')).toHaveLength(1)
    expect(await as(USER2, 'select * from error_reports')).toHaveLength(0)
    expect(await as(ADMIN, 'select * from error_reports')).toHaveLength(1)
  })

  it('only the admin changes a report status', async () => {
    const own = await as(USER1, `update error_reports set status = 'resolved' returning 1`)
    expect(own).toHaveLength(0)
    const admin = await as(ADMIN, `update error_reports set status = 'resolved' returning 1`)
    expect(admin).toHaveLength(1)
  })
})
