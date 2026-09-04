import { ask, listAnswers } from "@/lib/ask";
import { explainModelError } from "@/lib/anthropic";
import { bad, body, failed, ok, str } from "@/lib/http";
import { reviewer } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const limitParam = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25;
    return ok({ answers: await listAnswers(limit) });
  } catch (error) {
    return failed(error, "The previous answers could not be read.");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await body(request);
    const question = str(payload.question);
    if (!question) return bad("Ask a question.");

    return ok({ answer: await ask({ question, actor: reviewer() }) }, 201);
  } catch (error) {
    const explained = explainModelError(error);
    if (explained.status !== 500) return bad(explained.message, explained.status);
    return failed(error, "The question could not be answered.");
  }
}
