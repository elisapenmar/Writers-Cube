-- Items: objects/artifacts in a project's Story Bible. Mirrors the characters
-- table so Smart Text can recognize item names in the prose and link them to
-- their notes. `category` is a short free-form descriptor (weapon, relic, vehicle).
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  name text not null default 'New item',
  category text,
  description text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_position_idx on items(user_id, position);
create index if not exists items_project_id_idx on items(project_id);

alter table items enable row level security;
create policy "owner_all" on items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
