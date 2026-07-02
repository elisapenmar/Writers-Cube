"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithProvider } from "@/lib/native-auth";

// useSearchParams must sit under a Suspense boundary for prerendering.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const deleted = useSearchParams().get("deleted") === "1";

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
        {deleted && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            Your account and all of its data have been deleted.
          </p>
        )}
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
