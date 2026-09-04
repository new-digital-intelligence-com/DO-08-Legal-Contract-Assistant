"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  InfoNote,
  Loading,
  Section,
  Toolbar,
  inputClass,
  textareaClass,
} from "../ui";
import { request, useAction, useApi, when } from "../api";
import { CONTRACT_TYPES } from "@/lib/types";
import type { ContractType, Standard } from "@/lib/types";

/**
 * The house playbook, edited in place.
 *
 * Editable at runtime rather than compiled in, because a standard that needs a
 * deploy to change goes stale — and a stale standard silently approves the very
 * thing it was written to catch. Every review is judged against whatever is
 * here at the time it runs, which is also why an edit is worth a moment's
 * thought: it changes every answer the workspace gives from then on.
 */

type Draft = Partial<Standard> & { topic: string; requirement: string; preferred: string };

const BLANK: Draft = {
  topic: "",
  requirement: "",
  preferred: "",
  fallback: "",
  walkAway: "",
  owner: "",
  appliesTo: [],
};

function Editor({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Draft;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  const save = useAction(async () => {
    await request("/api/standards", { method: "POST", body: JSON.stringify(draft) });
    onSaved();
  });

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const ready = draft.topic.trim() && draft.requirement.trim() && draft.preferred.trim();

  return (
    <Card>
      <div className="space-y-3">
        <Field label="Topic" required>
          <input
            value={draft.topic}
            onChange={(event) => set({ topic: event.target.value })}
            placeholder="Limitation of liability — general cap"
            className={inputClass}
          />
        </Field>

        <Field label="Requirement" required hint="The rule, in one sentence a lawyer would recognise.">
          <textarea
            value={draft.requirement}
            onChange={(event) => set({ requirement: event.target.value })}
            rows={2}
            className={textareaClass}
          />
        </Field>

        <Field
          label="Preferred language"
          required
          hint="The clause that satisfies it. A position with no clause behind it leaves the drafting to whoever hits the deviation."
        >
          <textarea
            value={draft.preferred}
            onChange={(event) => set({ preferred: event.target.value })}
            rows={3}
            className={textareaClass}
          />
        </Field>

        <Field label="Acceptable fallback" hint="Optional. The compromise that is still fine.">
          <textarea
            value={draft.fallback ?? ""}
            onChange={(event) => set({ fallback: event.target.value })}
            rows={2}
            className={textareaClass}
          />
        </Field>

        <Field
          label="Escalate below"
          hint="Optional, and leave it blank unless it is real — a red line on every provision is a red line on none."
        >
          <textarea
            value={draft.walkAway ?? ""}
            onChange={(event) => set({ walkAway: event.target.value })}
            rows={2}
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner" hint="Who to go to when a contract breaches this.">
            <input
              value={draft.owner ?? ""}
              onChange={(event) => set({ owner: event.target.value })}
              placeholder="General Counsel"
              className={inputClass}
            />
          </Field>

          <Field label="Applies to" hint="None selected means every contract type.">
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {CONTRACT_TYPES.map((type) => {
                const on = (draft.appliesTo ?? []).includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      set({
                        appliesTo: on
                          ? (draft.appliesTo ?? []).filter((entry) => entry !== type.id)
                          : [...(draft.appliesTo ?? []), type.id as ContractType],
                      })
                    }
                    className={`rounded px-1.5 py-0.5 text-[11.5px] ring-1 ring-inset ${
                      on
                        ? "bg-brand-soft text-brand-ink ring-brand-line"
                        : "bg-surface text-ink-3 ring-border"
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        {save.error && <ErrorNote>{save.error}</ErrorNote>}

        <Toolbar>
          <Button variant="primary" size="sm" busy={save.busy} disabled={!ready} onClick={() => save.go()}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </Toolbar>
      </div>
    </Card>
  );
}

export function StandardsPanel() {
  const { data, loading, error, reload } = useApi<{ standards: Standard[] }>("/api/standards");
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState(false);

  if (loading && !data) return <Loading rows={5} label="Reading the playbook…" />;
  if (error) return <ErrorNote>The playbook could not be read: {error}</ErrorNote>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <InfoNote>
        These are the positions this organisation has already decided it takes. Every review is
        judged against whatever is here when it runs — a term can be perfectly market-standard and
        still be flagged because it breaches one of these.
      </InfoNote>

      <Section
        title={`${data.standards.length} house position${data.standards.length === 1 ? "" : "s"}`}
        actions={
          !adding && (
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              Add a position
            </Button>
          )
        }
      >
        {adding && (
          <div className="mb-3">
            <Editor
              initial={BLANK}
              onSaved={() => {
                setAdding(false);
                reload();
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {data.standards.length === 0 && !adding ? (
          <Empty
            title="The playbook is empty."
            hint="With no standards, reviews are judged against market norms only and say so in their limitations."
          />
        ) : (
          <div className="space-y-3">
            {data.standards.map((standard) =>
              editing === standard.id ? (
                <Editor
                  key={standard.id}
                  initial={standard}
                  onSaved={() => {
                    setEditing(undefined);
                    reload();
                  }}
                  onCancel={() => setEditing(undefined)}
                />
              ) : (
                <Card key={standard.id} padded={false}>
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold">{standard.topic}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {standard.appliesTo.length === 0 ? (
                            <Badge tone="neutral" label="all contract types" />
                          ) : (
                            standard.appliesTo.map((type) => (
                              <Badge
                                key={type}
                                tone="neutral"
                                label={CONTRACT_TYPES.find((entry) => entry.id === type)?.label ?? type}
                              />
                            ))
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(standard.id)}>
                        Edit
                      </Button>
                    </div>

                    <p className="text-[12.5px]">{standard.requirement}</p>

                    <div className="space-y-1.5 rounded-lg border border-border bg-sunken/60 p-3 text-[12.5px]">
                      <p>
                        <span className="font-medium">Preferred:</span> {standard.preferred}
                      </p>
                      {standard.fallback && (
                        <p>
                          <span className="font-medium">Fallback:</span> {standard.fallback}
                        </p>
                      )}
                      {standard.walkAway && (
                        <p className="text-crit-ink">
                          <span className="font-medium">Escalate:</span> {standard.walkAway}
                        </p>
                      )}
                    </div>

                    <p className="text-[11.5px] text-ink-3">
                      {standard.owner ? `${standard.owner} · ` : ""}updated {when(standard.updatedAt)} by{" "}
                      {standard.updatedBy}
                    </p>
                  </div>
                </Card>
              ),
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
