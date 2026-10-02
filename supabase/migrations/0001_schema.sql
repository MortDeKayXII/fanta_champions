-- Fanta Champions – schema, triggers and row level security.
-- Run once in the Supabase SQL Editor, then run seed.sql.

create type league as enum ('A', 'B', 'C');
create type matchday_phase as enum ('group', 'playoff', 'r16', 'quarter', 'semi', 'final');
create type report_status as enum ('open', 'resolved', 'rejected');

-- ---------------------------------------------------------------- reference data

create table teams (
  id     smallint primary key,
  name   text not null unique,
  slug   text not null unique,
  league league not null
);

create table players (
  id           integer primary key,          -- Fantacalcio "Id" (= "Cod." in the votes file)
  name         text not null,
  role         char(1) not null check (role in ('P', 'D', 'C', 'A')),
  mantra_roles text not null default '',
  serie_a_team text not null default ''
);

-- Links an auth user to a team. Written only with the service role key (create_users script).
create table profiles (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  team_id  smallint not null unique references teams (id),
  is_admin boolean not null default false
);

-- ---------------------------------------------------------------- rosters

create table roster_entries (
  team_id   smallint not null references teams (id),
  player_id integer  not null references players (id),
  cost      integer  not null default 0,
  primary key (team_id, player_id)
);

create table roster_history (
  id         bigint generated always as identity primary key,
  team_id    smallint not null references teams (id),
  player_id  integer  not null references players (id),
  action     text not null check (action in ('add', 'remove', 'cost')),
  cost       integer,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- competition

create table matchdays (
  number smallint primary key,                -- Champions matchday (matchday_N in the votes file)
  phase  matchday_phase not null,
  leg    smallint not null default 1 check (leg in (1, 2))
);

create table fixtures (
  id        integer generated always as identity primary key,
  matchday  smallint not null references matchdays (number),
  home_team smallint not null references teams (id),
  away_team smallint not null references teams (id),
  tie_id    text,                              -- knockout tie id, e.g. 'PO-9-24'
  check (home_team <> away_team)
);
create index fixtures_matchday_idx on fixtures (matchday);

-- Raw rows of the uploaded votes file. Admin only (official file, personal use).
create table votes (
  matchday  smallint not null references matchdays (number),
  player_id integer  not null,
  vote      numeric,                           -- null = s.v.
  gf smallint not null default 0,
  gs smallint not null default 0,
  rp smallint not null default 0,
  rs smallint not null default 0,
  rf smallint not null default 0,
  au smallint not null default 0,
  amm smallint not null default 0,
  esp smallint not null default 0,
  ass smallint not null default 0,
  primary key (matchday, player_id)
);

-- Final lineups entered by the admin. Lineups are NOT tied to the roster: any player is allowed.
-- vote / fantavoto / counted / stats are filled by "Calcola giornata" and overwritten on recompute.
create table lineups (
  matchday         smallint not null references matchdays (number),
  team_id          smallint not null references teams (id),
  slot             smallint not null check (slot between 1 and 11),
  player_id        integer references players (id),   -- null = hole
  player_name      text,                              -- snapshot
  out_of_position  boolean not null default false,    -- -1 malus
  vote             numeric,
  fantavoto        numeric,
  counted          boolean,
  stats            jsonb,
  primary key (matchday, team_id, slot)
);

create table results (
  fixture_id  integer primary key references fixtures (id) on delete cascade,
  home_goals  smallint not null,
  away_goals  smallint not null,
  home_points numeric  not null,
  away_points numeric  not null,
  computed_at timestamptz not null default now()
);

-- Admin's manual choice for knockout ties that are level on goals and points.
create table tie_decisions (
  tie_id      text primary key,
  winner_team smallint not null references teams (id),
  decided_at  timestamptz not null default now()
);

create table error_reports (
  id         bigint generated always as identity primary key,
  team_id    smallint not null references teams (id),
  matchday   smallint references matchdays (number),
  fixture_id integer references fixtures (id) on delete set null,
  player_id  integer references players (id),
  message    text not null check (char_length(message) between 1 and 1000),
  status     report_status not null default 'open',
  admin_note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid()), false)
$$;

create function my_team_id() returns smallint
language sql stable security definer set search_path = public as $$
  select team_id from profiles where user_id = auth.uid()
$$;

-- Every roster change is logged with who made it.
create function log_roster_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into roster_history (team_id, player_id, action, cost, changed_by)
    values (new.team_id, new.player_id, 'add', new.cost, auth.uid());
  elsif tg_op = 'DELETE' then
    insert into roster_history (team_id, player_id, action, cost, changed_by)
    values (old.team_id, old.player_id, 'remove', old.cost, auth.uid());
  elsif new.cost is distinct from old.cost then
    insert into roster_history (team_id, player_id, action, cost, changed_by)
    values (new.team_id, new.player_id, 'cost', new.cost, auth.uid());
  end if;
  return null;
end $$;

create trigger roster_entries_log
after insert or update or delete on roster_entries
for each row execute function log_roster_change();

-- ---------------------------------------------------------------- row level security

alter table teams          enable row level security;
alter table players        enable row level security;
alter table profiles       enable row level security;
alter table roster_entries enable row level security;
alter table roster_history enable row level security;
alter table matchdays      enable row level security;
alter table fixtures       enable row level security;
alter table votes          enable row level security;
alter table lineups        enable row level security;
alter table results        enable row level security;
alter table tie_decisions  enable row level security;
alter table error_reports  enable row level security;

-- Public read (the logged-out homepage shows standings and results).
create policy "public read" on teams          for select using (true);
create policy "public read" on players        for select using (true);
create policy "public read" on roster_entries for select using (true);
create policy "public read" on matchdays      for select using (true);
create policy "public read" on fixtures       for select using (true);
create policy "public read" on lineups        for select using (true);
create policy "public read" on results        for select using (true);
create policy "public read" on tie_decisions  for select using (true);

-- Admin writes everything that is competition data.
create policy "admin write" on teams         for all using (is_admin()) with check (is_admin());
create policy "admin write" on players       for all using (is_admin()) with check (is_admin());
create policy "admin write" on matchdays     for all using (is_admin()) with check (is_admin());
create policy "admin write" on fixtures      for all using (is_admin()) with check (is_admin());
create policy "admin write" on lineups       for all using (is_admin()) with check (is_admin());
create policy "admin write" on results       for all using (is_admin()) with check (is_admin());
create policy "admin write" on tie_decisions for all using (is_admin()) with check (is_admin());
create policy "admin only"  on votes         for all using (is_admin()) with check (is_admin());

-- Rosters: a user edits only their own team; the admin edits any team.
create policy "own or admin write" on roster_entries for all
  using (team_id = my_team_id() or is_admin())
  with check (team_id = my_team_id() or is_admin());

-- History is readable by logged users and written only by the trigger above.
create policy "logged read" on roster_history for select to authenticated using (true);

-- Profiles: everyone sees their own row, the admin sees all. No client writes.
create policy "own or admin read" on profiles for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Error reports: users file and read their own; the admin manages all.
create policy "own or admin read" on error_reports for select to authenticated
  using (team_id = my_team_id() or is_admin());
create policy "own insert" on error_reports for insert to authenticated
  with check (team_id = my_team_id() and status = 'open' and admin_note is null);
create policy "admin manage" on error_reports for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- privileges
-- Row level security decides who can do what; grants only expose the tables to the API.

grant usage on schema public to anon, authenticated;
grant select on teams, players, roster_entries, matchdays, fixtures, lineups, results, tie_decisions
  to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke insert, update, delete on roster_history, profiles from authenticated;
