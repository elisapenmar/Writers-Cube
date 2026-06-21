-- Outlines are now per-project; the old one-row-per-user unique index blocked
-- creating an outline for a second project.
drop index if exists outlines_user_id_unique;
create unique index if not exists outlines_user_project_unique on outlines(user_id, project_id);
