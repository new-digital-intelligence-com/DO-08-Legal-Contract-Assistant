import { getContract } from "@/lib/contracts";
import { reviewContract } from "@/lib/review";
import { explainModelError } from "@/lib/anthropic";
import { bad, body, failed, ok } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import type { ContractType, Position } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Run the three-pass review over one contract.
 *
 * `position` is accepted here as well as at upload because it is the one input
 * that inverts the whole answer, and it is routinely got wrong on the first
 * pass — somebody uploads a vendor's paper and only realises which side they
 * are on once they see the findings. Re-running with the right position is a
 * normal act, not an error path, and each run is kept rather than replacing the
 * last: the register holds every review of a contract, so a changed position is
 * visible as two reviews that disagree rather than as one that quietly changed.
 *
 * A model failure is reported with the status the model gave it — a rate limit
 * is a 429 the console can offer to retry, and a 500 is not.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contract = await getContract(id);
    if (!contract) return bad(`No contract with id ${id}.`, 404);

    const payload = await body(request).catch(() => ({}) as Record<string, unknown>);
    const position = payload.position as Position | undefined;
    const contractType = payload.contractType as ContractType | undefined;

    const review = await reviewContract({
      contractId: id,
      position,
      contractType,
      actor: reviewer(),
    });

    return ok({ review }, 201);
  } catch (error) {
    const explained = explainModelError(error);
    if (explained.status !== 500) return bad(explained.message, explained.status);
    return failed(error, "The review could not be completed.");
  }
}
