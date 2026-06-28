-- In-app feedback widget storage + an admin-only read surface.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  category text not null check (category in ('praise', 'issue', 'suggestion')),
  rating int check (rating between 1 and 5),
  title text not null default '',
  body text not null default '',
  screenshot_url text,
  page_url text,
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Admin gate (kept in SQL so RLS can use it). Add emails here as needed.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') in ('elisa.penmar@gmail.com'), false);
$$;

do $$ begin
  create policy "submit own feedback" on public.feedback
    for insert to authenticated with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins read feedback" on public.feedback
    for select to authenticated using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins update feedback" on public.feedback
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
