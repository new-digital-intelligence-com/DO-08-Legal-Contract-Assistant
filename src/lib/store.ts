import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  driveConfigured,
  findInFolder,
  putJson,
  readTextFile,
  workspace,
} from "./drive";

/**
 * The register: local disk first, Drive as the durable mirror.
 *
 * DO-09 put its register on Drive alone and paid a round trip for every read.
 * This app cannot make that trade, for a reason specific to what it is: the
 * folder it is pointed at already exists and is owned by somebody else, so
 * Drive is not reachable until a person has been through a consent screen. A
 * Drive-only register would mean an app that does nothing at all until that
 * happens — no upload, no review, no queue — and the first thing anybody wants
 * to do with a contract reviewer is give it a contract.
 *
 * So the ordering is: write locally, then mirror. Local is what the app reads,
 * which makes every page fast and makes the app work on the first run. Drive is
 * where the contracts and the reviews actually live for anybody who is not
 * sitting at this machine, which is what the folder was for.
 *
 * The honesty requirement that comes with that split is `mirrorHealth()`. A
 * mirror that fails must never look like a mirror that succeeded — the app says
 * "kept locally, not yet on Drive" and names the reason, rather than showing a
 * green tick over a folder that has nothing in it. Every place the UI claims
 * something is on Drive is backed by a `DriveRef` that only exists because a
 * write returned an id.
 */

const DATA_DIR = path.join(process.cwd(), ".data");

/* ────────────────────────────────────────────────────────────────────────────
 * Local disk
 * ────────────────────────────────────────────────────────────────────────── */

function localPath(name: string): string {
  // The collection name comes from this codebase, never from a request. The
  // guard is here anyway because the day it starts coming from a request is not
  // the day anybody will remember to add it.
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Bad collection name: ${name}`);
  return path.join(DATA_DIR, `${name}.json`);
}

async function readLocal<T>(name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(localPath(name), "utf8")) as T;
  } catch {
    return undefined;
  }
}

/**
 * Write through a temporary file and rename over the target.
 *
 * `rename` is atomic within a filesystem, so a process killed mid-write leaves
 * either the old register or the new one — never a half-written JSON file that
 * every subsequent read parses as "no contracts yet". Writing in place would
 * make a crash during a save look exactly like an empty workspace.
 */
async function writeLocal(name: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const target = localPath(name);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await rename(temp, target);
}

/* ────────────────────────────────────────────────────────────────────────────
 * The Drive mirror
 * ────────────────────────────────────────────────────────────────────────── */

type MirrorHealth = {
  /** Whether Drive is configured and consented at all. */
  enabled: boolean;
  /** The last collection successfully mirrored, and when. */
  lastOk?: { name: string; at: string };
  /** The last failure, kept until a later write succeeds. */
  lastError?: { name: string; at: string; message: string };
};

const health: MirrorHealth = { enabled: false };

export function mirrorHealth(): MirrorHealth {
  return { ...health, enabled: driveConfigured() };
}

/** Remembered Drive file ids, so a mirror costs one round trip instead of two. */
const mirrorIds = new Map<string, string>();

/**
 * Push one collection to `state/` on Drive.
 *
 * Failures are recorded and swallowed rather than thrown. That is deliberate
 * and it is the only place in this app where an error is not propagated: a
 * Drive outage must not make an upload fail, because the contract is already
 * saved locally and the review can already run. What it must not do is pass
 * silently — hence `health`, which the status bar reads.
 */
async function mirror(name: string, value: unknown): Promise<void> {
  if (!driveConfigured()) return;
  try {
    const folders = await workspace();
    const known = mirrorIds.get(name);
    let file;
    try {
      file = await putJson(folders.stateId, `${name}.json`, value, known);
    } catch (error) {
      // A remembered id that no longer resolves is the one failure worth a
      // second attempt: drop it and let the write find the file by name.
      if (!known) throw error;
      mirrorIds.delete(name);
      file = await putJson(folders.stateId, `${name}.json`, value);
    }
    mirrorIds.set(name, file.id);
    health.lastOk = { name, at: new Date().toISOString() };
    health.lastError = undefined;
  } catch (error) {
    health.lastError = {
      name,
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    };
    console.warn(`[store] could not mirror ${name}.json to Drive:`, health.lastError.message);
  }
}

/**
 * Seed a collection from Drive when this machine has never seen it.
 *
 * This is what makes the workspace portable rather than machine-bound: a fresh
 * checkout pointed at the same folder picks up the register that is already
 * there instead of presenting an empty queue. It runs once per collection per
 * process and only when local disk has nothing — it is a seed, never a sync, so
 * it can never overwrite work done here with an older copy from Drive.
 */
const hydrated = new Set<string>();

async function hydrate<T>(name: string): Promise<T | undefined> {
  if (hydrated.has(name) || !driveConfigured()) return undefined;
  hydrated.add(name);
  try {
    const folders = await workspace();
    const file = await findInFolder(folders.stateId, `${name}.json`);
    if (!file) return undefined;
    mirrorIds.set(name, file.id);
    const value = JSON.parse(await readTextFile(file.id)) as T;
    await writeLocal(name, value);
    console.log(`[store] seeded ${name}.json from Drive`);
    return value;
  } catch (error) {
    console.warn(`[store] could not seed ${name}.json from Drive:`, error);
    return undefined;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * The interface every other module uses
 * ────────────────────────────────────────────────────────────────────────── */

export async function readStore<T>(name: string, fallback: T): Promise<T> {
  const local = await readLocal<T>(name);
  if (local !== undefined) return local;

  const seeded = await hydrate<T>(name);
  if (seeded !== undefined) return seeded;

  return fallback;
}

export async function writeStore<T>(name: string, value: T): Promise<void> {
  await writeLocal(name, value);
  await mirror(name, value);
}

/**
 * Serialise read-modify-write on one collection, within this process.
 *
 * Two reviews finishing at the same moment would otherwise each read the same
 * file and the second write would drop the first result. This queue is what
 * stops that. It is in-memory bookkeeping — nothing it tracks is a value this
 * app stores, only the order two writes happen in — and it does not protect
 * against a second *process* writing the same files. Run as intended, one
 * server against one `.data/` directory, it covers every write the app makes.
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
 * `append` costs one read and one write; calling it N times costs N of each,
 * and each of those writes carries the whole collection, which grows on every
 * iteration. Given oldest-first — the order things happened in — and stored
 * newest-first, matching what a sequence of plain `append` calls produces.
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
 * Blobs — the contract files themselves
 * ────────────────────────────────────────────────────────────────────────── */

const BLOB_DIR = path.join(DATA_DIR, "files");

/**
 * Keep a copy of an uploaded file on disk, addressed by content hash.
 *
 * Content-addressed rather than by contract id: the same NDA uploaded twice
 * under two names is one set of bytes, and a re-review reads it without a
 * network call. Drive holds the durable copy under the original filename in
 * `input/`; this is the working one.
 */
export async function putBlob(sha256: string, bytes: Buffer, extension = "pdf"): Promise<string> {
  await mkdir(BLOB_DIR, { recursive: true });
  const file = path.join(BLOB_DIR, `${sha256}.${extension}`);
  await writeFile(file, new Uint8Array(bytes));
  return file;
}

export async function readBlob(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/** Sortable, readable, and unique enough for a single-workspace register. */
export function newId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${noise}`;
}
