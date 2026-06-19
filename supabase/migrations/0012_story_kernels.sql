-- Story kernels: a place to jot down undeveloped story ideas (global per user,
-- not tied to a project). Surfaced on the dashboard.

create table if not exists story_kernels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  body text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists story_kernels_user_idx on story_kernels(user_id, position, created_at desc);
alter table story_kernels enable row level security;
create policy "owner_all" on story_kernels
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
