import { listAudit } from "@/lib/audit";
import { failed, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit"));

    return ok({
      events: await listAudit({
        query: url.searchParams.get("query") ?? undefined,
        subject: url.searchParams.get("subject") ?? undefined,
        actor: url.searchParams.get("actor") ?? undefined,
        limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 200,
      }),
    });
  } catch (error) {
    return failed(error, "The audit trail could not be read.");
  }
}
