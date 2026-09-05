import { getContract, removeContract } from "@/lib/contracts";
import { listReviews } from "@/lib/review";
import { driveConfigured, fileState } from "@/lib/drive";
import { bad, body, failed, ok, requireNote } from "@/lib/http";
import { reviewer } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contract = await getContract(id);
    if (!contract) return bad(`No contract with id ${id}.`, 404);

    // Checked on every read rather than cached: somebody can trash the file
    // from the Drive UI at any moment, and this app is not told. A stale
    // "present" is exactly the answer that leaves a person unable to find a
    // document the console is showing them.
    const input =
      contract.input && driveConfigured() ? await fileState(contract.input.fileId) : undefined;

    return ok({ contract, reviews: await listReviews({ contractId: id }), input });
  } catch (error) {
    return failed(error, "The contract could not be read.");
  }
}

/**
 * Remove a contract and every review of it.
 *
 * The note is required and goes to the trail. A contract that disappears from
 * the register with no record of who removed it or why is the one gap an audit
 * cannot be reconstructed across, and "why did we stop tracking this
 * agreement" is a question that does get asked.
 *
 * The Drive files are trashed rather than deleted, so a mistake here is
 * recoverable from Drive's own trash — this app has no undo of its own to put
 * in front of something permanent.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await body(request);
    const note = requireNote(payload.note, "Removing a contract");

    const contract = await getContract(id);
    if (!contract) return bad(`No contract with id ${id}.`, 404);

    await removeContract(id, reviewer(), note);
    return ok({ ok: true, removed: contract.filename });
  } catch (error) {
    return failed(error, "The contract could not be removed.");
  }
}
