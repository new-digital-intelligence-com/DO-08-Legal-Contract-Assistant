import { signOff } from "@/lib/review";
import { bad, body, failed, ok, requireNote, str } from "@/lib/http";
import { legal, signOffIsSelfReview } from "@/lib/settings";
import type { SignOffStatus } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED: SignOffStatus[] = ["approved", "rejected", "changes-requested"];

/**
 * Record a person's decision on a review, or on one finding within it.
 *
 * This route is the product. Everything else here proposes; this is where a
 * named human takes a position, and the two requirements below are not
 * ceremony:
 *
 * `by` must be a person. There is no default and no fallback to the configured
 * reviewer address — a sign-off attributed to whoever the app happens to be
 * running as proves nothing about who actually read the clause.
 *
 * `note` must say what was decided and why. Six months later the question is
 * never "what does the contract say", it is "who accepted this cap and what did
 * they know at the time". A closed position with no note is indistinguishable
 * from one nobody looked at.
 *
 * `pending` is refused: a decision is not un-made by setting it back, it is
 * superseded by recording a new one, and the trail keeps both.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await body(request);

    const status = str(payload.status) as SignOffStatus | undefined;
    if (!status || !ALLOWED.includes(status)) {
      return bad(`status must be one of: ${ALLOWED.join(", ")}.`);
    }

    const by = str(payload.by);
    if (!by) {
      return bad(
        "A sign-off needs the name of the person making it. It is attributed in the audit trail, " +
          "and an unattributed approval is not a sign-off.",
      );
    }

    const note = requireNote(payload.note, "A sign-off");
    const findingId = str(payload.findingId);

    const review = await signOff({ reviewId: id, findingId, status, by, note });

    // Reported, not enforced. Refusing the sign-off would leave a workspace
    // that is configured with one address unable to record any decision at
    // all; saying it plainly leaves the choice with the people involved.
    const warning = signOffIsSelfReview()
      ? `This workspace has the same address configured as both reviewer and counsel (${legal()}), ` +
        `so nobody independent has taken this position.`
      : undefined;

    return ok({ review, warning });
  } catch (error) {
    return failed(error, "The sign-off could not be recorded.");
  }
}
