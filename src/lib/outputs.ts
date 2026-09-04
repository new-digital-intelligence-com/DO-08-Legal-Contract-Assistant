import "server-only";
import { record } from "./audit";
import {
  driveConfigured,
  putJson,
  putText,
  uploadFile,
  findInFolder,
  workspace,
} from "./drive";
import { readBlob, readStore, writeStore } from "./store";
import type { Contract, DriveRef, Review } from "./types";

/**
 * The only writer to the shared Drive folder's `input/` and `output/`.
 *
 * Everything about this file exists to keep one promise honest: when the
 * console says a contract is on Drive, it is on Drive. A `DriveRef` is only
 * ever constructed from an id that a Drive write actually returned — there is
 * no path here that optimistically records a reference and hopes.
 *
 * The inverse matters just as much. None of these functions throw when Drive is
 * unreachable. An unconnected Drive must not fail an upload: the bytes are
 * already on local disk and the review can already run, and refusing the work
 * would make a folder-permissions problem look like a broken product. What it
 * must never do is pass silently — the absent `DriveRef` is the signal, and
 * every screen that shows a contract reads it as "kept locally, not yet filed".
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Naming
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Drive tolerates two files with the same name in one folder and reports no
 * error for it, so `nda.pdf` uploaded by two people would sit there twice with
 * nothing saying which review belongs to which. Worse, a caller that overwrites
 * by name would replace one company's NDA with another's.
 *
 * So a file whose name is already taken by *different bytes* gets a short hash
 * prefix. The common case — the same file uploaded twice — keeps the clean name
 * and overwrites itself, which is correct: identical bytes are the same
 * document.
 */
async function uniqueInputName(
  inputId: string,
  filename: string,
  sha256: string,
): Promise<{ name: string; fileId?: string }> {
  const existing = await findInFolder(inputId, filename);
  if (!existing) return { name: filename };

  // Drive's md5 is not our sha256, so bytes cannot be compared directly here.
  // The register is the authority on which hash a filed name belongs to.
  const filed = await readStore<Record<string, string>>(FILED_NAMES, {});
  if (filed[filename] === sha256) return { name: filename, fileId: existing.id };

  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  return { name: `${stem}-${sha256.slice(0, 8)}${extension}` };
}

/** Which content hash each filed input name currently holds. */
const FILED_NAMES = "filed-names";

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot > 0 ? filename.slice(0, dot) : filename).replace(/[\\/]/g, "-");
}

