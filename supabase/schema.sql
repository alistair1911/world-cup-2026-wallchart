create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_key text not null unique check (user_key in ('tata', 'lucas')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  code text not null,
  flag text not null,
  group_letter text not null,
  seed integer not null
);

create table if not exists public.matches (
  id text primary key,
  match_number integer not null,
  phase text not null,
  group_letter text,
  kickoff timestamptz not null,
  venue text not null,
  home_team_id text,
  away_team_id text,
  home_seed_label text,
  away_seed_label text,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  penalty_winner_id text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  home_score integer,
  away_score integer,
  predicted_winner_team_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  player_id text not null,
  player_name text not null,
  team_id text not null,
  goals integer not null default 0 check (goals >= 0 and goals <= 20),
  assists integer not null default 0 check (assists >= 0 and assists <= 20),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists public.team_squads (
  team_id text primary key,
  provider text not null default 'api-football',
  provider_team_id integer,
  provider_team_name text,
  provider_logo_url text,
  formation text,
  players jsonb not null default '[]'::jsonb,
  source text not null default 'api-football-squad',
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id text primary key,
  team_id text not null,
  name text not null,
  age integer,
  shirt_number integer,
  position text not null default 'Player',
  photo_url text,
  provider text not null default 'api-football',
  provider_player_id text,
  source text not null default 'api-football-squad',
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, provider, provider_player_id)
);

create table if not exists public.fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  formation text not null default '4-3-3',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.fantasy_teams
  add column if not exists formation text not null default '4-3-3';

create table if not exists public.fantasy_rounds (
  id text primary key,
  name text not null,
  starts_at timestamptz,
  locks_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.fantasy_rounds (id, name)
values ('global', 'Tournament Mini-Fantasy')
on conflict (id) do nothing;

create table if not exists public.fantasy_rosters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id text not null references public.fantasy_rounds(id) default 'global',
  player_id text not null,
  slot_index integer not null check (slot_index >= 0 and slot_index < 15),
  is_starter boolean not null default true,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, round_id, player_id),
  unique (user_id, round_id, slot_index)
);

