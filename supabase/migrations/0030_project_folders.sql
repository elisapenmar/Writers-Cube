-- Folders for organizing projects on the dashboard. Flat (no nesting): each
-- project optionally belongs to one folder; unfiled projects show under "All".

create table if not exists project_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'New folder',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_folders_user_idx on project_folders(user_id, position, created_at);
alter table project_folders enable row level security;
create policy "owner_all" on project_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table projects
  add column if not exists folder_id uuid references project_folders(id) on delete set null;
create index if not exists projects_folder_idx on projects(folder_id);
