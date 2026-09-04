import { workspaceStatus } from "@/lib/contracts";
import { configStatus } from "@/lib/settings";
import { driveStatus } from "@/lib/drive";
import { failed, ok } from "@/lib/http";

export const runtime = "nodejs";

/**
 * The one read every screen opens with.
 *
 * It joins two questions — what is in the register, and how the app is
 * configured — because a console that asked them separately would render a
 * workspace summary a moment before discovering it could not reach Drive, and
 * the two would disagree on screen for as long as the second request took.
 *
 * When Drive is unreachable, `workspace` comes back **null**, never a set of
 * zeros. This app keeps nothing locally, so an unreachable folder means the
 * register is unknown — and "no contracts" is a different claim from "I cannot
 * see the folder". Rendering zeros for the second is how a console tells a
 * lawyer their queue is clear when nobody has looked.
 */
export async function GET() {
  try {
    const config = configStatus();

    if (driveStatus().state !== "ready") {
      return ok({ workspace: null, config, unreachable: config.drive.detail });
    }

    try {
      return ok({ workspace: await workspaceStatus(), config });
    } catch (error) {
      // Configured but not actually reachable — a revoked token, a folder that
      // moved, a scope that cannot see it. Same answer: unknown, not empty.
      return ok({
        workspace: null,
        config,
        unreachable: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    return failed(error, "The workspace status could not be read.");
  }
}
