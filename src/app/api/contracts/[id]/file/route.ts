import { getContract, readContractBytes } from "@/lib/contracts";
import { bad, failed } from "@/lib/http";

export const runtime = "nodejs";

/**
 * The PDF itself, so a reviewer can read the clause next to the finding.
 *
 * `inline` rather than `attachment`: the point of this route is that the
 * document renders beside the review in the browser. A download prompt breaks
 * the one workflow it exists for — checking a quote against the page.
 *
 * The filename is quoted and stripped of quotes and control characters. A
 * filename is user input, it arrives in a response header, and a stray quote
 * there is a header-injection bug rather than a cosmetic one.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contract = await getContract(id);
    if (!contract) return bad(`No contract with id ${id}.`, 404);

    const bytes = await readContractBytes(id);
    const safeName = contract.filename.replace(/["\\\r\n]/g, "_");

    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(bytes.length),
        "content-disposition": `inline; filename="${safeName}"`,
        // The bytes are immutable once ingested — the id is content-addressed
        // through the register — so the browser may keep it for the session.
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return failed(error, "The contract file could not be read.");
  }
}
