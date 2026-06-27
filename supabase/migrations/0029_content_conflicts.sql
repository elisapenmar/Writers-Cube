-- Conflict preservation (Layer 4): when two writers edit the SAME row's prose
-- at once, compare-and-swap keeps the newest value and stashes the losing value
-- here so it is never silently lost — surfaced later as a "recovered edit".
-- A side table (not a __conflicts blob key) fits our per-row content model.
create table if not exists content_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  value jsonb not null,
  word_count int not null default 0,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
alter table content_conflicts enable row level security;
-- Phase 0 is single-owner; mirror the content_versions policy. This widens with
-- the rest of the per-project tables when sharing/collaborators land.
do $$ begin
  create policy "own content conflicts" on content_conflicts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists content_conflicts_entity_idx
  on content_conflicts(entity_type, entity_id, created_at desc);
