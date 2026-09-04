import "server-only";

/**
 * Google Drive, over the REST API and nothing else.
 *
 * No `googleapis` dependency: this app makes seven kinds of call — list a
 * folder, read a file, create a file, replace a file, create a folder, trash a
 * file, refresh a token — and the client library is a very large surface for
 * that. The REST shapes are stable and documented, and a thin client that fails
 * loudly is easier to reason about than a thick one that retries silently.
 *
 * ## Why the scope is `drive` and not `drive.file`
 *
 * `drive.file` — the narrow, per-file grant — only ever reaches files the app
 * itself created. That is the right scope when an app owns its own folder from
 * the first run. It is the wrong scope here, because this app is pointed at a
 * folder that already exists and that somebody else made: `GOOGLE_DRIVE_FOLDER_ID`
 * is configuration, not something this app can have created.
 *
 * The failure mode is the reason this comment is long. Under `drive.file`, a
 * request for a folder the token cannot see does not come back forbidden — a
 * `GET` on it 404s, and, far worse, a *list* of its children comes back `200`
 * with an empty array. "The folder has no contracts in it" and "this token
 * cannot see the folder" are opposite facts, and Drive reports them
 * identically. An app that treats the second as the first tells a lawyer their
 * review queue is clear.
 *
 * So the workspace grant asks for `drive`, and `probeFolder()` below turns the
 * ambiguous empty list into a definite answer before anything downstream is
 * allowed to believe it.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/**
 * Full Drive scope, for the reason set out above: the workspace folder
 * pre-exists and was not created by this client, so nothing narrower can see
 * it. This is the only grant this app asks for — there is no Gmail scope
 * anywhere in this codebase, and no mailbox is read or written.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  md5Checksum?: string;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration
 * ────────────────────────────────────────────────────────────────────────── */

export function driveEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:3000/api/drive/callback",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN?.trim() ?? "",
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ?? "",
  };
}

/**
 * Thrown when the workspace folder cannot be reached.
 *
 * A distinct class rather than a plain Error because the HTTP layer has to tell
 * this apart from a bug. Drive not being connected is a configuration state a
 * person can fix in a minute — it answers 503 with the instruction — whereas a
 * 500 tells them something is broken and sends them looking for a stack trace.
 */
export class WorkspaceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceUnavailableError";
  }
}

export type DriveState = "ready" | "needs-consent" | "unconfigured";

/**
 * Whether a run can reach Drive at all. Three separate answers, on purpose —
 * "not set up", "set up but nobody has approved it" and "working" need three
 * different things done to them, and collapsing them into a boolean means the
 * UI can only say "Drive is broken".
 */
export function driveStatus(): { state: DriveState; detail: string } {
  const env = driveEnv();
  if (!env.clientId || !env.clientSecret || !env.folderId) {
    return {
      state: "unconfigured",
      detail:
        "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_FOLDER_ID are not all set in " +
        ".env.local. This app stores everything in the workspace folder and keeps nothing on this " +
        "machine, so it cannot read or write anything until these are filled in.",
    };
  }
  if (!env.refreshToken) {
    return {
      state: "needs-consent",
      detail:
        "The Drive credentials are set but nobody has granted access yet. Open /api/drive/connect " +
        "once, approve, and the refresh token is written to .env.local.",
    };
  }
  return { state: "ready", detail: "Connected to the shared contract folder." };
}

export function driveConfigured(): boolean {
  return driveStatus().state === "ready";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tokens
 * ────────────────────────────────────────────────────────────────────────── */

/** The consent URL. `offline` + `consent` is what actually returns a refresh token. */
export function consentUrl(): string {
  const env = driveEnv();
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    // Without `offline` Google returns an access token only, and the app stops
    // working an hour later with no way to recover unattended. `consent` forces
    // the refresh token to be reissued even for an account that has approved
    // this client before — otherwise a second setup silently gets nothing, and
    // re-consenting to *widen* a scope is exactly that second setup.
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
  scope: string;
}> {
  const env = driveEnv();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await response.json()) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(
      `Google refused the authorisation code: ${body.error_description ?? body.error ?? response.status}. ` +
        `Check that ${env.redirectUri} is listed as an authorised redirect URI on this OAuth client.`,
    );
  }
  if (!body.refresh_token) {
    throw new Error(
      "Google returned an access token but no refresh token. That happens when the account has " +
        "already granted this client access — revoke it at myaccount.google.com/permissions and " +
        "try again, or the app will stop working when the access token expires.",
    );
  }
  return {
    refreshToken: body.refresh_token,
    accessToken: body.access_token ?? "",
    scope: body.scope ?? "",
  };
}

