-- SKINSIGHT: medication tracker (medications and dose logs)
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Additive only: creates tables in the "public" schema with Row Level Security.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- What is stored:
-- 1. public.medications: names, schedules, dose times, notes, and created date per user.
-- 2. public.medication_logs: dose completion logs (timestamp and slot key).
-- Row Level Security guarantees a signed-in user can only read and mutate their own rows.
-- Signed-out visitors (anon role) get no access.

-- ============================================================================
-- 1. public.medications
-- ============================================================================
create table if not exists public.medications (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  schedule    text not null default 'once_daily',
  frequency   text not null default 'daily',
  dose_time   text not null default '09:00',
  notes       text not null default '',
  created_at  text not null default to_char(current_date, 'YYYY-MM-DD'),
  updated_at  timestamptz not null default now(),

  constraint medications_name_len      check (char_length(name) <= 80),
  constraint medications_notes_len     check (char_length(notes) <= 300),
  constraint medications_schedule_val  check (schedule in ('once_daily', 'twice_daily', 'every_other_day')),
  constraint medications_frequency_val check (frequency in ('daily', 'weekly', 'as_needed'))
);

create index if not exists medications_user_idx
  on public.medications (user_id, updated_at desc);

-- Keep updated_at current on every change.
create or replace function public.medications_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists medications_touch_trg on public.medications;
create trigger medications_touch_trg
  before update on public.medications
  for each row execute function public.medications_touch();

-- Limit how many medications one account can store (protects the free-tier database).
create or replace function public.medications_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.medications where user_id = new.user_id) >= 30 then
    raise exception 'Medication limit reached (30). Remove an older medication first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists medications_limit_trg on public.medications;
create trigger medications_limit_trg
  before insert on public.medications
  for each row execute function public.medications_limit();

-- Row Level Security for medications
alter table public.medications enable row level security;

drop policy if exists "medications_select_own" on public.medications;
create policy "medications_select_own" on public.medications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "medications_insert_own" on public.medications;
create policy "medications_insert_own" on public.medications
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "medications_update_own" on public.medications;
create policy "medications_update_own" on public.medications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "medications_delete_own" on public.medications;
create policy "medications_delete_own" on public.medications
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.medications from anon;
grant select, insert, update, delete on public.medications to authenticated;


-- ============================================================================
-- 2. public.medication_logs
-- ============================================================================
create table if not exists public.medication_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medication_id text not null references public.medications (id) on delete cascade,
  slot_key      text not null,
  logged_at     bigint not null,
  created_at    timestamptz not null default now(),

  constraint medication_logs_user_slot_uniq unique (user_id, medication_id, slot_key)
);

create index if not exists medication_logs_user_med_idx
  on public.medication_logs (user_id, medication_id);

-- Row Level Security for medication_logs
alter table public.medication_logs enable row level security;

drop policy if exists "medication_logs_select_own" on public.medication_logs;
create policy "medication_logs_select_own" on public.medication_logs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "medication_logs_insert_own" on public.medication_logs;
create policy "medication_logs_insert_own" on public.medication_logs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "medication_logs_delete_own" on public.medication_logs;
create policy "medication_logs_delete_own" on public.medication_logs
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.medication_logs from anon;
grant select, insert, delete on public.medication_logs to authenticated;
