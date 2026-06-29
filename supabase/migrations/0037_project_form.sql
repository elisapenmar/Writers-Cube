-- The project `form` column (novel / short_story / poetry / essay) drives
-- per-form vocabulary, tools, and export presets. It was originally applied
-- directly via the Supabase MCP and never captured as a migration; this file
-- brings it into source-controlled history. Idempotent, so it is safe to run
-- whether or not the column already exists.
alter table projects
  add column if not exists form text not null default 'novel';
