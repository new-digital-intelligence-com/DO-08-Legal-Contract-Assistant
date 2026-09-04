import "server-only";
import { append, appendMany, newId, readStore } from "./store";
import { reviewer } from "./settings";
import type { AuditEvent } from "./types";

/**
 * The append-only trail.
 *
 * What it is for, precisely: this app proposes contract positions that a person
 * then takes responsibility for. Six months later, the question that gets asked
 * is not "what does the contract say" — it is "who accepted this cap, when, and
 * what did they know at the time". The trail is the only thing that answers it.
 *
 * So every sign-off, every override, every deletion and every failed review is
 * written here with the actor and, where the action was irreversible or was a
 * human decision, the note that person typed. A sign-off with no note is
 * indistinguishable later from a sign-off nobody thought about, which is why
 * the routes require one rather than defaulting it to an empty string.
 *
 * Failures are recorded too. A review that errored and was never retried is a
 * contract that nobody looked at, and a trail that only holds successes reports
 * that workspace as clean.
 */

const COLLECTION = "audit";

export async function record(
  event: Omit<AuditEvent, "id" | "at"> & { actor?: string },
): Promise<AuditEvent> {
  return append<AuditEvent>(COLLECTION, {
    ...event,
    actor: event.actor?.trim() || reviewer(),
    id: newId("aud"),
    at: new Date().toISOString(),
  });
}

export async function recordMany(
  events: (Omit<AuditEvent, "id" | "at"> & { actor?: string })[],
): Promise<AuditEvent[]> {
  if (events.length === 0) return [];
  const at = new Date().toISOString();
  return appendMany<AuditEvent>(
    COLLECTION,
    events.map((event) => ({
      ...event,
      actor: event.actor?.trim() || reviewer(),
      id: newId("aud"),
      at,
    })),
  );
}

export async function listAudit(filter?: {
  subject?: string;
  actor?: string;
  query?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const all = await readStore<AuditEvent[]>(COLLECTION, []);
  const query = filter?.query?.trim().toLowerCase();

  const matched = all.filter((event) => {
    if (filter?.subject && event.subject !== filter.subject) return false;
    if (filter?.actor && event.actor !== filter.actor) return false;
    if (query) {
      const haystack =
        `${event.action} ${event.detail} ${event.note ?? ""} ${event.subject ?? ""} ${event.actor}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return filter?.limit ? matched.slice(0, filter.limit) : matched;
}
