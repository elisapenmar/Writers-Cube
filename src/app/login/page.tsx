"use client";

import { useState } from "react";
import { signInWithProvider } from "@/lib/native-auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const { error } = await signInWithProvider("google");
    if (error) setError(error);
  }

  return (
    <main className="flex-1 grid place-items-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-serif">Writer&apos;s Cube</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your quiet place to write.
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
        <p className="text-xs text-zinc-400 leading-relaxed">
          Keep getting bounced back here after signing in? Check that cookies are
          enabled for this site. Writer&apos;s Cube needs them to keep you signed
          in.
        </p>
      </div>
    </main>
  );
}
