-- Loose/uncategorized scenes: writable items that live under a project's
-- "Uncategorized" nav section, separate from the chapter/scene hierarchy.

create table if not exists loose_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects on delete cascade not null,
  title text not null default 'Untitled',
  content jsonb,
  word_count int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loose_scenes_project_idx on loose_scenes(project_id, position, created_at desc);
alter table loose_scenes enable row level security;
create policy "owner_all" on loose_scenes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
