-- Poetry collections (chapbooks): a way to group a poetry project's poems under
-- a named collection, matching the `collection` structure model. A project can
-- hold several collections; each poem (scene) may belong to at most one. The
-- grouping is optional and additive, so existing poems stay ungrouped until the
-- writer files them.
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  title text not null default 'New collection',
  description text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_project_position_idx
  on collections(project_id, position);
create index if not exists collections_user_id_idx on collections(user_id);

alter table collections enable row level security;
create policy "owner_all" on collections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A poem's collection membership. Nullable: null means the poem is unfiled.
-- on delete set null so deleting a collection keeps its poems, just unfiled.
alter table scenes
  add column if not exists collection_id uuid
  references collections(id) on delete set null;

create index if not exists scenes_collection_id_idx on scenes(collection_id);
