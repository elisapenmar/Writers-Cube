-- Persistent, user-editable notes that the AI thought partner appends to
-- after each brainstorm round. Stored as plain Markdown text.

alter table brainstorms
  add column if not exists notes text not null default '';
