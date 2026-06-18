import { redirect } from "next/navigation";

// The brainstorm UI now lives inside the Organize side panel. Keep this route
// as a redirect so old links / bookmarks land on the app shell.
export default function BrainstormRedirect() {
  redirect("/app");
}
