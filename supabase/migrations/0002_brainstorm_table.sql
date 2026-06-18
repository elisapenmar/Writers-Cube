create table brainstorms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brainstorms_user_id_unique on brainstorms(user_id);

alter table brainstorms enable row level security;

create policy "owner_all" on brainstorms
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