create table if not exists public.fantasy_player_match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  player_id text not null,
  team_id text not null,
  points integer not null default 0,
  goals integer not null default 0 check (goals >= 0 and goals <= 20),
  assists integer not null default 0 check (assists >= 0 and assists <= 20),
  clean_sheet boolean not null default false,
  yellow_cards integer not null default 0 check (yellow_cards >= 0 and yellow_cards <= 2),
  red_cards integer not null default 0 check (red_cards >= 0 and red_cards <= 1),
  own_goals integer not null default 0 check (own_goals >= 0 and own_goals <= 5),
  penalty_saves integer not null default 0 check (penalty_saves >= 0 and penalty_saves <= 5),
  penalty_misses integer not null default 0 check (penalty_misses >= 0 and penalty_misses <= 5),
  breakdown jsonb not null default '{}'::jsonb,
  status text not null default 'confirmed' check (status in ('confirmed', 'needs_review')),
  provider text not null default 'espn',
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists public.fantasy_score_overrides (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  player_id text not null,
  points integer,
  goals integer,
  assists integer,
  clean_sheet boolean,
  yellow_cards integer,
  red_cards integer,
  own_goals integer,
  penalty_saves integer,
  penalty_misses integer,
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists comments_match_id_created_at_idx
  on public.comments (match_id, created_at);

create index if not exists player_match_stats_match_id_idx
  on public.player_match_stats (match_id);

create index if not exists player_match_stats_player_id_idx
  on public.player_match_stats (player_id);

create index if not exists team_squads_fetched_at_idx
  on public.team_squads (fetched_at);

create index if not exists players_team_id_idx
  on public.players (team_id);

create index if not exists players_provider_player_id_idx
  on public.players (provider_player_id);

create index if not exists fantasy_rosters_user_round_idx
  on public.fantasy_rosters (user_id, round_id);

create index if not exists fantasy_scores_match_idx
  on public.fantasy_player_match_scores (match_id);

create index if not exists fantasy_scores_player_idx
  on public.fantasy_player_match_scores (player_id);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.comments enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.team_squads enable row level security;
alter table public.players enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.fantasy_rounds enable row level security;
alter table public.fantasy_rosters enable row level security;
alter table public.fantasy_player_match_scores enable row level security;
alter table public.fantasy_score_overrides enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant select on public.profiles, public.teams, public.matches, public.predictions, public.comments, public.player_match_stats, public.team_squads, public.players, public.fantasy_teams, public.fantasy_rounds, public.fantasy_rosters, public.fantasy_player_match_scores, public.fantasy_score_overrides to authenticated;
grant insert, update on public.profiles, public.matches, public.predictions, public.comments, public.player_match_stats, public.fantasy_teams, public.fantasy_rosters, public.fantasy_score_overrides to authenticated;
grant delete on public.fantasy_rosters to authenticated;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Authenticated users can read teams" on public.teams;
create policy "Authenticated users can read teams"
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read matches" on public.matches;
create policy "Authenticated users can read matches"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create match rows" on public.matches;
create policy "Authenticated users can create match rows"
  on public.matches for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update match scores" on public.matches;
create policy "Authenticated users can update match scores"
  on public.matches for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read predictions" on public.predictions;
create policy "Authenticated users can read predictions"
  on public.predictions for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own predictions" on public.predictions;
create policy "Users can create their own predictions"
  on public.predictions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own predictions" on public.predictions;
create policy "Users can update their own predictions"
  on public.predictions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read comments"
  on public.comments for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read player stats" on public.player_match_stats;
create policy "Authenticated users can read player stats"
  on public.player_match_stats for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create player stats" on public.player_match_stats;
create policy "Authenticated users can create player stats"
  on public.player_match_stats for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update player stats" on public.player_match_stats;
create policy "Authenticated users can update player stats"
  on public.player_match_stats for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read team squads" on public.team_squads;
create policy "Authenticated users can read team squads"
  on public.team_squads for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read players" on public.players;
create policy "Authenticated users can read players"
  on public.players for select
  to authenticated
  using (true);

drop policy if exists "Users can read fantasy teams" on public.fantasy_teams;
create policy "Users can read fantasy teams"
  on public.fantasy_teams for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own fantasy team" on public.fantasy_teams;
create policy "Users can create their own fantasy team"
  on public.fantasy_teams for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own fantasy team" on public.fantasy_teams;
create policy "Users can update their own fantasy team"
  on public.fantasy_teams for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read fantasy rounds" on public.fantasy_rounds;
create policy "Authenticated users can read fantasy rounds"
  on public.fantasy_rounds for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read fantasy rosters" on public.fantasy_rosters;
create policy "Authenticated users can read fantasy rosters"
  on public.fantasy_rosters for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own fantasy roster" on public.fantasy_rosters;
create policy "Users can create their own fantasy roster"
  on public.fantasy_rosters for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own fantasy roster" on public.fantasy_rosters;
create policy "Users can update their own fantasy roster"
  on public.fantasy_rosters for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own fantasy roster" on public.fantasy_rosters;
create policy "Users can delete their own fantasy roster"
  on public.fantasy_rosters for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can read fantasy scores" on public.fantasy_player_match_scores;
create policy "Authenticated users can read fantasy scores"
  on public.fantasy_player_match_scores for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read fantasy score overrides" on public.fantasy_score_overrides;
create policy "Authenticated users can read fantasy score overrides"
  on public.fantasy_score_overrides for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create fantasy score overrides" on public.fantasy_score_overrides;
create policy "Authenticated users can create fantasy score overrides"
  on public.fantasy_score_overrides for insert
  to authenticated
  with check (updated_by = auth.uid());

drop policy if exists "Authenticated users can update fantasy score overrides" on public.fantasy_score_overrides;
create policy "Authenticated users can update fantasy score overrides"
  on public.fantasy_score_overrides for update
  to authenticated
  using (updated_by = auth.uid())
  with check (updated_by = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_predictions_updated_at on public.predictions;
create trigger set_predictions_updated_at
before update on public.predictions
for each row execute function public.set_updated_at();

drop trigger if exists set_player_match_stats_updated_at on public.player_match_stats;
create trigger set_player_match_stats_updated_at
before update on public.player_match_stats
for each row execute function public.set_updated_at();

drop trigger if exists set_team_squads_updated_at on public.team_squads;
create trigger set_team_squads_updated_at
before update on public.team_squads
for each row execute function public.set_updated_at();

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists set_fantasy_teams_updated_at on public.fantasy_teams;
create trigger set_fantasy_teams_updated_at
before update on public.fantasy_teams
for each row execute function public.set_updated_at();

drop trigger if exists set_fantasy_rosters_updated_at on public.fantasy_rosters;
create trigger set_fantasy_rosters_updated_at
before update on public.fantasy_rosters
for each row execute function public.set_updated_at();

drop trigger if exists set_fantasy_scores_updated_at on public.fantasy_player_match_scores;
create trigger set_fantasy_scores_updated_at
before update on public.fantasy_player_match_scores
for each row execute function public.set_updated_at();

drop trigger if exists set_fantasy_score_overrides_updated_at on public.fantasy_score_overrides;
create trigger set_fantasy_score_overrides_updated_at
before update on public.fantasy_score_overrides
for each row execute function public.set_updated_at();

-- After creating the two Auth users, replace the UUIDs below and run:
-- insert into public.profiles (id, user_key, display_name)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'tata', 'Tata'),
--   ('11111111-1111-1111-1111-111111111111', 'lucas', 'Lucas')
-- on conflict (id) do update set user_key = excluded.user_key, display_name = excluded.display_name;
