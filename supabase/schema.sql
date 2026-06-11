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

create index if not exists comments_match_id_created_at_idx
  on public.comments (match_id, created_at);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.comments enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant select on public.profiles, public.teams, public.matches, public.predictions, public.comments to authenticated;
grant insert, update on public.profiles, public.matches, public.predictions, public.comments to authenticated;

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

-- After creating the two Auth users, replace the UUIDs below and run:
-- insert into public.profiles (id, user_key, display_name)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'tata', 'Tata'),
--   ('11111111-1111-1111-1111-111111111111', 'lucas', 'Lucas')
-- on conflict (id) do update set user_key = excluded.user_key, display_name = excluded.display_name;
