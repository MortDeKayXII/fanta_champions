import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

/**
 * In-process Postgres with the real schema + seed. Supabase's `auth` schema and roles are stubbed.
 * Users: ADMIN (team 3, admin), USER1 (team 1), USER2 (team 2).
 */
export const ADMIN = '00000000-0000-0000-0000-00000000000a'
export const USER1 = '00000000-0000-0000-0000-000000000001'
export const USER2 = '00000000-0000-0000-0000-000000000002'

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)
  await db.exec(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/0002_lineups_logged_only.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/0003_lineup_module.sql', 'utf8'))
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'))
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${USER1}'), ('${USER2}');
    insert into profiles (user_id, team_id, is_admin) values
      ('${ADMIN}', 3, true), ('${USER1}', 1, false), ('${USER2}', 2, false);
  `)

  /** Runs `sql` as a Supabase client would: role `anon` or `authenticated` with a given user. */
  async function as<T = Record<string, unknown>>(
    user: string | null,
    sql: string,
    params?: unknown[],
  ) {
    await db.exec(
      user
        ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`
        : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
    )
    try {
      return (await db.query<T>(sql, params)).rows
    } finally {
      await db.exec('reset role')
    }
  }

  return { db, as }
}
