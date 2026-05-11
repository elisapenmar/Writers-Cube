"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="flex-1 grid place-items-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-serif">The Quill</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Writer&apos;s Cube — V0.5
          </p>
        </div>
        <button
          onClick={signIn}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign in with Google
        </button>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </main>
  );
}
