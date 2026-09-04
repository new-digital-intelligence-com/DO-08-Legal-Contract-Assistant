import { workspaceStatus } from "@/lib/contracts";
import { mirrorHealth } from "@/lib/store";
import { configStatus } from "@/lib/settings";
import { failed, ok } from "@/lib/http";

export const runtime = "nodejs";

/**
 * The one read every screen opens with.
 *
 * It joins three separate questions — what is in the register, how the app is
 * configured, and whether the Drive mirror is actually working — because a
 * console that asked them separately would render a workspace summary a moment
 * before discovering it could not reach Drive, and the two would disagree on
 * screen for as long as the second request took.
 */
export async function GET() {
  try {
    const [workspace] = await Promise.all([workspaceStatus()]);
    return ok({ workspace, config: configStatus(), mirror: mirrorHealth() });
  } catch (error) {
    return failed(error, "The workspace status could not be read.");
  }
}
