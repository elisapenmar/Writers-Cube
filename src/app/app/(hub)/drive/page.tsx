import { getDriveStatus, listDriveDocs, type DriveDoc } from "@/server/drive";
import { listProjects } from "@/server/projects";
import { DrivePanel } from "@/components/drive-panel";

export default async function DrivePage() {
  let status = { connected: false, email: null as string | null };
  try {
    status = await getDriveStatus();
  } catch {
    /* table missing / not connected */
  }

  let docs: DriveDoc[] = [];
  if (status.connected) {
    try {
      docs = await listDriveDocs();
    } catch {
      // token likely expired — surface as "needs reconnect" in the panel
      status = { connected: false, email: status.email };
    }
  }

  const projects = (await listProjects()).map((p) => ({ id: p.id, title: p.title }));

  return <DrivePanel status={status} docs={docs} projects={projects} />;
}
