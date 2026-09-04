import "server-only";
import {
  downloadFile,
  driveStatus,
  findInFolder,
  putJson,
  readTextFile,
  uploadFile,
  workspace,
  WorkspaceUnavailableError,
} from "./drive";

/**
 * The register's storage: Drive, and Drive only.
 *
 * Contracts, reviews, standards, drafts, answers and the audit trail all live
 * as JSON files in the workspace folder's `state/`, and the contract PDFs
 * themselves live in `input/`. Nothing is written to this machine's disk.
 * Every read genuinely asks Drive; every write genuinely goes to Drive.
 *
 * The earlier version of this file kept a local `.data/` copy and mirrored it
 * up. That was faster and it was wrong: two copies of a register drift, and the
 * one a person is looking at is then not necessarily the one the folder holds.
 * A lawyer opening the shared folder and a lawyer opening this console have to
 * be reading the same thing, and the only way to guarantee that is to have one
 * of them.
 *
 * ## What this costs
 *
 * A network round trip on every read and every write, and — more importantly —
 * **the app does nothing at all until Drive is connected.** There is no local
 * fallback to degrade to. That is the deliberate consequence of the decision
 * above, and every entry point says so plainly rather than presenting an empty
 * workspace: `readStore` throws when Drive is unreachable, it never returns the
 * fallback, because "no contracts yet" and "cannot reach the folder" are
 * opposite facts and only one of them is ever true.
 *
 * ## The read cache
 *
 * A few seconds' memory of what Drive just said. Not a store — nothing here
 * survives the process — it is a debounce, and it earns its place because one
 * screen asks the same question several times: the overview reads contracts,
 * reviews and standards, and the rail reads most of them again a moment later.
 * Without it each of those is a fresh round trip for an answer that cannot have
 * changed in the last two hundred milliseconds, and the page takes seconds to
 * draw. Any write from this process drops the entry immediately, so nothing you
 * do here is ever served back to you stale.
 */

const CACHE_MS = 8_000;
const reads = new Map<string, { at: number; value: unknown }>();

/**
 * Which Drive file each collection lives in.
 *
 * A read would otherwise cost two round trips: a search of `state/` for the
 * file named `contracts.json`, then a download of what the search returned. A
 * Drive file keeps its id when its contents are replaced, so that search only
 * ever tells us something we already learned the first time. Remembering it
 * halves the traffic for the whole register.
 *
 * The id can go stale — somebody deletes `state/contracts.json` in the Drive UI
 * — so both paths below drop the remembered id and fall back to the search
 * rather than reporting a failure. A wrong id costs an extra round trip once,
 * never a wrong answer.
 */
const fileIds = new Map<string, string>();

function requireDrive(): void {
  const status = driveStatus();
  if (status.state !== "ready") {
    throw new WorkspaceUnavailableError(
      `${status.detail} This app keeps nothing locally, so it cannot read or write the register ` +
        `until the workspace folder is reachable.`,
    );
  }
}

/**
 * A collection, read from `state/`.
 *
 * `fallback` is returned only when Drive was reached and the file genuinely is
 * not there — a workspace that has never had a contract in it. It is never
 * returned because a call failed: that throws, so a caller can never mistake an
 * outage for an empty register.
 */
export async function readStore<T>(name: string, fallback: T): Promise<T> {
  requireDrive();
  const folders = await workspace();
  const key = `${folders.stateId}:${name}`;

  const hit = reads.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    // Handed back as a copy. Callers map and filter these freely, and a shared
    // reference would let one screen's work show up in another's.
    return JSON.parse(JSON.stringify(hit.value)) as T;
  }

  const known = fileIds.get(key);
  if (known) {
    try {
      const value = JSON.parse(await readTextFile(known)) as T;
      reads.set(key, { at: Date.now(), value });
      return value;
    } catch {
      fileIds.delete(key);
    }
  }

  const file = await findInFolder(folders.stateId, `${name}.json`);
  if (!file) {
    reads.set(key, { at: Date.now(), value: fallback });
    return fallback;
  }

  fileIds.set(key, file.id);

  let value: T;
  try {
    value = JSON.parse(await readTextFile(file.id)) as T;
  } catch (error) {
    // A malformed file is reported, never silently treated as empty. Something
    // wrote it badly or a write was interrupted, and reading it as "no
    // contracts" would hide that at exactly the wrong moment.
    throw new Error(
      `state/${name}.json on Drive could not be parsed: ` +
        `${error instanceof Error ? error.message : String(error)}. ` +
        `It has been left alone rather than overwritten.`,
    );
  }

  reads.set(key, { at: Date.now(), value });
  return value;
}

