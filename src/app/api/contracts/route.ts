import { ingest, listContracts } from "@/lib/contracts";
import { bad, failed, ok } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import type { ContractType, Position } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    return ok({ contracts: await listContracts() });
  } catch (error) {
    return failed(error, "The contract register could not be read.");
  }
}

/**
 * Upload, and answer as soon as the bytes are safe.
 *
 * This route deliberately does NOT review anything. Reviewing three contracts
 * is three multi-pass model runs and the better part of two minutes, and a
 * single request that did all of it before replying left a person staring at a
 * button with no idea whether their files had even arrived — or, worse,
 * hitting it again.
 *
 * So the answer comes back the moment each file is hashed, stored and filed to
 * Drive, and the console then walks the returned ids through
 * `/api/contracts/[id]/review` one at a time, showing each contract land as it
 * goes. The cost is two round trips per file; the gain is that an upload is
 * never indistinguishable from a hang.
 *
 * One file failing does not fail the others. A person selecting five documents
 * and getting a single "upload failed" learns nothing about which one was a
 * Word file — so each is reported on its own terms.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) {
      return bad('Attach at least one PDF under the form field "file".');
    }

    const position = (form.get("position") as Position | null) ?? undefined;
    const contractType = (form.get("contractType") as ContractType | null) ?? undefined;
    const title = (form.get("title") as string | null) ?? undefined;
    const counterparty = (form.get("counterparty") as string | null) ?? undefined;
    const actor = reviewer();

    const accepted: {
      id: string;
      filename: string;
      onDrive: boolean;
      duplicateOfId?: string;
      duplicateOfName?: string;
    }[] = [];
    const rejected: { filename: string; reason: string }[] = [];

    for (const file of files) {
      try {
        const { contract, duplicateOf } = await ingest({
          filename: file.name,
          bytes: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || "application/pdf",
          origin: "web",
          position,
          contractType,
          // Only applied when a single file is uploaded: a title typed once
          // cannot describe five different agreements, and stamping it on all
          // of them would make four of them wrong.
          title: files.length === 1 ? title : undefined,
          counterparty: files.length === 1 ? counterparty : undefined,
          actor,
        });
        accepted.push({
          id: contract.id,
          filename: contract.filename,
          onDrive: Boolean(contract.input),
          duplicateOfId: duplicateOf?.id,
          duplicateOfName: duplicateOf?.filename,
        });
      } catch (error) {
        rejected.push({
          filename: file.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (accepted.length === 0) {
      return bad(
        `Nothing was uploaded. ${rejected.map((entry) => `${entry.filename}: ${entry.reason}`).join(" ")}`,
        422,
      );
    }

    return ok({ contracts: accepted, rejected }, 201);
  } catch (error) {
    return failed(error, "The upload could not be completed.");
  }
}
