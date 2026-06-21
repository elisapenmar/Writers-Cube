-- Scope outlines to a project (they were previously per-user only).
alter table outlines add column if not exists project_id uuid references projects(id) on delete cascade;
update outlines o set project_id = (
  select p.id from projects p where p.user_id = o.user_id order by p.created_at asc limit 1
) where o.project_id is null;
create index if not exists outlines_project_id_idx on outlines(project_id);
