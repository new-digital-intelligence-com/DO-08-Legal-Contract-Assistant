import "server-only";
import { createHash } from "node:crypto";
import { record, recordMany } from "./audit";
import { PDF_LIMITS, MODEL, modelConfigured } from "./anthropic";
import {
  downloadFile,
  driveConfigured,
  driveEnv,
  driveStatus,
  listFolder,
  trashFile,
  workspace,
} from "./drive";
import { fileInput } from "./outputs";
import { getContractFile, mutate, newId, readStore, writeStore } from "./store";
import { reviewer } from "./settings";
import type {
  Contract,
  ContractStatus,
  ContractType,
  Position,
  Review,
  Severity,
  WorkspaceStatus,
} from "./types";

/**
 * The contract register: what has been uploaded, and where each file lives.
 *
 * The register is deliberately separate from the reviews. A contract exists the
 * moment its bytes are safe, before any model has looked at it, and it goes on
 * existing if the review fails. Collapsing the two would mean a failed review
 * erases the evidence that anybody ever uploaded the document — which is the
 * one thing a person needs to see in order to retry it.
 */

const COLLECTION = "contracts";

/* ────────────────────────────────────────────────────────────────────────────
 * Reading the file
 * ────────────────────────────────────────────────────────────────────────── */

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

/**
 * Page count, by counting page objects in the raw PDF.
 *
 * This is an approximation and it is meant to be one. It exists for a single
 * purpose: to refuse a 400-page document here, with a sentence naming the
 * limit, instead of letting it travel all the way to Anthropic and come back as
 * a 400 after the file is already uploaded and in the register. A count that is
 * out by one on an unusual producer costs nothing; a count that is out by
 * three hundred does not happen, because `/Type /Page` is how every producer
 * writes a page.
 *
 * It never throws and never blocks an upload on its own — an unparseable count
 * returns `undefined`, and the real limit is enforced by the model, which knows
 * for certain.
 */
function countPages(bytes: Buffer): number | undefined {
  try {
    const text = bytes.toString("latin1");
    // `/Type /Page` with optional whitespace, but NOT `/Type /Pages`, which is
    // the tree node rather than a leaf and appears once per document.
    const matches = text.match(/\/Type\s*\/Page(?![sA-Za-z])/g);
    return matches?.length || undefined;
  } catch {
    return undefined;
  }
}

/** A PDF starts with `%PDF-`. Anything else is refused by name rather than guessed at. */
function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ingest
 * ────────────────────────────────────────────────────────────────────────── */

export type IngestInput = {
  filename: string;
  bytes: Buffer;
  mimeType: string;
  origin: Contract["origin"];
  position?: Position;
  contractType?: ContractType;
  title?: string;
  counterparty?: string;
  actor?: string;
};

/**
 * Take a file into the workspace.
 *
 * Every rejection below happens before anything is written, and each one says
 * what was actually wrong. "Upload failed" sends a person to look at their
 * network; "this is a Word document, and the reviewer reads PDFs" sends them to
 * export it, which is the thing that fixes it.
 *
 * A duplicate — same bytes, already here — is ingested anyway and reported
 * alongside the existing row. Refusing it would hide a fact worth seeing: the
 * same agreement arriving twice from two people is a real event in a legal
 * team, and it is indistinguishable from here from a double-clicked button.
 * Only a person can tell those apart, so both are shown one.
 */