function ref(fileId: string): DriveRef {
  return { fileId, syncedAt: new Date().toISOString() };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Writing
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Put an uploaded contract in `input/`, exactly as it arrived.
 *
 * Exactly as it arrived matters: this is the copy a lawyer opens when they want
 * to check a quote against the page, and a re-encoded or renamed file is no
 * longer evidence of what was reviewed.
 */
export async function fileInput(
  contract: { id: string; filename: string; sha256: string },
  bytes: Buffer,
): Promise<DriveRef | undefined> {
  if (!driveConfigured()) return undefined;
  try {
    const folders = await workspace();
    const { name, fileId } = await uniqueInputName(
      folders.inputId,
      contract.filename,
      contract.sha256,
    );

    const file = await uploadFile({
      parentId: folders.inputId,
      name,
      bytes,
      mimeType: "application/pdf",
      fileId,
    });

    const filed = await readStore<Record<string, string>>(FILED_NAMES, {});
    filed[name] = contract.sha256;
    await writeStore(FILED_NAMES, filed);

    return ref(file.id);
  } catch (error) {
    console.warn(`[outputs] could not file ${contract.filename} to Drive input/:`, error);
    return undefined;
  }
}

/**
 * Put a finished review in `output/`, as both JSON and Markdown.
 *
 * Two formats because they have two different readers. The Markdown is what a
 * lawyer opens in Drive and reads without this app running at all — which is
 * the point of writing it to a shared folder rather than keeping it in a
 * database. The JSON is what a later process reads: it carries the finding ids
 * and sign-off states that the prose flattens away.
 */
export async function fileOutput(
  review: Review,
  contract: Contract,
): Promise<{ json?: DriveRef; markdown?: DriveRef }> {
  if (!driveConfigured()) return {};
  try {
    const folders = await workspace();
    const stem = `${baseName(contract.filename)}-review`;

    const [markdown, json] = await Promise.all([
      putText(
        folders.outputId,
        `${stem}.md`,
        review.markdown,
        "text/markdown",
        review.outputMarkdown?.fileId,
      ),
      putJson(folders.outputId, `${stem}.json`, review, review.outputJson?.fileId),
    ]);

    return { markdown: ref(markdown.id), json: ref(json.id) };
  } catch (error) {
    console.warn(`[outputs] could not file the review of ${contract.filename} to Drive:`, error);
    return {};
  }
}

/**
 * Put a draft in `output/` as Markdown.
 *
 * Drafts go to the same folder as reviews rather than a third one, because from
 * the point of view of somebody opening the Drive folder they are the same kind
 * of thing: something this app produced that a lawyer has to read. The
 * `-draft` suffix is what tells them apart, and it is in the filename rather
 * than in a subfolder so a directory listing sorts the two together per matter.
 */
export async function fileDraft(draft: {
  id: string;
  title: string;
  markdown: string;
  output?: DriveRef;
}): Promise<DriveRef | undefined> {
  if (!driveConfigured()) return undefined;
  try {
    const folders = await workspace();
    const stem = draft.title.replace(/[\\/]/g, "-").slice(0, 80) || draft.id;
    const file = await putText(
      folders.outputId,
      `${stem}-draft.md`,
      draft.markdown,
      "text/markdown",
      draft.output?.fileId,
    );
    return ref(file.id);
  } catch (error) {
    console.warn(`[outputs] could not file the draft "${draft.title}" to Drive:`, error);
    return undefined;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Recovery
 * ────────────────────────────────────────────────────────────────────────── */

export type SyncResult = {
  inputs: number;
  outputs: number;
  /** Already on Drive, nothing to do. */
  skipped: number;
  errors: string[];
};

/**
 * Push everything that has no `DriveRef` yet.
 *
 * This is the path back from the two states that actually happen: the app was
 * used before anybody granted Drive access, and Drive was down for an hour
 * while people kept working. Both leave a register full of contracts that exist
 * only on this machine, and without this they would stay that way — nothing
 * else in the app ever retries a filing.
 *
 * It reports per-item errors rather than throwing on the first one. A sync that
 * stops at the first failure leaves the caller unable to tell "one file is too
 * large" from "Drive is unreachable", and the useful answer is almost always
 * "thirty-eight moved, this one did not, here is why".
 */
export async function syncAll(actor: string): Promise<SyncResult> {
  const result: SyncResult = { inputs: 0, outputs: 0, skipped: 0, errors: [] };

  if (!driveConfigured()) {
    result.errors.push(
      "Drive is not connected, so nothing was filed. Open /api/drive/connect and grant access.",
    );
    return result;
  }

  const contracts = await readStore<Contract[]>("contracts", []);
  const reviews = await readStore<Review[]>("reviews", []);
  const byId = new Map(contracts.map((contract) => [contract.id, contract]));

  for (const contract of contracts) {
    if (contract.input) {
      result.skipped += 1;
      continue;
    }
    if (!contract.localPath) {
      result.errors.push(`${contract.filename}: no local copy to upload.`);
      continue;
    }
    try {
      const filed = await fileInput(contract, await readBlob(contract.localPath));
      if (filed) {
        contract.input = filed;
        result.inputs += 1;
      } else {
        result.errors.push(`${contract.filename}: Drive refused the upload.`);
      }
    } catch (error) {
      result.errors.push(
        `${contract.filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const review of reviews) {
    if (review.outputJson && review.outputMarkdown) {
      result.skipped += 1;
      continue;
    }
    const contract = byId.get(review.contractId);
    if (!contract) {
      result.errors.push(`Review ${review.id}: its contract is no longer in the register.`);
      continue;
    }
    try {
      const filed = await fileOutput(review, contract);
      if (filed.json || filed.markdown) {
        review.outputJson = filed.json ?? review.outputJson;
        review.outputMarkdown = filed.markdown ?? review.outputMarkdown;
        result.outputs += 1;
      } else {
        result.errors.push(`${contract.filename}: Drive refused the review.`);
      }
    } catch (error) {
      result.errors.push(
        `${contract.filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Written back so a second sync does not re-upload what this one moved.
  if (result.inputs > 0) await writeStore("contracts", contracts);
  if (result.outputs > 0) await writeStore("reviews", reviews);

  await record({
    actor,
    action: "drive.sync",
    detail:
      `Filed ${result.inputs} contract${result.inputs === 1 ? "" : "s"} and ` +
      `${result.outputs} review${result.outputs === 1 ? "" : "s"} to Drive. ` +
      `${result.skipped} already there. ${result.errors.length} failed.`,
  });

  return result;
}
