-- SKINSIGHT: saved consultations (conversation history)
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Additive only: creates one new table in the "public" schema. It does not touch auth.users or any
-- existing table, and it is safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- What is stored: the TEXT of the user's chat messages and the assistant's replies (photos are NOT stored;
-- a photo turn is saved as the text "[Image Attached]"), a title, and the generated summary (if any).
-- Each row belongs to one user and Row Level Security lets a user see and change only their own rows.
--
-- To undo (this deletes all saved consultations): drop table public.consultations cascade;

create table if not exists public.consultations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'New consultation',
  messages    jsonb not null default '[]'::jsonb,
  summary     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint consultations_title_len     check (char_length(title) <= 120),
  constraint consultations_messages_arr  check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 100),
  constraint consultations_messages_size check (pg_column_size(messages) <= 500000),
  constraint consultations_summary_obj   check (summary is null or (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 20000))
);

create index if not exists consultations_user_updated_idx
  on public.consultations (user_id, updated_at desc);

-- Keep updated_at current on every change.
create or replace function public.consultations_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists consultations_touch_trg on public.consultations;
create trigger consultations_touch_trg
  before update on public.consultations
  for each row execute function public.consultations_touch();

-- Limit how many consultations one account can store (protects the free-tier database).
create or replace function public.consultations_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.consultations where user_id = new.user_id) >= 50 then
    raise exception 'Consultation limit reached (50). Delete an older consultation first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_limit_trg on public.consultations;
create trigger consultations_limit_trg
  before insert on public.consultations
  for each row execute function public.consultations_limit();

-- Row Level Security: a signed-in user can only touch rows where user_id = their own id.
alter table public.consultations enable row level security;

drop policy if exists "consultations_select_own" on public.consultations;
create policy "consultations_select_own" on public.consultations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "consultations_insert_own" on public.consultations;
create policy "consultations_insert_own" on public.consultations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "consultations_update_own" on public.consultations;
create policy "consultations_update_own" on public.consultations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "consultations_delete_own" on public.consultations;
create policy "consultations_delete_own" on public.consultations
  for delete to authenticated using (user_id = auth.uid());

-- Signed-out visitors (the public "anon" role) get no access at all.
revoke all on public.consultations from anon;
grant select, insert, update, delete on public.consultations to authenticated;
