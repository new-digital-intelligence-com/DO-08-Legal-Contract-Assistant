import { exchangeCode, forgetWorkspace, persistRefreshToken, probeFolder } from "@/lib/drive";

export const runtime = "nodejs";

/**
 * Where Google sends the operator back, and where the refresh token is stored.
 *
 * This returns HTML rather than JSON because a person is looking at it in a
 * browser tab, having just clicked through a consent screen. What they need to
 * know is whether it worked and, if it did not, which of the three things went
 * wrong — the code, the token write, or the folder still being unreachable.
 *
 * The folder is probed here rather than left for the next request. A consent
 * that succeeded against an account which cannot see the configured folder is
 * the exact failure this whole flow exists to prevent, and finding out now
 * costs one API call; finding out later costs somebody a confused afternoon
 * wondering why uploads are not appearing in Drive.
 */
function page(title: string, tone: "ok" | "bad", lines: string[]): Response {
  const colour = tone === "ok" ? "#0a6b3c" : "#b21b13";
  const body = lines.map((line) => `<p>${line}</p>`).join("\n");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
  body{font:14px/1.6 ui-sans-serif,system-ui,sans-serif;color:#16161a;background:#fbfbfa;
       margin:0;padding:48px;display:flex;justify-content:center}
  main{max-width:38rem}
  h1{font-size:20px;letter-spacing:-.02em;color:${colour};margin:0 0 1rem}
  p{margin:0 0 .85rem;color:#5c5c66}
  code{background:#f4f4f2;padding:.15rem .35rem;border-radius:4px;font-size:12.5px;color:#16161a}
  a{color:#c40100}
</style>
<main><h1>${title}</h1>${body}</main>`,
    { status: tone === "ok" ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error) {
    return page("Access was not granted", "bad", [
      `Google returned <code>${error}</code>.`,
      "Nothing was changed. Contracts are still reviewed and kept locally; they are simply not " +
        "being filed to Drive.",
      `<a href="/api/drive/connect">Try again</a>`,
    ]);
  }
  if (!code) {
    return page("No authorisation code", "bad", [
      "Google redirected here without a code, which usually means the redirect URI on the OAuth " +
        "client does not match <code>GOOGLE_REDIRECT_URI</code>.",
    ]);
  }

  try {
    const { refreshToken, scope } = await exchangeCode(code);
    const written = await persistRefreshToken(refreshToken);
    forgetWorkspace();

    const probe = await probeFolder();

    if (!probe.ok) {
      return page("Connected, but the folder is still not reachable", "bad", [
        `The token was stored${written.written ? ` in <code>${written.where}</code>` : ", but could not be written to .env.local"}.`,
        `Drive said: ${probe.reason}`,
        scope.includes("auth/drive.file") && !scope.includes("auth/drive ")
          ? "The grant came back with the narrow <code>drive.file</code> scope, which cannot see a " +
            "folder it did not create. Revoke this app at " +
            "<a href='https://myaccount.google.com/permissions'>myaccount.google.com/permissions</a> " +
            "and connect again."
          : "Check that <code>GOOGLE_DRIVE_FOLDER_ID</code> is right and that the account you just " +
            "used can open and write to that folder.",
      ]);
    }

    return page("Drive connected", "ok", [
      `Filing into <strong>${probe.folder.name}</strong>. Contracts go to <code>input/</code>, ` +
        `reviews to <code>output/</code>, and the register to <code>state/</code>.`,
      written.written
        ? `The refresh token was written to <code>${written.where}</code>, so this is a one-time step.`
        : `The token could not be written to .env.local, so it will be lost on restart. Add it ` +
          `manually as <code>GOOGLE_REFRESH_TOKEN</code>.`,
      `Anything uploaded before now is still local only — run a sync from the console to push it up.`,
      `<a href="/">Back to the console</a>`,
    ]);
  } catch (caught) {
    return page("Could not complete the connection", "bad", [
      caught instanceof Error ? caught.message : String(caught),
    ]);
  }
}
