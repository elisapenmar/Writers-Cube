-- Generic, append-only version history for any content type (loose scenes,
-- notes, …) so nothing is ever overwritten without a recoverable snapshot.
create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  content jsonb not null,
  word_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table content_versions enable row level security;
do $$ begin
  create policy "own content versions" on content_versions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists content_versions_entity_idx
  on content_versions(entity_type, entity_id, created_at desc);
