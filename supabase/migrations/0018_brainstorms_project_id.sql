-- Scope brainstorm sessions to a project (they were previously per-user only).
alter table brainstorms add column if not exists project_id uuid references projects(id) on delete cascade;
-- Backfill existing (pre-multi-project) brainstorms onto each user's oldest project.
update brainstorms b set project_id = (
  select p.id from projects p where p.user_id = b.user_id order by p.created_at asc limit 1
) where b.project_id is null;
create index if not exists brainstorms_project_id_idx on brainstorms(project_id);
