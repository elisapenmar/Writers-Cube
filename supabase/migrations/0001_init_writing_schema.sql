-- Writer's Cube V0.5 initial schema
-- Applied via Supabase MCP on 2026-05-11; kept here for source-controlled history.

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'Untitled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  title text not null default 'Untitled chapter',
  position int not null,
  created_at timestamptz not null default now()
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters on delete cascade not null,
  title text not null default 'Untitled scene',
  position int not null,
  content jsonb,
  word_count int not null default 0,
  updated_at timestamptz not null default now()
);

create index chapters_project_position_idx on chapters(project_id, position);
create index scenes_chapter_position_idx on scenes(chapter_id, position);

alter table projects enable row level security;
alter table chapters enable row level security;
alter table scenes   enable row level security;

create policy "owner_all" on projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner_all" on chapters
  for all using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );

create policy "owner_all" on scenes
  for all using (
    exists (
      select 1 from chapters c
      join projects p on p.id = c.project_id
      where c.id = chapter_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from chapters c
      join projects p on p.id = c.project_id
      where c.id = chapter_id and p.user_id = auth.uid()
    )
  );
