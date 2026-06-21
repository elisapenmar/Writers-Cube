import { getDriveStatus, browseDrive, type DriveEntry } from "@/server/drive";
import { listProjects } from "@/server/projects";
import { DrivePanel } from "@/components/drive-panel";

export default async function DrivePage() {
  let status = { connected: false, email: null as string | null };
  try {
    status = await getDriveStatus();
  } catch {
    /* table missing / not connected */
  }

  let entries: DriveEntry[] = [];
  let driveError: string | null = null;
  let needsReconnect = false;
  if (status.connected) {
    try {
      entries = await browseDrive("root");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Drive request failed";
      if (/expired|reconnect/i.test(msg)) {
        needsReconnect = true;
        status = { connected: false, email: status.email };
      } else {
        driveError = msg;
      }
    }
  }

  const projects = (await listProjects()).map((p) => ({ id: p.id, title: p.title }));

  return (
    <DrivePanel
      status={status}
      entries={entries}
      projects={projects}
      driveError={driveError}
      needsReconnect={needsReconnect}
    />
  );
}
