-- Project metadata: author + (optional) agent, alongside the existing title.
-- Word count target is intentionally NOT added; per founder, it's not needed for V0.5.

alter table projects
  add column if not exists author_name text,
  add column if not exists agent_name text;
