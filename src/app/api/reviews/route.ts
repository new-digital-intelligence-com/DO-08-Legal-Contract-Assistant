import { listReviews } from "@/lib/review";
import { failed, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? undefined;
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    return ok({ reviews: await listReviews({ contractId, limit }) });
  } catch (error) {
    return failed(error, "The reviews could not be read.");
  }
}
