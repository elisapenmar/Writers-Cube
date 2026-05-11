"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectTree } from "@/lib/types";
import { createChapter, createScene, signOut } from "@/server/scenes";

export function SideNav({ project }: { project: ProjectTree }) {
  const params = useParams<{ sceneId?: string }>();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function addChapter() {
    startTransition(async () => {
      await createChapter(project.id);
    });
  }

  function addScene(chapterId: string) {
    startTransition(async () => {
      const sceneId = await createScene(chapterId);
      router.push(`/app/scene/${sceneId}`);
    });
  }

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-screen">
      <div className="p-4 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Project
        </div>
        <div className="font-serif text-lg truncate">{project.title}</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {project.chapters.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500">
            No chapters yet. Add one to begin.
          </p>
        ) : (
          <ul className="space-y-1">
            {project.chapters.map((chapter) => (
              <li key={chapter.id}>
                <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-zinc-700">
                  <span className="truncate">{chapter.title}</span>
                  <button
                    onClick={() => addScene(chapter.id)}
                    disabled={pending}
                    className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-50"
                    title="Add scene"
                  >
                    + scene
                  </button>
                </div>
                <ul className="ml-2 border-l border-zinc-200 pl-2">
                  {chapter.scenes.map((scene) => {
                    const active = params.sceneId === scene.id;
                    return (
                      <li key={scene.id}>
                        <Link
                          href={`/app/scene/${scene.id}`}
                          className={`block truncate rounded px-2 py-1 text-sm ${
                            active
                              ? "bg-zinc-100 text-zinc-900"
                              : "text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          {scene.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3 space-y-2">
        <button
          onClick={addChapter}
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          + New chapter
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
