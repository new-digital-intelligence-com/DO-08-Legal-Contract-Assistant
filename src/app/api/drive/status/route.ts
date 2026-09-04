import { driveEnv, driveStatus, probeFolder } from "@/lib/drive";
import { failed, ok } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Whether Drive genuinely works, not merely whether it is configured.
 *
 * `driveStatus()` answers from the environment alone and is instant.
 * `probeFolder()` costs a round trip and is the only thing that can tell a
 * correctly-configured app from a working one — a token can be present, valid,
 * and still unable to open the folder it is pointed at.
 */
export async function GET() {
  try {
    const status = driveStatus();
    const probe = status.state === "ready" ? await probeFolder() : undefined;

    return ok({
      state: status.state,
      detail: status.detail,
      folderId: driveEnv().folderId,
      reachable: probe?.ok ?? false,
      folderName: probe?.ok ? probe.folder.name : undefined,
      reason: probe && !probe.ok ? probe.reason : undefined,
    });
  } catch (error) {
    return failed(error, "The Drive status could not be read.");
  }
}