/**
 * Access tokens, cached in module scope until shortly before they expire.
 *
 * The sixty-second margin is there because the token is checked here and used a
 * moment later, and a token that expires in between fails the call rather than
 * the check.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  const status = driveStatus();
  if (status.state !== "ready") throw new WorkspaceUnavailableError(status.detail);

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const env = driveEnv();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    cachedToken = null;
    throw new Error(
      `Google would not refresh the Drive token: ${body.error_description ?? body.error ?? response.status}. ` +
        "If this says invalid_grant the stored refresh token has been revoked or expired — visit " +
        "/api/drive/connect and grant access again.",
    );
  }

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/**
 * Write the refresh token back into `.env.local`.
 *
 * A token held only in memory means every restart needs a fresh trip through
 * Google's consent screen, which nobody does, so the Drive half of the app
 * quietly stops being used. Writing it to the file the app already reads is the
 * least surprising place to put it.
 *
 * The file is rewritten in place with the one line replaced, rather than
 * appended to: a second `GOOGLE_REFRESH_TOKEN=` line further down wins in most
 * dotenv implementations, and a setting that depends on which duplicate is last
 * is a setting that will eventually be edited into the wrong order.
 */
export async function persistRefreshToken(token: string): Promise<{ written: boolean; where: string }> {
  const file = path.join(process.cwd(), ".env.local");
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  try {
    const current = await readFile(file, "utf8");
    const next = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(current)
      ? current.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
      : `${current.replace(/\s*$/, "")}\n${line}\n`;
    await writeFile(file, next, "utf8");
  } catch {
    return { written: false, where: file };
  }
  // The running process keeps its own copy of the environment, so the file
  // write alone would leave this server unable to use the token it just stored
  // until somebody restarted it.
  process.env.GOOGLE_REFRESH_TOKEN = token;
  cachedToken = null;
  forgetWorkspace();
  return { written: true, where: file };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Calls
 * ────────────────────────────────────────────────────────────────────────── */

async function call(path: string, init: RequestInit = {}, base = API): Promise<Response> {
  const token = await accessToken();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const hint =
      response.status === 404
        ? " The folder id may be wrong, or the account that granted access cannot see it. If the " +
          "token was granted with the narrow drive.file scope it cannot see a folder it did not " +
          "create — re-consent at /api/drive/connect."
        : response.status === 403
          ? " The granted scope does not cover this file, or the account lacks edit rights on the folder."
          : "";
    throw new Error(
      `Drive ${init.method ?? "GET"} ${path} failed (${response.status}).${hint} ${text.slice(0, 300)}`,
    );
  }
  return response;
}

/**
 * Confirm the configured folder is genuinely readable, and say so plainly.
 *
 * This exists because of the failure described at the top of the file: a folder
 * the token cannot see lists as an empty folder, with a `200`. Every caller
 * that would otherwise draw a conclusion from "no files came back" asks this
 * first, so "nothing is there" is only ever reported when Drive actually said
 * so about a folder it actually let us open.
 */
export async function probeFolder(): Promise<
  { ok: true; folder: DriveFile } | { ok: false; reason: string }
