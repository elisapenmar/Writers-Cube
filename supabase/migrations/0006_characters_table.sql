-- Character entries for the Organize > Characters tab.
-- Connected to (but independent of) the Brainstorm: AI can pull a list of
-- characters out of the brainstorm conversation, but each character is
-- editable on its own and survives a brainstorm reset.

create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'New character',
  role text,
  description text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_user_position_idx on characters(user_id, position);

alter table characters enable row level security;

create policy "owner_all" on characters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
