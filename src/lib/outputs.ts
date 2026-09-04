import "server-only";
import { findInFolder, putJson, putText, workspace } from "./drive";
import { putContractFile, readStore, writeStore } from "./store";
import type { Contract, DriveRef, Review } from "./types";

/**
 * The writers for the workspace folder's `input/` and `output/`.
 *
 * Every function here throws on failure and none of them has a fallback. That
 * is the whole point of the Drive-only design: there is nowhere else for a
 * contract or a review to go, so a write that did not happen must fail the
 * operation rather than leaving a register row that claims a file exists.
 *
 * A `DriveRef` is therefore only ever constructed from an id a Drive write
 * actually returned. There is no path here that records a reference
 * optimistically.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Naming
 * ────────────────────────────────────────────────────────────────────────── */

/** Which content hash each filed input name currently holds. */
const FILED_NAMES = "filed-names";

/**
 * Drive tolerates two files with the same name in one folder and reports no
 * error for it, so `nda.pdf` uploaded by two people would sit there twice with
 * nothing saying which review belongs to which — and a caller that overwrites
 * by name would replace one company's NDA with another's.
 *
 * So a name already taken by *different bytes* gets a short hash suffix. The
 * common case — the same file uploaded twice — keeps the clean name and
 * overwrites itself, which is correct: identical bytes are the same document.
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

/** Put an uploaded contract in `input/`, under a name that cannot collide. */
export async function fileInput(
  contract: { filename: string; sha256: string },
  bytes: Buffer,
): Promise<DriveRef> {
  const folders = await workspace();
  const { name, fileId } = await uniqueInputName(folders.inputId, contract.filename, contract.sha256);

  const id = await putContractFile(name, bytes, fileId);

  const filed = await readStore<Record<string, string>>(FILED_NAMES, {});
  filed[name] = contract.sha256;
  await writeStore(FILED_NAMES, filed);

  return ref(id);
}

/**
 * Put a finished review in `output/`, as both Markdown and JSON.
 *
 * Two formats because they have two different readers. The Markdown is what a
 * lawyer opens in Drive and reads without this app running at all — which is
 * the point of writing it to a shared folder. The JSON is what a later process
 * reads: it carries the finding ids and sign-off states the prose flattens away.
 */
export async function fileOutput(
  review: Review,
  contract: Contract,
): Promise<{ json: DriveRef; markdown: DriveRef }> {
  const folders = await workspace();
  const stem = `${baseName(contract.filename)}-review`;

  const [markdown, json] = await Promise.all([
    putText(folders.outputId, `${stem}.md`, review.markdown, "text/markdown", review.outputMarkdown?.fileId),
    putJson(folders.outputId, `${stem}.json`, review, review.outputJson?.fileId),
  ]);

  return { markdown: ref(markdown.id), json: ref(json.id) };
}

/**
 * Put a draft in `output/` as Markdown.
 *
 * Drafts go to the same folder as reviews rather than a third one: from the
 * point of view of somebody opening the Drive folder they are the same kind of
 * thing — something this app produced that a lawyer has to read. The `-draft`
 * suffix tells them apart, and it is in the filename rather than in a
 * subfolder so a listing sorts the two together per matter.
 */
export async function fileDraft(draft: {
  id: string;
  title: string;
  markdown: string;
  output?: DriveRef;
}): Promise<DriveRef> {
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
}
