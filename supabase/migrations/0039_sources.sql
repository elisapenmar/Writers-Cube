-- Sources: research / citations for the essay form. Each row is one source the
-- writer is citing: a URL, the bibliographic fields (title, author, publication,
-- published date), plus an optional pulled quote and the writer's own note.
-- `kind` is a short free-form descriptor (article, book, website, journal) used
-- to shape the generated Works Cited entry. Keyed by project so each essay keeps
-- its own bibliography. RLS mirrors places/items: the owner can do anything to
-- their own rows.
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  url text not null default '',
  title text not null default '',
  author text not null default '',
  publication text not null default '',
  published_date text not null default '',
  quote text not null default '',
  note text not null default '',
  kind text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists sources_user_created_idx on sources(user_id, created_at);
create index if not exists sources_project_id_idx on sources(project_id);

alter table sources enable row level security;
create policy "owner_all" on sources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
