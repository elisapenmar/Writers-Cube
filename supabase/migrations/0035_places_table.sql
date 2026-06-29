-- Places: locations/settings in a project's Story Bible. Mirrors the characters
-- table so Smart Text can recognize place names in the prose and link them to
-- their notes. `category` is a short free-form descriptor (city, tavern, planet).
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  name text not null default 'New place',
  category text,
  description text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_user_position_idx on places(user_id, position);
create index if not exists places_project_id_idx on places(project_id);

alter table places enable row level security;
create policy "owner_all" on places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
