import "server-only";
import { createHash } from "node:crypto";
import { record } from "./audit";
import { PDF_LIMITS, MODEL, modelConfigured } from "./anthropic";
import { driveConfigured, driveEnv, driveStatus, trashFile, workspace } from "./drive";
import { fileInput } from "./outputs";
import { mutate, newId, putBlob, readBlob, readStore, writeStore } from "./store";
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

  const localPath = await putBlob(hash, bytes);
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
    localPath,
  };

  // Drive before the register: a row claiming a `DriveRef` that no write
  // produced is exactly the lie this app is built not to tell. `fileInput`
  // returns undefined rather than throwing when Drive is unreachable, so an
  // outage costs the reference and not the upload.
  contract.input = await fileInput(contract, bytes);

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
      `${pages ? `, ${pages} pages` : ""}) from ${contract.origin}. ` +
      (contract.input ? "Filed to Drive input/." : "Kept locally; not filed to Drive.") +
      (duplicateOf ? ` Same content as ${duplicateOf.filename}, uploaded ${duplicateOf.uploadedAt}.` : ""),
  });

  return { contract, duplicateOf };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading the register
 * ────────────────────────────────────────────────────────────────────────── */

export async function listContracts(filter?: {
  status?: ContractStatus;
  limit?: number;
}): Promise<Contract[]> {
  const all = await readStore<Contract[]>(COLLECTION, []);
  const matched = filter?.status ? all.filter((c) => c.status === filter.status) : all;
  return filter?.limit ? matched.slice(0, filter.limit) : matched;
}

export async function getContract(id: string): Promise<Contract | undefined> {
  return (await readStore<Contract[]>(COLLECTION, [])).find((contract) => contract.id === id);
}

export async function readContractBytes(id: string): Promise<Buffer> {
  const contract = await getContract(id);
  if (!contract) throw new Error(`No contract with id ${id}.`);
  if (!contract.localPath) {
    throw new Error(
      `${contract.filename} has no local copy. It was uploaded by a process that no longer has ` +
        `its bytes, and Drive is the only remaining copy.`,
    );
  }
  return readBlob(contract.localPath);
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
  const [contracts, reviews, standards] = await Promise.all([
    readStore<Contract[]>(COLLECTION, []),
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
