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
  let driveError: string | null = null;
  let needsReconnect = false;
  if (status.connected) {
    try {
      docs = await listDriveDocs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Drive request failed";
      // A genuine token-expiry → reconnect; anything else (API disabled, missing
      // scopes) stays "connected" and shows the real reason so it isn't a loop.
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
      docs={docs}
      projects={projects}
      driveError={driveError}
      needsReconnect={needsReconnect}
    />
  );
}
