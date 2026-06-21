-- Stores a user's Google Drive OAuth tokens (captured during the connect flow).
create table if not exists google_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  email text,
  updated_at timestamptz default now()
);
alter table google_credentials enable row level security;
do $$ begin
  create policy "own google credentials" on google_credentials
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
