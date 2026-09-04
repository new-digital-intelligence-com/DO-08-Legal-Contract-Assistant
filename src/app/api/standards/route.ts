import { listStandards, saveStandard } from "@/lib/standards";
import { bad, body, failed, ok, str } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import type { ContractType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const contractType = new URL(request.url).searchParams.get("contractType") as
      | ContractType
      | null;
    return ok({ standards: await listStandards(contractType ? { contractType } : undefined) });
  } catch (error) {
    return failed(error, "The playbook could not be read.");
  }
}

/**
 * Add or update a house position.
 *
 * `topic`, `requirement` and `preferred` are all required, and `preferred` in
 * particular is not optional for a reason: a standard that states a rule
 * without giving the language that satisfies it puts the drafting work back on
 * whoever hits the deviation, at the moment they are least able to do it. A
 * position without a clause is an opinion.
 */
export async function POST(request: Request) {
  try {
    const payload = await body(request);

    const topic = str(payload.topic);
    const requirement = str(payload.requirement);
    const preferred = str(payload.preferred);
    if (!topic || !requirement || !preferred) {
      return bad(
        "A standard needs a topic, the requirement it states, and the preferred language that " +
          "satisfies it. A position with no clause behind it leaves the drafting to whoever hits " +
          "the deviation.",
      );
    }

    const appliesTo = Array.isArray(payload.appliesTo)
      ? (payload.appliesTo.filter((entry) => typeof entry === "string") as ContractType[])
      : [];

    const standard = await saveStandard(
      {
        id: str(payload.id),
        topic,
        requirement,
        preferred,
        appliesTo,
        fallback: str(payload.fallback),
        walkAway: str(payload.walkAway),
        owner: str(payload.owner),
      },
      reviewer(),
    );

    return ok({ standard }, payload.id ? 200 : 201);
  } catch (error) {
    return failed(error, "The standard could not be saved.");
  }
}
