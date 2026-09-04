"use client";

import { useState } from "react";
import { Card, Empty, ErrorNote, Loading, Mono, SearchInput, Section } from "../ui";
import { useApi, when } from "../api";
import type { AuditEvent } from "@/lib/types";

/**
 * The append-only trail.
 *
 * The note a person typed is rendered as prominently as the action itself,
 * because it is the part that answers the question this trail exists for: not
 * "what happened" but "who decided, and what did they know at the time".
 */
export function AuditPanel() {
  const [query, setQuery] = useState("");
  const url = `/api/audit?limit=300${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ""}`;
  const { data, loading, error } = useApi<{ events: AuditEvent[] }>(url, [query]);

  return (
    <div className="space-y-4">
      <SearchInput value={query} onChange={setQuery} placeholder="Search actions, notes, ids…" />

      {loading && !data ? (
        <Loading rows={6} />
      ) : error ? (
        <ErrorNote>The trail could not be read: {error}</ErrorNote>
      ) : !data || data.events.length === 0 ? (
        <Empty
          title={query ? "Nothing matches that." : "Nothing recorded yet."}
          hint={query ? "Try a different term — this searches the action, the detail and the note." : undefined}
        />
      ) : (
        <Section title={`${data.events.length} event${data.events.length === 1 ? "" : "s"}`}>
          <div className="space-y-2">
            {data.events.map((event) => (
              <Card key={event.id} padded={false}>
                <div className="space-y-1 p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12.5px] font-medium">{event.action}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {when(event.at)} · {event.actor}
                    </span>
                    {event.subject && <Mono>{event.subject}</Mono>}
                  </div>
                  <p className="text-[12.5px] text-ink-2">{event.detail}</p>
                  {event.note && (
                    <p className="border-l-2 border-border-strong pl-2 text-[12.5px] italic">
                      &ldquo;{event.note}&rdquo;
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
