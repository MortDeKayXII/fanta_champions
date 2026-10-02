// Edge Function: lets an admin set a new password for any team's account.
// Users have no email, so there is no self-service "forgot password".
//
// POST { teamId: number, password: string }   with the admin's session token.
// Deploy: supabase functions deploy admin-reset-password
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Who is calling? Must be a logged user whose profile is flagged admin.
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: caller } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!caller.user) return json({ error: 'Not authenticated' }, 401)
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', caller.user.id)
    .single()
  if (!callerProfile?.is_admin) return json({ error: 'Admin only' }, 403)

  const { teamId, password } = await req.json().catch(() => ({}))
  if (!Number.isInteger(teamId) || typeof password !== 'string' || password.length < 8) {
    return json({ error: 'teamId and a password of at least 8 characters are required' }, 400)
  }

  const { data: target } = await admin.from('profiles').select('user_id').eq('team_id', teamId).single()
  if (!target) return json({ error: 'Team not found' }, 404)

  const { error } = await admin.auth.admin.updateUserById(target.user_id, { password })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
})
