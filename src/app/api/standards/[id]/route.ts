import { getStandard, removeStandard, saveStandard } from "@/lib/standards";
import { bad, body, failed, ok, requireNote, str } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import type { ContractType } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await getStandard(id);
    if (!existing) return bad(`No standard with id ${id}.`, 404);

    const payload = await body(request);
    const appliesTo = Array.isArray(payload.appliesTo)
      ? (payload.appliesTo.filter((entry) => typeof entry === "string") as ContractType[])
      : existing.appliesTo;

    const standard = await saveStandard(
      {
        id,
        topic: str(payload.topic) ?? existing.topic,
        requirement: str(payload.requirement) ?? existing.requirement,
        preferred: str(payload.preferred) ?? existing.preferred,
        appliesTo,
        fallback: str(payload.fallback),
        walkAway: str(payload.walkAway),
        owner: str(payload.owner),
      },
      reviewer(),
    );

    return ok({ standard });
  } catch (error) {
    return failed(error, "The standard could not be updated.");
  }
}

/**
 * Removing a standard needs a note, like every other irreversible act here.
 *
 * A deleted standard is a position this organisation silently stopped holding.
 * Without the note, the only difference six months later between that and
 * "we never had one" is invisible.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await body(request);
    const note = requireNote(payload.note, "Removing a standard");

    const existing = await getStandard(id);
    if (!existing) return bad(`No standard with id ${id}.`, 404);

    await removeStandard(id, reviewer(), note);
    return ok({ ok: true, removed: existing.topic });
  } catch (error) {
    return failed(error, "The standard could not be removed.");
  }
}
