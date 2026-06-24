-- Inspirations: bits of inspiration users copy/paste or type from things they
-- read (global per user, not tied to a project). Surfaced on the dashboard,
-- alongside Story kernels. `source` records where the excerpt came from.

create table if not exists inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  body text not null default '',
  source text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspirations_user_idx on inspirations(user_id, position, created_at desc);
alter table inspirations enable row level security;
create policy "owner_all" on inspirations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
