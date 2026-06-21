-- Parallel story timelines, stored per project.
-- Shape: { "lanes": [{ "id", "name", "color", "events": [{ "id","title","when","notes" }] }] }

alter table projects
  add column if not exists timeline jsonb not null default '{"lanes":[]}'::jsonb;
