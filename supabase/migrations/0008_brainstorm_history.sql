-- Brainstorm history: allow many sessions per user, with editable title and
-- AI-generated one-sentence summary.

drop index if exists brainstorms_user_id_unique;

alter table brainstorms
  add column if not exists title text,
  add column if not exists summary text;

create index if not exists brainstorms_user_updated_idx
  on brainstorms(user_id, updated_at desc);

-- Move "notes" off brainstorms (which is now plural) to project level so
-- the working notes accumulate across all brainstorm sessions.
alter table projects
  add column if not exists notes text not null default '';

-- Backfill: for each user, copy the most recent non-empty brainstorm.notes
-- into their project.notes.
update projects p
set notes = b.notes
from (
  select distinct on (user_id) user_id, notes, updated_at
  from brainstorms
  where notes is not null and notes <> ''
  order by user_id, updated_at desc
) b
where b.user_id = p.user_id
  and (p.notes is null or p.notes = '');
