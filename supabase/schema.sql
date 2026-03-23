-- ============================================================
-- 🎾 Tennis Ranker — Supabase Database Schema
-- ============================================================

-- ── Profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text not null default '',
  avatar_url text,
  nationality text default '',  -- ISO 3166-1 alpha-2 country code
  elo integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Matches ─────────────────────────────────────────────────
create type match_format as enum ('singles', 'doubles');
create type match_type as enum ('best_of_3', 'tiebreaker_to_7');

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_format match_format not null default 'singles',
  match_type match_type not null default 'best_of_3',

  -- Singles: player1/player2; Doubles: player1+player3 vs player2+player4
  player1_id uuid references public.profiles(id) not null,
  player2_id uuid references public.profiles(id) not null,
  player3_id uuid references public.profiles(id),  -- doubles partner of player1
  player4_id uuid references public.profiles(id),  -- doubles partner of player2

  -- Score stored as JSON array of sets, e.g. [{"p1":6,"p2":3},{"p1":7,"p2":6}]
  score jsonb not null default '[]'::jsonb,

  winner_side smallint not null check (winner_side in (1, 2)),  -- 1 = player1 side, 2 = player2 side

  -- Elo snapshot at time of match
  player1_elo_before integer,
  player2_elo_before integer,
  player1_elo_after integer,
  player2_elo_after integer,

  played_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Matches are viewable by everyone"
  on matches for select using (true);

create policy "Authenticated users can create matches"
  on matches for insert with check (auth.uid() = created_by);

-- ── Achievements ────────────────────────────────────────────
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  unique(profile_id, achievement_key)
);

alter table public.achievements enable row level security;

create policy "Achievements are viewable by everyone"
  on achievements for select using (true);

create policy "System can insert achievements"
  on achievements for insert with check (auth.uid() = profile_id);

-- ── Player of the Week ──────────────────────────────────────
create table if not exists public.player_of_the_week (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,  -- Monday of that week
  wins_count integer not null,
  tiebreaker_elo integer not null default 0,  -- sum of beaten opponents' Elo
  created_at timestamptz not null default now(),
  unique(week_start)
);

alter table public.player_of_the_week enable row level security;

create policy "POTW viewable by everyone"
  on player_of_the_week for select using (true);

create policy "Authenticated users can insert POTW"
  on player_of_the_week for insert with check (auth.uid() is not null);

-- ── Indexes ─────────────────────────────────────────────────
create index if not exists idx_matches_player1 on matches(player1_id);
create index if not exists idx_matches_player2 on matches(player2_id);
create index if not exists idx_matches_played_at on matches(played_at);
create index if not exists idx_achievements_profile on achievements(profile_id);
create index if not exists idx_potw_week on player_of_the_week(week_start);

-- ── Storage bucket for avatars ──────────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
