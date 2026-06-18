-- Per-user structured story outline. Tree stored as jsonb; one outline per user
-- in V0.5 (matches the single-project rule). Template name is informational.

create table outlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  template text not null default 'custom',
  tree jsonb not null default '{"id":"root","title":"My Outline","children":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index outlines_user_id_unique on outlines(user_id);

alter table outlines enable row level security;

create policy "owner_all" on outlines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
