-- Submissions: a Duotrope-lite tracker for the short_story form. Each row is one
-- market/magazine a piece was sent to, with its status and key dates. Keyed by
-- project_id (and user_id for RLS, mirroring the places/items tables).
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  market text not null default 'New market',
  -- Submitted / Accepted / Rejected / Withdrawn (free-form so future statuses
  -- don't need a migration; the UI offers the standard set).
  status text not null default 'Submitted',
  sent_at date,
  response_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_user_project_idx on submissions(user_id, project_id);
create index if not exists submissions_project_id_idx on submissions(project_id);

alter table submissions enable row level security;
create policy "owner_all" on submissions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Story metadata surfaced alongside the tracker: a one-line logline and the
-- central theme. (The per-project word-count target already exists as
-- projects.word_goal from migration 0028 and is reused, not duplicated.)
alter table projects add column if not exists logline text;
alter table projects add column if not exists theme text;
