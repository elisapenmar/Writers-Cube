-- Auto-populate four example inspirations for each NEW user (fully removable).
-- Runs once on signup via an auth trigger; wrapped so a seeding failure can
-- never block account creation. Existing users are untouched.
create or replace function public.seed_default_inspirations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inspirations (user_id, title, body, source, position) values
    (new.id, 'Terry Pratchett', '“The first draft is just you telling yourself the story.”', '', 0),
    (new.id, 'Jodi Picoult', '“You can always edit a bad page. You can’t edit a blank page.”', '', 1),
    (new.id, 'Stephen King', '“The scariest moment is always just before you start.”', '', 2),
    (new.id, 'Ray Bradbury', '“You fail only if you stop writing.”', '', 3);
exception when others then
  null; -- never block signup if seeding fails
end;
$$;

drop trigger if exists seed_inspirations_on_signup on auth.users;
create trigger seed_inspirations_on_signup
  after insert on auth.users
  for each row execute function public.seed_default_inspirations();
