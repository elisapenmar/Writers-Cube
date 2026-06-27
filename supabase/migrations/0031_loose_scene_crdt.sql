-- Durable CRDT snapshot for loose scenes (mirrors scene_crdt; see 0030).
-- Separate table because loose_scenes owns access via its own user_id, unlike
-- scenes (which resolve through chapter -> project).
create table if not exists loose_scene_crdt (
  loose_scene_id uuid primary key references loose_scenes(id) on delete cascade,
  state text not null,                       -- base64 of Y.encodeStateAsUpdate(doc)
  updated_at timestamptz not null default now()
);
alter table loose_scene_crdt enable row level security;
do $$ begin
  create policy "loose_scene_crdt_owner" on loose_scene_crdt
    for all using (
      exists (
        select 1 from loose_scenes l
        where l.id = loose_scene_crdt.loose_scene_id and l.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from loose_scenes l
        where l.id = loose_scene_crdt.loose_scene_id and l.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;