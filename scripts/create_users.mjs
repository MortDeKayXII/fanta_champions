// Creates one Supabase Auth user per team (login = team name) and links it to its team.
// Safe to re-run: teams that already have a profile are skipped.
//
//   1. copy scripts/scripts.env.example to .env.scripts and fill it in (never commit it)
//   2. node --env-file=.env.scripts scripts/create_users.mjs
import { createClient } from '@supabase/supabase-js'
import { EMAIL_DOMAIN, teamEmail, teamSlug } from '../src/lib/slug.ts'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INITIAL_PASSWORD, ADMIN_TEAM } = process.env
const domain = process.env.EMAIL_DOMAIN || EMAIL_DOMAIN

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INITIAL_PASSWORD, ADMIN_TEAM })) {
  if (!v) throw new Error(`Missing ${k} in .env.scripts`)
}
if (INITIAL_PASSWORD.length < 8) throw new Error('INITIAL_PASSWORD must have at least 8 characters')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const check = ({ error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

const teams = await supabase.from('teams').select('id, name').order('id')
check(teams, 'reading teams')
if (!teams.data.some((t) => teamSlug(t.name) === teamSlug(ADMIN_TEAM))) {
  throw new Error(`ADMIN_TEAM "${ADMIN_TEAM}" does not match any team`)
}
const profiles = await supabase.from('profiles').select('team_id')
check(profiles, 'reading profiles')
const done = new Set(profiles.data.map((p) => p.team_id))

async function findUserId(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listing users: ${error.message}`)
    const u = data.users.find((x) => x.email === email)
    if (u) return u.id
    if (data.users.length < 200) return null
  }
}

let created = 0
for (const team of teams.data) {
  if (done.has(team.id)) {
    console.log(`skip    ${team.name} (already linked)`)
    continue
  }
  const email = teamEmail(team.name, domain)
  const res = await supabase.auth.admin.createUser({
    email,
    password: INITIAL_PASSWORD,
    email_confirm: true,
  })
  let userId = res.data?.user?.id
  if (res.error) {
    // The auth user may exist from an interrupted run: reuse it.
    userId = await findUserId(email)
    if (!userId) throw new Error(`creating ${team.name} (${email}): ${res.error.message}`)
  }
  const isAdmin = teamSlug(team.name) === teamSlug(ADMIN_TEAM)
  const link = await supabase.from('profiles').insert({ user_id: userId, team_id: team.id, is_admin: isAdmin })
  check(link, `linking ${team.name}`)
  created++
  console.log(`created ${team.name}${isAdmin ? '  [ADMIN]' : ''}`)
}
console.log(`\nDone: ${created} created, ${teams.data.length - created} already present.`)