> {
  const status = driveStatus();
  if (status.state !== "ready") return { ok: false, reason: status.detail };

  const id = driveEnv().folderId;
  try {
    const response = await call(
      `/files/${id}?fields=id,name,mimeType,capabilities(canAddChildren,canListChildren)&supportsAllDrives=true`,
    );
    const folder = (await response.json()) as DriveFile & {
      capabilities?: { canAddChildren?: boolean; canListChildren?: boolean };
    };
    if (folder.mimeType !== "application/vnd.google-apps.folder") {
      return { ok: false, reason: `${id} is a ${folder.mimeType}, not a folder.` };
    }
    if (folder.capabilities && folder.capabilities.canAddChildren === false) {
      return {
        ok: false,
        reason:
          `The account that granted access can see "${folder.name}" but cannot write to it. ` +
          `Contracts cannot be filed into a folder that is read-only to this token.`,
      };
    }
    return { ok: true, folder };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Every non-trashed child of a folder, paged to the end. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum)",
      pageSize: "200",
      orderBy: "modifiedTime desc",
      // Shared drives behave differently from My Drive, and a folder can move
      // between them without anybody telling this app.
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await call(`/files?${params.toString()}`);
    const body = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
    for (const file of body.files ?? []) {
      files.push({ ...file, size: file.size ? Number(file.size) : undefined });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * One file by name, and the newest one when a folder somehow holds several.
 *
 * Drive permits two files with the same name in the same folder and reports no
 * error for it. That is a hazard rather than a curiosity here: the register is
 * addressed entirely by filename, so a second `contracts.json` is a register
 * that has silently forked — one writer updates one copy, another reads the
 * other, and the two disagree with nothing anywhere saying so. Taking the
 * newest is at least deterministic, so a fork degrades to "the older copy is
 * ignored" rather than to "reads and writes land on different files at random".
 */
export async function findInFolder(folderId: string, name: string): Promise<DriveFile | undefined> {
  const escaped = name.replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${escaped}' and trashed = false`,
    fields: "files(id, name, mimeType, size, modifiedTime, md5Checksum)",
    orderBy: "modifiedTime desc",
    pageSize: "10",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await call(`/files?${params.toString()}`);
  const body = (await response.json()) as { files?: DriveFile[] };
  const files = body.files ?? [];

  if (files.length > 1) {
    console.warn(
      `[drive] ${files.length} files named ${name} in folder ${folderId}. ` +
        `Using the most recently modified (${files[0].id}); the others are ignored, not merged.`,
    );
  }
  return files[0];
}

/**
 * A subfolder by name, created if it is not there.
 *
 * Find-then-create rather than create-blindly: Drive is happy to hold two
 * folders called `output` side by side, and a workspace that quietly grows a
 * second one loses half its results with nothing to show that it did.
 */
export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findInFolder(parentId, name);
  if (existing && existing.mimeType === "application/vnd.google-apps.folder") return existing.id;

  const response = await call(`/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  return ((await response.json()) as { id: string }).id;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const response = await call(`/files/${fileId}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await response.arrayBuffer());
}

export async function readTextFile(fileId: string): Promise<string> {
  return (await downloadFile(fileId)).toString("utf8");
}

/**
 * Upload, as a multipart request built by hand.
 *
 * `fetch` will happily build a `FormData` body, but Drive's multipart endpoint
 * wants `multipart/related` with the metadata part first — not the
 * `multipart/form-data` that FormData produces. Assembling the body is a dozen
 * lines and removes an entire class of confusing 400s.
 */
export async function uploadFile(input: {
  parentId: string;
  name: string;
  bytes: Buffer;
  mimeType: string;
  /** Replace this file's content instead of creating a new one. */
  fileId?: string;
}): Promise<DriveFile> {
  const boundary = `do08-${Buffer.from(`${input.name}:${input.bytes.length}`)
    .toString("hex")
    .slice(0, 24)}`;
  const metadata = input.fileId
    ? { name: input.name }
    : { name: input.name, parents: [input.parentId] };

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n--${boundary}\r\ncontent-type: ${input.mimeType}\r\n\r\n`,
    ),
    input.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const fields = "fields=id,name,mimeType,size,modifiedTime,md5Checksum";
  const path = input.fileId
    ? `/files/${input.fileId}?uploadType=multipart&supportsAllDrives=true&${fields}`
    : `/files?uploadType=multipart&supportsAllDrives=true&${fields}`;

  const response = await call(
    path,
    {
      method: input.fileId ? "PATCH" : "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(body),
    },
    UPLOAD_API,
  );

  const file = (await response.json()) as DriveFile;
  return { ...file, size: file.size ? Number(file.size) : undefined };
}

/**
 * Write a file, replacing one of the same name in the same folder.
 *
 * `fileId` lets a caller that already knows which file it is overwriting skip
 * the lookup — Drive keeps a file's id across an overwrite, so a caller writing
 * the same file repeatedly spends one round trip per write instead of two.
 */
export async function putFile(input: {
  parentId: string;
  name: string;
  bytes: Buffer;
  mimeType: string;
  fileId?: string;
}): Promise<DriveFile> {
  const fileId = input.fileId ?? (await findInFolder(input.parentId, input.name))?.id;
  return uploadFile({ ...input, fileId });
}

export async function putJson(
  parentId: string,
  name: string,
  value: unknown,
  fileId?: string,
): Promise<DriveFile> {
  return putFile({
    parentId,
    name,
    bytes: Buffer.from(JSON.stringify(value, null, 2), "utf8"),
    mimeType: "application/json",
    fileId,
  });
}

export async function putText(
  parentId: string,
  name: string,
  text: string,
  mimeType = "text/markdown",
  fileId?: string,
): Promise<DriveFile> {
  return putFile({ parentId, name, bytes: Buffer.from(text, "utf8"), mimeType, fileId });
}

/* ────────────────────────────────────────────────────────────────────────────
 * The workspace
 * ────────────────────────────────────────────────────────────────────────── */

export type Workspace = {
  rootId: string;
  rootName: string;
  /** Every uploaded contract PDF, exactly as it arrived. */
  inputId: string;
  /** One review report per contract — the JSON and the readable Markdown. */
  outputId: string;
  /** The register: contracts, reviews, standards, drafts, audit. */
  stateId: string;
};

/**
 * Folder ids only — never a document, a clause or anything a person typed.
 * Losing this on a restart costs three `ensureFolder` calls the next time the
 * workspace is touched and nothing more; it exists so a run over thirty
 * contracts does not resolve the same three ids thirty times.
 */
let cachedWorkspace: Workspace | null = null;

/**
 * The `input`, `output` and `state` folders inside the configured root.
 *
 *     <GOOGLE_DRIVE_FOLDER_ID>/
 *       input/     the contract PDFs, as uploaded
 *       output/    <contract>-review.md and .json, one pair per review
 *       state/     the register — contracts, reviews, standards, drafts, audit
 *
 * The root is configuration and is never created by this app: if it cannot be
 * reached, that is reported rather than routed around by making a new folder
 * somewhere the user will not think to look.
 */
export async function workspace(): Promise<Workspace> {
  if (cachedWorkspace) return cachedWorkspace;

  const probe = await probeFolder();
  if (!probe.ok) throw new Error(probe.reason);

  const rootId = driveEnv().folderId;
  const [inputId, outputId, stateId] = await Promise.all([
    ensureFolder(rootId, "input"),
    ensureFolder(rootId, "output"),
    ensureFolder(rootId, "state"),
  ]);

  cachedWorkspace = { rootId, rootName: probe.folder.name, inputId, outputId, stateId };
  return cachedWorkspace;
}

/** Drop cached folder ids and tokens, for when the root folder is repointed. */
export function forgetWorkspace(): void {
  cachedWorkspace = null;
  cachedToken = null;
}

/**
 * Move a file to Drive's trash, reversibly, and only from a folder it may.
 *
 * Trash rather than permanent deletion: somebody who uploaded the wrong file
 * can still recover it from Drive's own trash, and this app has no "are you
 * sure, really" step to put in front of something unrecoverable.
 *
 * The parent check is not defensive programming for its own sake. Every caller
 * passes an id it read out of the register, and ids in a register can be wrong
 * — written by an older version, mangled by a partial write, pointing at a file
 * somebody moved. Without the check, one wrong id in `contracts.json` turns
 * "remove this NDA" into "trash whatever that id names", and the ids sitting
 * beside it belong to `state/reviews.json` and the audit trail. `state/` is
 * never in the allowed list, so no id read out of the register can destroy the
 * register.
 */
export async function trashFile(fileId: string, allowedParents?: string[]): Promise<void> {
  if (allowedParents && allowedParents.length > 0) {
    const response = await call(`/files/${fileId}?fields=id,name,parents&supportsAllDrives=true`);
    const file = (await response.json()) as { name?: string; parents?: string[] };
    const parents = file.parents ?? [];

    if (!parents.some((parent) => allowedParents.includes(parent))) {
      throw new Error(
        `Refusing to trash ${file.name ?? fileId}: it is not in this workspace's input or output ` +
          `folder. Something in the register points at the wrong file, and deleting it would ` +
          `destroy something that was never asked for.`,
      );
    }
  }

  await call(`/files/${fileId}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}
