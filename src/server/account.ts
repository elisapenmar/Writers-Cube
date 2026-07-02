"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Permanently delete the signed-in user's account and all of their data.
 *
 * Runs the `delete_own_account()` SECURITY DEFINER function (migration 0039):
 * it always acts on auth.uid(), and deleting the auth.users row cascades to
 * every app table. Required by the App Store for apps with accounts; also our
 * data-deletion story on the web. The UI offers a backup download first.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    throw new Error(
      "Could not delete the account. Please try again or contact support.",
    );
  }

  // The auth user is gone; drop the now-orphaned session cookies locally.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
