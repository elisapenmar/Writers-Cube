-- Writer's Cube: written prompt exercises.
-- project_id null = standalone practice library (global, not tied to a project).
-- project_id set = story-specific "Prompted exercises" attached to that project.

create table prompt_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects on delete cascade,
  prompt jsonb not null,          -- the rendered PromptObject (with filled slots)
  focus text not null,
  format text not null,           -- 'exercise' | 'seed'
  depth text not null,            -- 'warmup' | 'deep'
  prompt_mode text not null,      -- 'new' | 'existing'
  writing_mode text not null default 'free',  -- 'free' | 'typewriter'
  goal_type text,                 -- 'words' | 'minutes' | null
  goal_value int,
  content jsonb,                  -- TipTap doc the user wrote
  word_count int not null default 0,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prompt_exercises_user_idx on prompt_exercises(user_id, created_at desc);
create index prompt_exercises_project_idx on prompt_exercises(project_id, created_at desc);

alter table prompt_exercises enable row level security;

create policy "owner_all" on prompt_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
