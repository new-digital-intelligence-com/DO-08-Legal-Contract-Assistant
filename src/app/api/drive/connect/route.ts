import { consentUrl, driveEnv } from "@/lib/drive";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Send the operator to Google to grant access to the workspace folder.
 *
 * This is a one-time step and it is unavoidable, for a reason worth stating
 * where somebody will read it: the folder this app files into already exists
 * and was made by a person, not by this app. The narrow `drive.file` scope only
 * ever reaches files the app itself created, so it cannot see that folder — and
 * it fails silently, listing the folder's contents as an empty array with a
 * 200. An empty review queue and an unreachable folder would look identical.
 *
 * So the consent below asks for the full `drive` scope, and the callback writes
 * the refresh token into `.env.local` so this is never needed twice.
 */
export async function GET() {
  const env = driveEnv();
  if (!env.clientId || !env.clientSecret) {
    return bad(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in .env.local, so there is no OAuth " +
        "client to authorise against.",
      503,
    );
  }
  if (!env.folderId) {
    return bad(
      "GOOGLE_DRIVE_FOLDER_ID is not set, so there is no folder to grant access to. Granting " +
        "access without it would leave the app authorised and still unable to file anything.",
      503,
    );
  }

  return Response.redirect(consentUrl(), 302);
}
