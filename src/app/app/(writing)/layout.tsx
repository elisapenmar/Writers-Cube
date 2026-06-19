import { SideNav } from "@/components/side-nav";
import { AppShell } from "@/components/app-shell";
import { getOrCreateProject } from "@/server/scenes";

export default async function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  return (
    <div className="flex flex-1 min-h-screen">
      <SideNav project={project} />
      <AppShell>{children}</AppShell>
    </div>
  );
}