export async function ingest(
  input: IngestInput,
): Promise<{ contract: Contract; duplicateOf?: Contract }> {
  const actor = input.actor?.trim() || reviewer();
  const bytes = input.bytes;

  if (bytes.length === 0) {
    throw new Error(`${input.filename} is empty.`);
  }
  if (!looksLikePdf(bytes)) {
    throw new Error(
      `${input.filename} is not a PDF (it was sent as ${input.mimeType || "an unknown type"}). ` +
        `The reviewer reads PDFs, because that is the only format where a scanned agreement and ` +
        `a born-digital one are read the same way. Export or print to PDF and upload again.`,
    );
  }
  if (bytes.length > PDF_LIMITS.maxBytes) {
    throw new Error(
      `${input.filename} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB, over the ` +
        `${Math.round(PDF_LIMITS.maxBytes / 1024 / 1024)} MB limit for a single request.`,
    );
  }

  const pages = countPages(bytes);
  if (pages && pages > PDF_LIMITS.maxPages) {
    throw new Error(
      `${input.filename} is ${pages} pages, over the ${PDF_LIMITS.maxPages}-page limit for ` +
        `${MODEL}. Split it, or review the operative agreement without its exhibits.`,
    );
  }

  const hash = sha256(bytes);
  const existing = await readStore<Contract[]>(COLLECTION, []);
  const duplicateOf = existing.find((contract) => contract.sha256 === hash);

  // Drive first, and its failure is the ingest's failure. There is no local
  // copy to fall back to, so a register row written before the upload
  // succeeded would point at a file that does not exist — and would look
  // exactly like one that does.
  const filed = await fileInput({ filename: input.filename, sha256: hash }, bytes);

  const contract: Contract = {
    id: newId("con"),
    filename: input.filename,
    sha256: hash,
    bytes: bytes.length,
    mimeType: "application/pdf",
    pages,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actor,
    origin: input.origin,
    title: input.title?.trim() || undefined,
    counterparty: input.counterparty?.trim() || undefined,
    contractType: input.contractType,
    position: input.position ?? "unknown",
    status: "uploaded",
    reviewCount: 0,
    input: filed,
  };

  await mutate<Contract[], void>(COLLECTION, [], (all) => ({
    next: [contract, ...all],
    result: undefined,
  }));

  await record({
    actor,
    action: "contract.upload",
    subject: contract.id,
    detail:
      `Uploaded ${contract.filename} (${(bytes.length / 1024).toFixed(0)} KB` +
      `${pages ? `, ${pages} pages` : ""}) from ${contract.origin}, filed to Drive input/. ` +
      (duplicateOf ? ` Same content as ${duplicateOf.filename}, uploaded ${duplicateOf.uploadedAt}.` : ""),
  });

  return { contract, duplicateOf };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading the register
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Reconcile the register against what is actually in `input/`, and return it.
 *
 * **The folder is the source of truth for which contracts exist.** Not the
 * register — the register is an index of what has been learned about them.
 *
 * That distinction was wrong before and it produced exactly the failure it
 * sounds like. A file trashed from the Drive UI stayed in `contracts.json`
 * forever, so the console listed two contracts while the folder held one, and
 * nothing anywhere explained the difference. A person looking at both had no
 * way to tell which was lying. Whatever this app believes, the folder is what
 * somebody can open, share and hand to a lawyer, so the folder wins.
 *
 * Reconciling both ways:
 *
 * - A register row whose file is **no longer in the folder** is dropped. The
 *   document is gone; continuing to list it is the lie.
 * - A file in the folder with **no register row** is adopted — hashed, counted
 *   and added, so a PDF dropped straight into `input/` shows up here ready to
 *   review. That is what makes the folder genuinely the source rather than just
 *   a veto.
 *
 * The reviews of a dropped contract are deliberately left alone. They record
 * work a person did and possibly signed off, and deleting that because somebody
 * tidied a folder would destroy the audit this product exists to keep.
 */
async function reconcile(): Promise<Contract[]> {
  const rows = await readStore<Contract[]>(COLLECTION, []);
  if (!driveConfigured()) return rows;

  const folders = await workspace();

  // Throws on a Drive failure rather than returning an empty list, so a
  // transient outage can never be read as "the folder is empty" and prune the
  // whole register.
  const present = (await listFolder(folders.inputId)).filter(
    (file) => file.mimeType === "application/pdf",
  );
  const byFileId = new Map(present.map((file) => [file.id, file]));

  const kept = rows.filter((row) => row.input && byFileId.has(row.input.fileId));
  const dropped = rows.filter((row) => !kept.includes(row));

  const known = new Set(kept.map((row) => row.input!.fileId));
  const orphans = present.filter((file) => !known.has(file.id));

  const adopted: Contract[] = [];
  for (const file of orphans) {
    try {
      const bytes = await downloadFile(file.id);
      adopted.push({
        id: newId("con"),
        filename: file.name,
        sha256: sha256(bytes),
        bytes: bytes.length,
        mimeType: "application/pdf",
        pages: countPages(bytes),
        uploadedAt: file.modifiedTime ?? new Date().toISOString(),
        uploadedBy: reviewer(),
        origin: "drive",
        position: "unknown",
        status: "uploaded",
        reviewCount: 0,
        input: { fileId: file.id, syncedAt: new Date().toISOString() },
      });
    } catch (error) {
      // One unreadable file must not stop the folder being listed.
      console.warn(`[contracts] could not adopt ${file.name} from input/:`, error);
    }
  }

  if (dropped.length === 0 && adopted.length === 0) return kept;

  const next = [...adopted, ...kept].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  await writeStore(COLLECTION, next);

  await recordMany([
    ...dropped.map((row) => ({
      actor: reviewer(),
      action: "contract.gone",
      subject: row.id,
      detail:
        `${row.filename} is no longer in the workspace folder's input/, so it has been dropped ` +
        `from the register. Its reviews are kept. Nothing in this app moved the file.`,
    })),
    ...adopted.map((row) => ({
      actor: reviewer(),
      action: "contract.adopted",
      subject: row.id,
      detail:
        `${row.filename} (${(row.bytes / 1024).toFixed(0)} KB) was found in input/ without a ` +
        `register row and has been added. Nobody has said which party we are, so it needs a ` +
        `position before it can be reviewed.`,
    })),
  ]);

  return next;
}

export async function listContracts(filter?: {
  status?: ContractStatus;
  limit?: number;
}): Promise<Contract[]> {
  const all = await reconcile();
  const matched = filter?.status ? all.filter((c) => c.status === filter.status) : all;
  return filter?.limit ? matched.slice(0, filter.limit) : matched;
}

/**
 * One contract — and only if its file is still in the folder.
 *
 * Deliberately goes through the same reconciliation as the list. A contract
 * that has vanished from `input/` has to be gone from its own page too, or the
 * link on a stale tab would still open a document nobody can find.
 */
export async function getContract(id: string): Promise<Contract | undefined> {
  return (await reconcile()).find((contract) => contract.id === id);
}

export async function readContractBytes(id: string): Promise<Buffer> {
  const contract = await getContract(id);
  if (!contract) throw new Error(`No contract with id ${id}.`);
  if (!contract.input) {
    throw new Error(
      `${contract.filename} has no file on Drive. Its register row was written without one, ` +
        `which should not happen — re-upload the document.`,
    );
  }
  return getContractFile(contract.input.fileId);
}

export async function readContractBase64(id: string): Promise<string> {
  return (await readContractBytes(id)).toString("base64");
}

export async function updateContract(id: string, patch: Partial<Contract>): Promise<Contract> {
  return mutate<Contract[], Contract>(COLLECTION, [], (all) => {
    const index = all.findIndex((contract) => contract.id === id);
    if (index === -1) throw new Error(`No contract with id ${id}.`);
    // `id` and `sha256` are identity, not state. Letting a patch move them
    // would silently re-point every review and audit row that names this
    // contract at a document nobody reviewed.
    const next = [...all];
    next[index] = { ...next[index], ...patch, id: next[index].id, sha256: next[index].sha256 };
    return { next, result: next[index] };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Removal
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Remove a contract and everything held because of it.
 *
 * The note is required and goes to the trail. A contract that disappears from
 * the register with no record of who removed it or why is the one gap an audit
 * cannot be reconstructed across — and "why did we stop tracking this
 * agreement" is a question that gets asked.
 *
 * The Drive file is trashed, not deleted, and only from `input/` or `output/`.
 * The allowed-parents check is what stops a wrong id in the register from
 * destroying the register: `state/` is never in that list, so no id read out of
 * `contracts.json` can reach `contracts.json`.
 */
export async function removeContract(id: string, actor: string, note: string): Promise<void> {
  const contract = await getContract(id);
  if (!contract) throw new Error(`No contract with id ${id}.`);

  const reviews = await readStore<Review[]>("reviews", []);
  const its = reviews.filter((review) => review.contractId === id);

  if (driveConfigured()) {
    try {
      const folders = await workspace();
      const allowed = [folders.inputId, folders.outputId];
      const refs = [
        contract.input?.fileId,
        ...its.flatMap((review) => [review.outputJson?.fileId, review.outputMarkdown?.fileId]),
      ].filter((fileId): fileId is string => Boolean(fileId));

      for (const fileId of refs) {
        await trashFile(fileId, allowed);
      }
    } catch (error) {
      // Reported, not swallowed into success, and not fatal either: the
      // register row must still go, or a failed Drive call leaves a contract
      // that cannot be removed at all.
      console.warn(`[contracts] could not trash Drive files for ${contract.filename}:`, error);
    }
  }

  await mutate<Contract[], void>(COLLECTION, [], (all) => ({
    next: all.filter((c) => c.id !== id),
    result: undefined,
  }));
  if (its.length > 0) {
    await writeStore(
      "reviews",
      reviews.filter((review) => review.contractId !== id),
    );
  }

  await record({
    actor,
    action: "contract.remove",
    subject: id,
    note,
    detail:
      `Removed ${contract.filename} and ${its.length} review${its.length === 1 ? "" : "s"} of it. ` +
      `Drive files moved to trash, where they remain recoverable.`,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Status
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The one read every screen opens with.
 *
 * `latest` is what answers the product's standing requirement — that whoever
 * opens the console can always see the last contract that went through and what
 * came back. It is resolved here rather than in the UI so the console, the MCP
 * connector and the skills all name the same document.
 */
export async function workspaceStatus(): Promise<WorkspaceStatus> {
  // `reconcile()` rather than a raw read: the counts on screen have to be
  // counts of what is actually in the folder, or the summary and the list
  // disagree and neither can be trusted.
  const [contracts, reviews, standards] = await Promise.all([
    reconcile(),
    readStore<Review[]>("reviews", []),
    readStore<unknown[]>("standards", []),
  ]);

  const reviewById = new Map(reviews.map((review) => [review.id, review]));

  let openFindings = 0;
  let criticalFindings = 0;
  let awaitingSignOff = 0;

  for (const review of reviews) {
    if (review.signOff.status === "pending") awaitingSignOff += 1;
    for (const finding of review.findings) {
      if (finding.severity === "acceptable") continue;
      openFindings += 1;
      if (finding.severity === "critical") criticalFindings += 1;
      if (finding.signOff.status === "pending") awaitingSignOff += 1;
    }
  }

  const newest = contracts[0];
  const newestReview = newest?.latestReviewId ? reviewById.get(newest.latestReviewId) : undefined;

  const drive = driveStatus();

  return {
    contracts: contracts.length,
    reviewed: contracts.filter((c) => c.status === "reviewed").length,
    awaitingReview: contracts.filter((c) => c.status === "uploaded" || c.status === "reviewing")
      .length,
    failed: contracts.filter((c) => c.status === "failed").length,
    openFindings,
    criticalFindings,
    awaitingSignOff,
    standards: standards.length,
    drive: { state: drive.state, detail: drive.detail, folderId: driveEnv().folderId },
    model: { configured: modelConfigured(), name: MODEL },
    latest: newest
      ? {
          contractId: newest.id,
          reviewId: newest.latestReviewId,
          filename: newest.filename,
          title: newest.title,
          riskLevel: newestReview?.riskLevel as Severity | undefined,
          at: newest.uploadedAt,
        }
      : undefined,
  };
}
