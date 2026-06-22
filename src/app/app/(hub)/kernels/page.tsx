import Link from "next/link";
import { SquareArrow } from "@/components/icons";
import { listKernels, type StoryKernel } from "@/server/kernels";
import { StoryKernels } from "@/components/story-kernels";

async function safeKernels(): Promise<StoryKernel[]> {
  try {
    return await listKernels();
  } catch {
    return [];
  }
}

export default async function KernelsPage() {
  const kernels = await safeKernels();

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link href="/app" className="text-xs text-[var(--wc-faint)] hover:underline">
            <SquareArrow dir="left" className="inline-block align-[-3px] mr-1" /> Dashboard
          </Link>
          <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">
            All story kernels
          </h1>
        </div>

        <StoryKernels initial={kernels} />
      </div>
    </div>
  );
}
