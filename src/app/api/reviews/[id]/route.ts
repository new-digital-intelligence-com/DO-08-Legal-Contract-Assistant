import { getContract } from "@/lib/contracts";
import { getReview } from "@/lib/review";
import { bad, failed, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const review = await getReview(id);
    if (!review) return bad(`No review with id ${id}.`, 404);

    // The contract is returned alongside rather than fetched separately by the
    // client: every screen that shows a review shows the filename it belongs
    // to, and a review whose contract has been removed must render as exactly
    // that rather than as a review of nothing.
    return ok({ review, contract: await getContract(review.contractId) });
  } catch (error) {
    return failed(error, "The review could not be read.");
  }
}
