-- Personal spell-check dictionary: words the writer has chosen to accept
-- ("Add to dictionary"). Stored per account so it follows them across devices.

create table if not exists user_dictionary (
  user_id uuid references auth.users on delete cascade not null,
  word text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, word)
);
alter table user_dictionary enable row level security;
create policy "owner_all" on user_dictionary
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
