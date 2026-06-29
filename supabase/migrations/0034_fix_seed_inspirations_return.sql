-- Fix: seed_default_inspirations() fell off the end without RETURN, raising
-- SQLSTATE 2F005 ("control reached end of trigger procedure without RETURN")
-- which aborted the auth.users INSERT. New users could not sign up and got
-- bounced back to the login page in a loop. Add RETURN new to both the normal
-- and exception paths; seeding stays non-blocking via the exception handler.
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
  return new;
exception when others then
  return new; -- never block signup if seeding fails
end;
$$;
