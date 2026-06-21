-- Timestamped version history for scenes (Google-Docs-style restore points).
create table if not exists scene_versions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  word_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table scene_versions enable row level security;
do $$ begin
  create policy "own scene versions" on scene_versions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists scene_versions_scene_idx on scene_versions(scene_id, created_at desc);
