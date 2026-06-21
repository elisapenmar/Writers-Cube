-- Scope characters to a project (they were previously per-user only).
alter table characters add column if not exists project_id uuid references projects(id) on delete cascade;
update characters c set project_id = (
  select p.id from projects p where p.user_id = c.user_id order by p.created_at asc limit 1
) where c.project_id is null;
create index if not exists characters_project_id_idx on characters(project_id);
