import Link from "next/link";
import { notFound } from "next/navigation";
import { SquareArrow } from "@/components/icons";
import { getKernel } from "@/server/kernels";
import { KernelEditor } from "@/components/kernel-editor";

/** Turn the kernel's quick plain-text note into a Tiptap doc to seed the editor. */
function docFromText(text: string) {
  const lines = (text || "").split(/\n/);
  const content = lines.length
    ? lines.map((line) =>
        line.trim()
          ? { type: "paragraph", content: [{ type: "text", text: line }] }
          : { type: "paragraph" },
      )
    : [{ type: "paragraph" }];
  return { type: "doc", content };
}

export default async function KernelDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kernel = await getKernel(id).catch(() => null);
  if (!kernel) notFound();

  const initialContent = kernel.content ?? docFromText(kernel.body);

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/app/kernels" className="text-xs text-[var(--wc-slate)] hover:underline">
          <SquareArrow dir="left" className="inline-block align-[-3px] mr-1" /> Story kernels
        </Link>
        <div className="mt-4">
          <KernelEditor
            id={kernel.id}
            initialTitle={kernel.title}
            initialContent={initialContent}
          />
        </div>
      </div>
    </div>
  );
}
