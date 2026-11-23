-- SKINSIGHT: medication push reminder subscriptions.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Only the backend touches this table, using the SERVICE ROLE key (set SUPABASE_SERVICE_ROLE_KEY on Render).
-- Row Level Security is enabled with NO policies, so the public anon key used by the website cannot read or
-- write it. The service role bypasses RLS.

create table if not exists public.push_subscriptions (
  endpoint      text primary key,
  subscription  jsonb       not null,
  medications   jsonb       not null default '[]'::jsonb,
  completed     jsonb       not null default '[]'::jsonb,
  timezone      text        not null default 'UTC',
  last_sent     jsonb       not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
