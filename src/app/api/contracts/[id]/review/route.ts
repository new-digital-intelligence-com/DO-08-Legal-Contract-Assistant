import { getContract } from "@/lib/contracts";
import { reviewContract } from "@/lib/review";
import { explainModelError } from "@/lib/anthropic";
import { bad, body, failed, ok } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import type { ContractType, Position, ReviewProgress } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Run the three-pass review over one contract, reporting each stage as it goes.
 *
 * ## Why this streams
 *
 * A full review is three model calls and several minutes. A route that answered
 * only at the end left the console showing a spinner for that whole time, and a
 * spinner is indistinguishable from a hang — people re-click, re-upload, or
 * give up on a request that was working perfectly. When it did fail there was
 * also nothing to say *where* it failed, so "the review failed" was the entire
 * diagnosis.
 *
 * So the default response is Server-Sent Events: one `data:` line per stage,
 * flushed as it happens. The client renders a checklist that fills in, and a
 * failure arrives attached to the stage that caused it.
 *
 * A caller that asks for JSON — `Accept: application/json`, which is what curl
 * and any script does — still gets the single final object. Keeping both is a
 * dozen lines and means the endpoint stays usable outside the browser.
 *
 * ## Why `position` is accepted here as well as at upload
 *
 * It is the one input that inverts the whole answer, and it is routinely got
 * wrong on the first pass — somebody uploads a vendor's paper and only realises
 * which side they are on once they see the findings. Re-running with the right
 * position is a normal act, not an error path, and each run is kept rather than
 * replacing the last: a changed position shows up as two reviews that disagree
 * rather than as one that quietly changed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contract = await getContract(id);
    if (!contract) return bad(`No contract with id ${id}.`, 404);

    const payload = await body(request).catch(() => ({}) as Record<string, unknown>);
    const position = payload.position as Position | undefined;
    const contractType = payload.contractType as ContractType | undefined;

    const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

    /* ── The plain, blocking answer ─────────────────────────────────────── */
    if (wantsJson) {
      const review = await reviewContract({
        contractId: id,
        position,
        contractType,
        actor: reviewer(),
      });
      return ok({ review }, 201);
    }

    /* ── The streamed answer ────────────────────────────────────────────── */
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        let reportedFailure = false;
        const send = (event: ReviewProgress) => {
          if (closed) return;
          if (event.step === "failed") reportedFailure = true;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // The client navigated away mid-review. The review itself carries
            // on and still gets written — abandoning it here would leave a
            // contract stuck in `reviewing` for the price of a closed tab.
            closed = true;
          }
        };

        try {
          await reviewContract({
            contractId: id,
            position,
            contractType,
            actor: reviewer(),
            onProgress: send,
          });
        } catch (error) {
          // `reviewContract` reports its own failure and marks the contract.
          // Only speak up if it did not get that far — a throw from before the
          // pipeline started reporting. Otherwise the client shows it twice.
          if (!reportedFailure) {
            const explained = explainModelError(error);
            send({ step: "failed", label: "Review failed", error: explained.message, elapsedMs: 0 });
          }
        } finally {
          closed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // Nginx and several hosts buffer a response body by default, which
        // would hold every event until the review finished and defeat the
        // whole point of streaming them.
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    const explained = explainModelError(error);
    if (explained.status !== 500) return bad(explained.message, explained.status);
    return failed(error, "The review could not be started.");
  }
}
