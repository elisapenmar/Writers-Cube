-- In-app account deletion (an App Store requirement for apps with accounts).
--
-- There is no service-role client in the app, so deletion is a SECURITY DEFINER
-- function the signed-in user calls on themselves. It always acts on auth.uid(),
-- so a user can only ever delete their own account. Deleting the auth.users row
-- cascades to every app table (they all reference auth.users or projects with
-- ON DELETE CASCADE). Two things do not cascade and are handled explicitly:
--   - feedback.user_id is ON DELETE SET NULL; for a full wipe we delete the
--     user's feedback rows rather than keep them anonymized.
--   - storage.objects rows (rte-images uploads) are unowned by the FK graph;
--     delete the user's folder rows so the files stop being served. (The
--     underlying blobs are garbage-collected by Supabase storage.)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from storage.objects
    where bucket_id = 'rte-images' and name like v_uid || '/%';

  delete from public.feedback where user_id = v_uid;

  -- Cascades: projects, chapters, scenes, loose scenes, exercises, kernels,
  -- inspirations, tags, story-bible tables, yjs snapshots, plans, usage meters…
  delete from auth.users where id = v_uid;
end;
$$;

-- Signed-in users only; anonymous callers have no account to delete.
revoke execute on function public.delete_own_account() from anon;
