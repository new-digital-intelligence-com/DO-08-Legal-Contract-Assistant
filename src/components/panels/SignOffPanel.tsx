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
  Note,
  Section,
  inputClass,
  textareaClass,
} from "../ui";
import { request, useApi, useAction, when } from "../api";
import type { Finding, Review, Severity, SignOffStatus } from "@/lib/types";

/**
 * The queue, and the form that is the entire product.
 *
 * Everything else in this app proposes. This is where a named person takes a
 * position, and the two requirements below are enforced in the UI as well as at
 * the route — not because the client is trusted, but because a rule a person
 * only discovers by having their submission rejected is a rule that reads as a
 * bug.
 *
 * `by` has no default. Pre-filling it with the configured reviewer address
 * would make every sign-off attributable to whoever the app happens to be
 * running as, which proves nothing about who read the clause.
 */

const TONE: Record<Severity, "crit" | "warn" | "ok"> = {
  critical: "crit",
  important: "warn",
  acceptable: "ok",
};

const DECISIONS: { id: SignOffStatus; label: string; variant: "primary" | "secondary" | "danger" }[] =
  [
    { id: "approved", label: "Approve", variant: "primary" },
    { id: "changes-requested", label: "Request changes", variant: "secondary" },
    { id: "rejected", label: "Reject", variant: "danger" },
  ];

export function SignOffForm({
  reviewId,
  findingId,
  onDone,
  onCancel,
}: {
  reviewId: string;
  findingId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [status, setStatus] = useState<SignOffStatus>("approved");
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");

  const submit = useAction(async () => {
    await request(`/api/reviews/${reviewId}/signoff`, {
      method: "POST",
      body: JSON.stringify({ status, by, note, findingId }),
    });
    setBy("");
    setNote("");
    onDone();
  });

  const ready = by.trim().length > 0 && note.trim().length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-sunken/50 p-3">
      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((decision) => (
          <Button
            key={decision.id}
            size="sm"
            variant={status === decision.id ? decision.variant : "secondary"}
            onClick={() => setStatus(decision.id)}
          >
            {decision.label}
          </Button>
        ))}
      </div>

      <Field
        label="Who is deciding"
        required
        hint="A person's name or address. This is attributed on the audit trail."
      >
        <input
          value={by}
          onChange={(event) => setBy(event.target.value)}
          placeholder="jane.okafor@example.com"
          className={inputClass}
        />
      </Field>

      <Field
        label="What was decided, and why"
        required
        hint="Written to the trail. A position closed without a note reads later as one nobody looked at."
      >
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Accepted at 6 months given the contract value; flagged for renewal."
          className={textareaClass}
        />
      </Field>

      {submit.error && <ErrorNote>{submit.error}</ErrorNote>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" busy={submit.busy} disabled={!ready} onClick={() => submit.go()}>
          Record decision
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {!ready && (
          <span className="text-[12px] text-ink-3">
            Both a name and a note are required.
          </span>
        )}
      </div>
    </div>
  );
}

type Pending = {
  finding: Finding;
  review: Review;
};

export function SignOffPanel({ onOpenReview }: { onOpenReview: (contractId: string) => void }) {
  const { data, loading, error, reload } = useApi<{ reviews: Review[] }>("/api/reviews");
  const [open, setOpen] = useState<string>();

  if (loading && !data) return <Loading rows={4} label="Reading the queue…" />;
  if (error) return <ErrorNote>The queue could not be read: {error}</ErrorNote>;
  if (!data) return null;

  const pendingFindings: Pending[] = data.reviews.flatMap((review) =>
    review.findings
      .filter((finding) => finding.signOff.status === "pending" && finding.severity !== "acceptable")
      .map((finding) => ({ finding, review })),
  );

  const pendingReviews = data.reviews.filter((review) => review.signOff.status === "pending");

  // Worst first. A queue sorted by date buries a critical finding under a
  // fortnight of routine ones.
  const order: Severity[] = ["critical", "important", "acceptable"];
  pendingFindings.sort(
    (a, b) => order.indexOf(a.finding.severity) - order.indexOf(b.finding.severity),
  );

  if (pendingFindings.length === 0 && pendingReviews.length === 0) {
    return (
      <div className="space-y-4">
        <Empty
          title="Nothing is waiting for a decision."
          hint="Every finding and every review in this workspace has been signed off by a person."
        />
        <InfoNote>
          This is a count of positions that have been decided, not a statement that the contracts
          are safe. Sign-off records what a lawyer concluded.
        </InfoNote>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Note>
        Each decision below is recorded against a named person with their note, and written to the
        audit trail. Nothing in this app sets a position to approved on its own.
      </Note>

      {pendingFindings.length > 0 && (
        <Section
          title={`Findings awaiting a decision (${pendingFindings.length})`}
          description="Worst first."
        >
          <div className="space-y-3">
            {pendingFindings.map(({ finding, review }) => (
              <Card key={finding.id} padded={false}>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={TONE[finding.severity]} label={finding.severity} dot />
                        <span className="text-[13.5px] font-semibold">{finding.title}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        Clause {finding.location} · {finding.category} · reviewed{" "}
                        {when(review.createdAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onOpenReview(review.contractId)}>
                      Open contract
                    </Button>
                  </div>

                  <blockquote className="border-l-2 border-border-strong bg-sunken px-3 py-2 text-[12.5px] italic">
                    {finding.quote}
                  </blockquote>

                  <p className="text-[12.5px]">{finding.issue}</p>

                  {finding.redline && (
                    <p className="text-[12.5px] text-ink-2">
                      <span className="font-medium">Proposed:</span> {finding.redline.preferred}
                    </p>
                  )}

                  {open === finding.id ? (
                    <SignOffForm
                      reviewId={review.id}
                      findingId={finding.id}
                      onDone={() => {
                        setOpen(undefined);
                        reload();
                      }}
                      onCancel={() => setOpen(undefined)}
                    />
                  ) : (
                    <Button size="sm" onClick={() => setOpen(finding.id)}>
                      Record a decision
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {pendingReviews.length > 0 && (
        <Section
          title={`Reviews awaiting overall sign-off (${pendingReviews.length})`}
          description="A decision on the review as a whole, separate from the individual positions."
        >
          <div className="space-y-3">
            {pendingReviews.map((review) => (
              <Card key={review.id} padded={false}>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[review.riskLevel]} label={review.riskLevel} dot />
                    <span className="text-[13.5px] font-semibold">
                      {review.documentTypeLabel}
                      {review.counterparty ? ` — ${review.counterparty}` : ""}
                    </span>
                    <span className="text-[12px] text-ink-3">{when(review.createdAt)}</span>
                  </div>
                  <p className="text-[12.5px]">{review.executiveSummary}</p>

                  {open === review.id ? (
                    <SignOffForm
                      reviewId={review.id}
                      onDone={() => {
                        setOpen(undefined);
                        reload();
                      }}
                      onCancel={() => setOpen(undefined)}
                    />
                  ) : (
                    <Button size="sm" onClick={() => setOpen(review.id)}>
                      Record a decision
                    </Button>
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
