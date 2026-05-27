-- ============================================================
-- Tokenia Phase 3 — initial schema
-- Run in: Supabase Dashboard → SQL Editor
-- Re-runnable: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- 1. profiles
--    One row per auth.users record.
--    plan is assigned MANUALLY from Supabase dashboard.
--    Stripe / checkout intentionally absent.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text,
  plan                 text not null default 'free'
                          check (plan in ('free', 'pro', 'team')),
  credits_remaining    integer not null default 0,
  monthly_token_limit  integer not null default 50000,  -- overridden by plan trigger
  monthly_tokens_used  integer not null default 0,
  billing_month        text not null default to_char(now(), 'YYYY-MM'),
  role                 text not null default 'user'
                          check (role in ('user', 'admin')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Auto-create profile on signup (trigger on auth.users)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, plan, monthly_token_limit)
  values (
    new.id,
    new.email,
    'free',
    50000   -- free plan default
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on any change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── Helper: update monthly_token_limit when plan changes ──────────────────────
-- Call this manually or extend the trigger if you want auto-sync.
-- Plan limits:  free=50000  pro=1000000  team=5000000
create or replace function public.sync_plan_limit(p_user_id uuid, p_plan text)
returns void language plpgsql security definer as $$
declare
  new_limit integer;
begin
  new_limit := case p_plan
    when 'pro'  then 1000000
    when 'team' then 5000000
    else 50000
  end;
  update public.profiles
  set    plan = p_plan, monthly_token_limit = new_limit
  where  id   = p_user_id;
end;
$$;

-- ── Helper: reset monthly counter when billing month rolls over ───────────────
create or replace function public.maybe_reset_monthly_tokens(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  current_month text := to_char(now(), 'YYYY-MM');
begin
  update public.profiles
  set    monthly_tokens_used = 0, billing_month = current_month
  where  id            = p_user_id
    and  billing_month <> current_month;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2. usage_events
--    Append-only log; server writes via service_role key.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.usage_events (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete set null,
  session_id       text,               -- anonymous session identifier
  event_type       text not null,      -- 'count_text' | 'count_file' | 'clean' | 'retrieve' | 'export'
  model            text,               -- 'openai:gpt-4o' etc.
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0,
  estimated_cost   numeric(12,8) default 0,
  plan_at_time     text not null default 'free',
  filename         text,
  metadata         jsonb default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists usage_events_user_id_idx  on public.usage_events (user_id);
create index if not exists usage_events_created_idx  on public.usage_events (created_at desc);
create index if not exists usage_events_type_idx     on public.usage_events (event_type);

-- ══════════════════════════════════════════════════════════════
-- 3. projects
--    Pro/Team only (enforced in server, not DB).
-- ══════════════════════════════════════════════════════════════
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 4. documents
--    Saved document analyses.
--    cleaned_text stored only if user explicitly saves.
--    expires_at for temporary (unsaved) documents.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.documents (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  project_id                uuid references public.projects(id) on delete set null,
  original_filename         text,
  file_type                 text,
  original_size_bytes       integer,
  cleaned_text_saved        boolean not null default false,
  cleaned_text              text,          -- null until user saves it
  token_count_before        integer,
  token_count_after         integer,
  estimated_savings_percent numeric(5,2),
  created_at                timestamptz not null default now(),
  expires_at                timestamptz     -- null = kept; set to 24h for unsaved docs
);

create index if not exists documents_user_id_idx   on public.documents (user_id);
create index if not exists documents_expires_idx   on public.documents (expires_at)
  where expires_at is not null;

-- ══════════════════════════════════════════════════════════════
-- 5. credit_ledger
--    All credit transactions (grants, consumes, refunds).
-- ══════════════════════════════════════════════════════════════
create table if not exists public.credit_ledger (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  change_amount integer not null,    -- positive = credit, negative = debit
  reason        text,
  balance_after integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);

-- ══════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════

alter table public.profiles      enable row level security;
alter table public.usage_events  enable row level security;
alter table public.projects      enable row level security;
alter table public.documents     enable row level security;
alter table public.credit_ledger enable row level security;

-- profiles: own row only (admin can read all — use service_role on server)
create policy "profiles: user reads own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: user updates own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    -- users cannot elevate their own plan or role
    plan  = (select plan  from public.profiles where id = auth.uid()) and
    role  = (select role  from public.profiles where id = auth.uid())
  );

-- usage_events: read own; server inserts via service_role (bypasses RLS)
create policy "usage_events: user reads own"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- projects: full CRUD on own rows
create policy "projects: user owns"
  on public.projects
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- documents: full CRUD on own rows
create policy "documents: user owns"
  on public.documents
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- credit_ledger: read own; server writes via service_role
create policy "credit_ledger: user reads own"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- Admin convenience: grant service_role broad access
-- (service_role bypasses RLS by default; this is just a reminder.)
-- To manually promote a user to pro from the Supabase SQL editor:
--
--   select public.sync_plan_limit('<user-uuid>', 'pro');
--
-- Or directly:
--   update public.profiles
--   set plan = 'pro', monthly_token_limit = 1000000
--   where id = '<user-uuid>';
-- ══════════════════════════════════════════════════════════════
