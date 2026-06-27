-- Durable CRDT snapshot for live co-editing (Yjs). Holds the encoded Y.Doc so a
-- client opening alone still gets the latest converged state. Last-write-wins is
-- CORRECT here: any client's full-state snapshot is convergent, so applying any
-- snapshot yields the merged document (no compare-and-swap needed, unlike the
-- scenes JSONB row, which stays the durable source of truth).
create table if not exists scene_crdt (
  scene_id uuid primary key references scenes(id) on delete cascade,
  state text not null,                       -- base64 of Y.encodeStateAsUpdate(doc)
  updated_at timestamptz not null default now()
);
alter table scene_crdt enable row level security;
-- Owner-only for now (resolved scene -> chapter -> project). Widens together with
-- the rest of the per-project tables when collaborators/sharing land.
do $$ begin
  create policy "scene_crdt_owner" on scene_crdt
    for all using (
      exists (
        select 1 from scenes s
        join chapters c on c.id = s.chapter_id
        join projects p on p.id = c.project_id
        where s.id = scene_crdt.scene_id and p.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from scenes s
        join chapters c on c.id = s.chapter_id
        join projects p on p.id = c.project_id
        where s.id = scene_crdt.scene_id and p.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;