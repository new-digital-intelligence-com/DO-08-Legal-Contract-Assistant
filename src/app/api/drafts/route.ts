import { draftContract, listDrafts } from "@/lib/drafting";
import { explainModelError } from "@/lib/anthropic";
import { bad, body, failed, ok, str } from "@/lib/http";
import { reviewer } from "@/lib/settings";
import { CONTRACT_TYPES } from "@/lib/types";
import type { ContractType, Position } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const limitParam = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
    return ok({ drafts: await listDrafts(limit) });
  } catch (error) {
    return failed(error, "The drafts could not be read.");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await body(request);

    const kind = str(payload.kind) as ContractType | undefined;
    if (!kind || !CONTRACT_TYPES.some((entry) => entry.id === kind)) {
      return bad(`kind must be one of: ${CONTRACT_TYPES.map((entry) => entry.id).join(", ")}.`);
    }

    const title = str(payload.title);
    const brief = str(payload.brief);
    if (!title || !brief) {
      return bad(
        "A draft needs a title and a brief saying what the agreement is for. Without a brief the " +
          "drafter has nothing to work from and would invent the commercial terms, which is the " +
          "one thing it must not do.",
      );
    }

    const draft = await draftContract({
      kind,
      title,
      brief,
      counterparty: str(payload.counterparty),
      position: str(payload.position) as Position | undefined,
      actor: reviewer(),
    });

    return ok({ draft }, 201);
  } catch (error) {
    const explained = explainModelError(error);
    if (explained.status !== 500) return bad(explained.message, explained.status);
    return failed(error, "The draft could not be produced.");
  }
}
