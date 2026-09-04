"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Note,
  Section,
  inputClass,
  textareaClass,
} from "../ui";
import { Markdown } from "../Markdown";
import { request, useAction, useApi, when } from "../api";
import { CONTRACT_TYPES, POSITIONS } from "@/lib/types";
import type { ContractType, Draft, Position } from "@/lib/types";

/**
 * Drafting, with the open points shown before the draft.
 *
 * The ordering is the point. The open points are the commercial decisions the
 * drafter deliberately did not make, and they are what the reader has to act
 * on — a gap gets noticed and filled, an invented figure gets signed. Putting
 * the draft first and the caveats underneath reverses which of those is easy to
 * miss.
 */
export function DraftPanel() {
  const list = useApi<{ drafts: Draft[] }>("/api/drafts");
  const [kind, setKind] = useState<ContractType>("nda");
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<Draft>();

  const draft = useAction(async () => {
    const answer = await request<{ draft: Draft }>("/api/drafts", {
      method: "POST",
      body: JSON.stringify({
        kind,
        title,
        brief,
        counterparty: counterparty || undefined,
        position: position || undefined,
      }),
    });
    setResult(answer.draft);
    list.reload();
  });

  const ready = title.trim().length > 0 && brief.trim().length > 0;

  return (
    <div className="space-y-6">
      <Section title="Draft an agreement" description="Written to the house playbook, not to a generic template.">
        <Card>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type" required>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as ContractType)}
                  className={inputClass}
                >
                  {CONTRACT_TYPES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Which party are we?" hint="Optional, but it shapes the drafting.">
                <select
                  value={position}
                  onChange={(event) => setPosition(event.target.value as Position)}
                  className={inputClass}
                >
                  <option value="">Not stated</option>
                  {POSITIONS.filter((entry) => entry.id !== "unknown").map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Counterparty">
                <input
                  value={counterparty}
                  onChange={(event) => setCounterparty(event.target.value)}
                  placeholder="Acme Software Inc."
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Title" required>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Mutual Non-Disclosure Agreement"
                className={inputClass}
              />
            </Field>

            <Field
              label="Brief"
              required
              hint="What the agreement is for, and any terms already agreed. Anything you leave out comes back as an open point rather than an invented figure."
            >
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={5}
                placeholder="Mutual NDA ahead of a technical evaluation. Three-year term. Both sides will share architecture documents and roadmap. Governed by Delaware law."
                className={textareaClass}
              />
            </Field>

            {draft.error && <ErrorNote>{draft.error}</ErrorNote>}

            <Button variant="primary" busy={draft.busy} disabled={!ready} onClick={() => draft.go()}>
              Draft it
            </Button>
          </div>
        </Card>
      </Section>

      {result && (
        <Section title={result.title}>
          <div className="space-y-3">
            {/* Open points first. See the note at the top of this file. */}
            <Note>
              <strong>Open points — decisions left for a person.</strong>
              <ul className="mt-2 space-y-1">
                {result.openPoints.map((point, index) => (
                  <li key={index}>· {point}</li>
                ))}
              </ul>
            </Note>

            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={result.markdown} label="Copy the draft" />
              <Badge tone="warn" label={`sign-off ${result.signOff.status}`} dot />
              <span className="text-[12px] text-ok-ink">Filed to Drive output/</span>
            </div>

            <Card>
              <Markdown text={result.markdown} />
            </Card>
          </div>
        </Section>
      )}

      <Section title="Earlier drafts">
        {list.loading && !list.data ? (
          <Loading rows={3} />
        ) : list.error ? (
          <ErrorNote>{list.error}</ErrorNote>
        ) : !list.data || list.data.drafts.length === 0 ? (
          <Empty title="No drafts yet." hint="Anything drafted here is kept and filed to Drive." />
        ) : (
          <div className="space-y-2">
            {list.data.drafts.map((entry) => (
              <Card key={entry.id} padded={false}>
                <button
                  type="button"
                  onClick={() => setResult(entry)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{entry.title}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {CONTRACT_TYPES.find((type) => type.id === entry.kind)?.label ?? entry.kind} ·{" "}
                      {when(entry.createdAt)} · {entry.openPoints.length} open point
                      {entry.openPoints.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Badge tone="neutral" label={entry.signOff.status} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
