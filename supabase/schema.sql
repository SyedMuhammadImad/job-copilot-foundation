-- Apply to a dedicated Supabase project's SQL Editor, after reviewing existing data.
-- Existing invalid/null notes fail instead of deleting records.
begin;
create table if not exists public.resumes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 raw_text text not null,
 created_at timestamptz not null default now()
);
alter table public.resumes alter column user_id set default auth.uid();
alter table public.resumes alter column raw_text set not null;
alter table public.resumes drop constraint if exists resumes_text_bound;
alter table public.resumes add constraint resumes_text_bound
 check (char_length(raw_text) between 1 and 40000 and raw_text ~ '[^[:space:]]');
create index if not exists resumes_owner_created_idx on public.resumes(user_id,created_at desc);
alter table public.resumes enable row level security;
alter table public.resumes force row level security;
revoke all on public.resumes from public,anon,authenticated;
revoke all(id,user_id,raw_text,created_at) on public.resumes from public,anon,authenticated;
grant usage on schema public to authenticated;
grant select,delete on public.resumes to authenticated;
grant insert(raw_text),update(raw_text) on public.resumes to authenticated;
drop policy if exists select_own_resumes on public.resumes;
drop policy if exists insert_own_resumes on public.resumes;
drop policy if exists update_own_resumes on public.resumes;
drop policy if exists delete_own_resumes on public.resumes;
create policy select_own_resumes on public.resumes for select to authenticated
 using ((select auth.uid())=user_id);
create policy insert_own_resumes on public.resumes for insert to authenticated
 with check ((select auth.uid())=user_id);
create policy update_own_resumes on public.resumes for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy delete_own_resumes on public.resumes for delete to authenticated
 using ((select auth.uid())=user_id);
commit;
