"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteExercise } from "@/server/prompts";

export function DeleteExerciseButton({
  id,
  backHref,
}: {
  id: string;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this exercise permanently?")) return;
        start(async () => {
          await deleteExercise(id);
          router.push(backHref);
          router.refresh();
        });
      }}
      disabled={pending}
      className="rounded-xl px-4 py-2 text-sm text-zinc-500 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
