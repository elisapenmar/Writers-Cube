import { notFound } from "next/navigation";
import { getLooseScene } from "@/server/loose";
import { LooseEditor } from "@/components/loose-editor";

export default async function LooseScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scene = await getLooseScene(id).catch(() => null);
  if (!scene) notFound();
  return <LooseEditor scene={scene} />;
}
