-- Just In Time — initial schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- ─────────────────────────────────────────────────────────────
-- Profiles (one row per user, created automatically on sign-up)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_pro boolean not null default false,
  pro_expires_at timestamptz,
  precheck boolean not null default false,
  checking_bag boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- Users may update their own preferences, but NOT their Pro status
-- (is_pro is only written by the RevenueCat webhook using the service role).
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Column-level privileges only work once the table-wide UPDATE grant is removed.
revoke update on public.profiles from authenticated, anon;
grant update (precheck, checking_bag, onboarded) on public.profiles to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Trips (one tracked flight each)
-- ─────────────────────────────────────────────────────────────
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  flight_number text not null,            -- normalised, e.g. AA1204
  flight_date date not null,              -- local departure date
  airline text not null default '',
  status text not null default 'On time',
  origin_iata text not null default '',
  origin_name text not null default '',
  origin_lat double precision,
  origin_lon double precision,
  origin_tz text,
  destination_iata text not null default '',
  destination_name text not null default '',
  scheduled_departure timestamptz not null,
  estimated_departure timestamptz not null,
  scheduled_arrival timestamptz,
  duration_minutes integer,
  terminal text,
  gate text,
  boarding_group text,
  drive_minutes integer,
  drive_is_live boolean not null default false,
  drive_updated_at timestamptz,
  segment_overrides jsonb not null default '{}'::jsonb,
  milestones jsonb not null default '{}'::jsonb,  -- { left: iso, arrived: iso, security: iso, gate: iso }
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, flight_number, flight_date)
);

create index trips_user_departure_idx on public.trips (user_id, estimated_departure);
create index trips_refresh_idx on public.trips (estimated_departure) where status not in ('Departed', 'Canceled');

alter table public.trips enable row level security;

create policy "trips: read own" on public.trips for select using (auth.uid() = user_id);
create policy "trips: insert own" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips: update own" on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trips: delete own" on public.trips for delete using (auth.uid() = user_id);

-- Free plan limit: at most 2 upcoming trips unless Pro. Enforced in the database
-- so it can't be bypassed from a modified client.
create function public.enforce_trip_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  upcoming int;
  pro boolean;
begin
  select coalesce(is_pro, false) into pro from public.profiles where id = new.user_id;
  if pro then return new; end if;
  select count(*) into upcoming from public.trips
    where user_id = new.user_id and estimated_departure > now() - interval '6 hours';
  if upcoming >= 2 then
    raise exception 'FREE_TRIP_LIMIT' using hint = 'Upgrade to Pro for unlimited trips';
  end if;
  return new;
end;
$$;

create trigger trips_limit before insert on public.trips
  for each row execute function public.enforce_trip_limit();

-- ─────────────────────────────────────────────────────────────
-- Alerts feed (delay / gate change / cancellation history)
-- ─────────────────────────────────────────────────────────────
create table public.trip_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null,          -- delay | gate | cancel | status
  message text not null,
  created_at timestamptz not null default now()
);

create index trip_alerts_user_idx on public.trip_alerts (user_id, created_at desc);
alter table public.trip_alerts enable row level security;
create policy "alerts: read own" on public.trip_alerts for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Push tokens (Expo push tokens per device)
-- ─────────────────────────────────────────────────────────────
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'ios',
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
create policy "push: read own" on public.push_tokens for select using (auth.uid() = user_id);
create policy "push: insert own" on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "push: update own" on public.push_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push: delete own" on public.push_tokens for delete using (auth.uid() = user_id);

-- A device token can move between accounts (sign out → sign in as someone else),
-- which plain RLS upserts can't do, so registration goes through this function.
create function public.register_push_token(p_token text, p_platform text default 'ios')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
