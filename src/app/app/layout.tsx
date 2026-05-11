import { SideNav } from "@/components/side-nav";
import { getOrCreateProject } from "@/server/scenes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  return (
    <div className="flex flex-1 min-h-screen">
      <SideNav project={project} />
      <main className="flex-1 flex flex-col bg-zinc-50">{children}</main>
    </div>
  );
}