export async function writeStore<T>(name: string, value: T): Promise<void> {
  requireDrive();
  const folders = await workspace();
  const key = `${folders.stateId}:${name}`;

  const known = fileIds.get(key);
  let file;
  try {
    file = await putJson(folders.stateId, `${name}.json`, value, known);
  } catch (error) {
    // A remembered id that no longer resolves is the one failure worth a second
    // attempt: drop it and let the write find the file by name, or create it.
    // Any other failure is real and belongs to the caller.
    if (!known) throw error;
    fileIds.delete(key);
    file = await putJson(folders.stateId, `${name}.json`, value);
  }

  fileIds.set(key, file.id);
  reads.set(key, { at: Date.now(), value });
}

/**
 * Serialise read-modify-write on one collection, within this process.
 *
 * Two reviews finishing at the same moment would otherwise each read the same
 * Drive file and the second write would drop the first result. This queue is
 * what stops that. It is in-memory bookkeeping — nothing it tracks is a value
 * this app stores, only the order two writes happen in — and it cannot protect
 * against a second *process* writing the same folder. Nothing in a
 * folder-of-JSON-files design can; Drive offers nothing to build a lock from.
 * Run as intended, one server against one folder, it covers every write.
 */
const chains = new Map<string, Promise<unknown>>();

export async function mutate<T, R>(
  name: string,
  fallback: T,
  change: (current: T) => Promise<{ next: T; result: R }> | { next: T; result: R },
): Promise<R> {
  const run = (chains.get(name) ?? Promise.resolve()).then(async () => {
    const current = await readStore<T>(name, fallback);
    const { next, result } = await change(current);
    await writeStore(name, next);
    return result;
  });

  // Keep the chain alive even when this link rejects, or one failed write would
  // deadlock every later write to the same collection.
  chains.set(
    name,
    run.catch(() => undefined),
  );
  return run as Promise<R>;
}

/**
 * Add one record to an append-only collection.
 *
 * Separate from `writeStore` so a trail is never replaced wholesale — the only
 * way in is the front.
 */
export async function append<T extends { id: string }>(
  name: string,
  record: T,
  cap = 20000,
): Promise<T> {
  const [result] = await appendMany(name, [record], cap);
  return result;
}

/**
 * Add several records in one read-modify-write.
 *
 * `append` costs one Drive read and one Drive write; calling it N times costs N
 * of each, and each of those writes carries the whole collection, which grows
 * on every iteration. Given oldest-first — the order things happened in — and
 * stored newest-first, matching what a sequence of plain `append` calls
 * produces.
 */
export async function appendMany<T extends { id: string }>(
  name: string,
  records: T[],
  cap = 20000,
): Promise<T[]> {
  if (records.length === 0) return [];
  return mutate<T[], T[]>(name, [], (log) => ({
    next: [...records].reverse().concat(log).slice(0, cap),
    result: records,
  }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * The contract files themselves
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Put an uploaded PDF in `input/`, exactly as it arrived.
 *
 * Exactly as it arrived matters: this is the copy a lawyer opens to check a
 * quote against the page, and a re-encoded or renamed file is no longer
 * evidence of what was reviewed.
 *
 * Unlike everything else here this throws loudly on failure and has no fallback
 * — there is nowhere else for the bytes to go, and an ingest that reported
 * success without the file landing would leave a register row pointing at
 * nothing.
 */
export async function putContractFile(
  name: string,
  bytes: Buffer,
  fileId?: string,
): Promise<string> {
  requireDrive();
  const folders = await workspace();
  const file = await uploadFile({
    parentId: folders.inputId,
    name,
    bytes,
    mimeType: "application/pdf",
    fileId,
  });
  return file.id;
}

/** Read a contract's bytes back out of `input/`. */
export async function getContractFile(fileId: string): Promise<Buffer> {
  requireDrive();
  return downloadFile(fileId);
}

/** Sortable, readable, and unique enough for a single-workspace register. */
export function newId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${noise}`;
}
