-- ═══════════════════════════════════════════════════════════════
-- ApeCheck — Supabase Postgres schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- scans — GLOBAL cache (one row per token, refreshed on TTL).
-- Not user-scoped. Written by the service role (API routes / cron).
-- ─────────────────────────────────────────────────────────────
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  token_address text not null unique,
  risk_score integer,
  potential_score integer,
  dev_wallet_address text,
  dev_wallet_percent numeric,
  holder_count integer,
  top_holder_percent numeric,
  liquidity_usd numeric,
  lp_locked boolean,
  mint_authority_active boolean,
  freeze_authority_active boolean,
  token_age_hours integer,
  website_url text,
  x_handle text,
  telegram_url text,
  socials_verified jsonb,
  dex_listings jsonb,
  raw_data jsonb,
  scanned_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists scans_expires_at_idx on scans (expires_at);

-- ─────────────────────────────────────────────────────────────
-- watchlist — per-user saved tokens with dump-alert toggle.
-- ─────────────────────────────────────────────────────────────
create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  token_address text not null,
  dev_wallet_address text,
  initial_dev_balance numeric,
  alert_enabled boolean default true,
  -- Extended-alert reference snapshot (liquidity/authorities/price/top holders
  -- at watch time). Compared against fresh scans by the alert engine.
  baseline jsonb,
  created_at timestamptz default now(),
  unique (user_id, token_address)
);

-- Migrate an existing watchlist table.
alter table watchlist add column if not exists baseline jsonb;

create index if not exists watchlist_user_idx on watchlist (user_id);
create index if not exists watchlist_alert_idx on watchlist (alert_enabled) where alert_enabled = true;

-- ─────────────────────────────────────────────────────────────
-- telegram_chats — link a Telegram chat to a user for alert delivery.
-- A user runs /start <link_code> in the bot; the webhook binds the chat here.
-- ─────────────────────────────────────────────────────────────
create table if not exists telegram_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  chat_id text not null unique,
  username text,
  -- Short-lived code the user pastes into the bot to bind this chat.
  link_code text unique,
  linked boolean default false,
  created_at timestamptz default now(),
  unique (user_id, chat_id)
);

create index if not exists telegram_chats_user_idx on telegram_chats (user_id);
create index if not exists telegram_chats_linkcode_idx on telegram_chats (link_code) where link_code is not null;

-- ─────────────────────────────────────────────────────────────
-- alerts — triggered alert events (dev dump + extended signals:
-- lp_pull, authority_reenabled, price_drop, big_holder_sell).
-- ─────────────────────────────────────────────────────────────
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid references watchlist(id) on delete cascade not null,
  token_address text not null,
  alert_type text not null default 'dev_dump',
  title text,
  body text,
  detail jsonb,
  -- Legacy dev-dump columns (kept for back-compat + the alerts UI).
  dev_wallet_address text,
  balance_before numeric,
  balance_after numeric,
  percent_dropped numeric,
  -- Monotonic dedupe value for the latest alert of this (watchlist_id, alert_type).
  dedupe_value numeric,
  triggered_at timestamptz default now(),
  notified boolean default false
);

-- Migrate an existing alerts table (added columns are no-ops if already present).
alter table alerts add column if not exists alert_type text not null default 'dev_dump';
alter table alerts add column if not exists title text;
alter table alerts add column if not exists body text;
alter table alerts add column if not exists detail jsonb;
alter table alerts add column if not exists dedupe_value numeric;

create index if not exists alerts_watchlist_idx on alerts (watchlist_id);
create index if not exists alerts_watchlist_type_idx on alerts (watchlist_id, alert_type, triggered_at desc);

-- ─────────────────────────────────────────────────────────────
-- push_tokens — device push tokens per user.
-- ─────────────────────────────────────────────────────────────
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  token text not null,
  platform text check (platform in ('ios','android','web')),
  created_at timestamptz default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

-- ─────────────────────────────────────────────────────────────
-- scan_history — per-user recent scans (for the "recent scans" UI).
-- ─────────────────────────────────────────────────────────────
create table if not exists scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  token_address text not null,
  scanned_at timestamptz default now()
);

create index if not exists scan_history_user_idx on scan_history (user_id, scanned_at desc);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════

-- scans: readable by anyone (public cache), writable only by service role.
alter table scans enable row level security;

drop policy if exists "scans public read" on scans;
create policy "scans public read" on scans
  for select using (true);
-- No insert/update/delete policy → only the service-role key (which bypasses RLS)
-- can write. Anon/auth clients can read the cache but never mutate it.

-- watchlist: owner-only.
alter table watchlist enable row level security;

drop policy if exists "watchlist owner all" on watchlist;
create policy "watchlist owner all" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- alerts: owner reads via the parent watchlist row.
alter table alerts enable row level security;

drop policy if exists "alerts owner read" on alerts;
create policy "alerts owner read" on alerts
  for select using (
    exists (
      select 1 from watchlist w
      where w.id = alerts.watchlist_id and w.user_id = auth.uid()
    )
  );
-- Inserts happen from the cron via service role (bypasses RLS).

-- push_tokens: owner-only.
alter table push_tokens enable row level security;

drop policy if exists "push_tokens owner all" on push_tokens;
create policy "push_tokens owner all" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- scan_history: owner-only.
alter table scan_history enable row level security;

drop policy if exists "scan_history owner all" on scan_history;
create policy "scan_history owner all" on scan_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- telegram_chats: owner-only. The bot webhook writes via the service role (bypasses RLS).
alter table telegram_chats enable row level security;

drop policy if exists "telegram_chats owner all" on telegram_chats;
create policy "telegram_chats owner all" on telegram_chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Helper: trim scan_history to the most recent 50 rows per user.
-- (Optional — call from a trigger or the app.)
-- ═══════════════════════════════════════════════════════════════
create or replace function trim_scan_history() returns trigger as $$
begin
  delete from scan_history
  where user_id = new.user_id
    and id not in (
      select id from scan_history
      where user_id = new.user_id
      order by scanned_at desc
      limit 50
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trim_scan_history_trg on scan_history;
create trigger trim_scan_history_trg
  after insert on scan_history
  for each row execute function trim_scan_history();

-- ─────────────────────────────────────────────────────────────
-- wallet_scan_history — per-user history of scanned wallets (Tracker tab).
-- `summary` snapshots the headline metrics for the history table so the list
-- renders without re-scanning every wallet.
-- ─────────────────────────────────────────────────────────────
create table if not exists wallet_scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  wallet_address text not null,
  summary jsonb,
  scanned_at timestamptz default now()
);

create index if not exists wallet_scan_history_user_idx
  on wallet_scan_history (user_id, scanned_at desc);

alter table wallet_scan_history enable row level security;

drop policy if exists "wallet_scan_history owner all" on wallet_scan_history;
create policy "wallet_scan_history owner all" on wallet_scan_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- profiles — one row per auth user. Holds account_type (REGULAR / PRO).
-- Auto-created by an auth.users trigger; account_type is written only by the
-- service role (the /api/profile route), never directly by clients.
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'REGULAR' check (account_type in ('REGULAR','PRO')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Owner may read their own profile. No client insert/update/delete policy →
-- account_type is mutated only via the service role (bypasses RLS).
drop policy if exists "profiles owner read" on profiles;
create policy "profiles owner read" on profiles
  for select using (auth.uid() = id);

-- Create a profile row automatically whenever a new auth user signs up
-- (email/password OR Google OAuth). security definer so it bypasses RLS.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for any users created before this table existed.
insert into profiles (id) select id from auth.users on conflict (id) do nothing;
