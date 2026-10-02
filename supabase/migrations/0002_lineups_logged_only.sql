-- Per-player votes (stored on lineups after "Calcola giornata") are visible to logged users only.
-- The logged-out homepage still sees teams, fixtures, results and rosters.

drop policy "public read" on lineups;
create policy "logged read" on lineups for select to authenticated using (true);

-- Supabase may grant new tables to anon by default: make sure anon has nothing on private tables.
revoke all on lineups, votes, profiles, error_reports, roster_history from anon;
