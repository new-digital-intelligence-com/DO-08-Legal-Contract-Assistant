"use client";

import { useState } from "react";
import { Badge, Button, Card, CopyButton, ErrorNote, Loading, Note, Table, Td, Tr, inputClass, textareaClass } from "./ui";
import { Icon } from "./icons";
import { Markdown } from "./Markdown";
import { request, useAction, useApi, when } from "./api";
import { POSITIONS } from "@/lib/types";
import type { Contract, Finding, Review, Severity, SignOffStatus } from "@/lib/types";

/**
 * One contract's review.
 *
 * Rendered from the structured findings rather than from the Markdown, because
 * only the data carries the sign-off state and a rendered document cannot have
 * a control beside each clause. The Markdown is offered as a second view and is
 * what goes to Drive.
 */

const TONE: Record<Severity, "crit" | "warn" | "ok"> = {
  critical: "crit",
  important: "warn",
  acceptable: "ok",
};

const HEADING: Record<Severity, string> = {
  critical: "Critical",
  important: "Important",
  acceptable: "Reviewed and acceptable",
};

const SIGNOFF_TONE: Record<string, "ok" | "crit" | "warn" | "neutral"> = {
  approved: "ok",
  rejected: "crit",
  "changes-requested": "warn",
  pending: "neutral",
};

/**
 * The one control that is not a review of the document but a decision about it.
 *
 * It stays, stripped to a single row, because it is the product's one hard
 * promise: a named person takes each position, with a note, and both go to the
 * trail. Neither field has a default — a sign-off attributed to whoever the app
 * happens to be running as proves nothing about who read the clause.
 */
function SignOff({
  reviewId,
  findingId,
  onDone,
}: {
  reviewId: string;
  findingId?: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SignOffStatus>("approved");
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");

  const submit = useAction(async () => {
    await request(`/api/reviews/${reviewId}/signoff`, {
      method: "POST",
      body: JSON.stringify({ status, by, note, findingId }),
    });
    setOpen(false);
    setBy("");
    setNote("");
    onDone();
  });

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Record a decision
      </Button>
    );
  }

  const ready = by.trim() && note.trim();

  return (
    <div className="space-y-2 rounded-lg border border-border bg-sunken/60 p-3">
      <div className="flex flex-wrap gap-1.5">
        {(["approved", "changes-requested", "rejected"] as SignOffStatus[]).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={status === option ? "primary" : "secondary"}
            onClick={() => setStatus(option)}
          >
            {option.replace("-", " ")}
          </Button>
        ))}
      </div>
      <input
        value={by}
        onChange={(event) => setBy(event.target.value)}
        placeholder="Who is deciding — name or email"
        className={inputClass}
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="What was decided, and why. This goes on the record."
        className={textareaClass}
      />
      {submit.error && <ErrorNote>{submit.error}</ErrorNote>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" busy={submit.busy} disabled={!ready} onClick={() => submit.go()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {!ready && <span className="text-[12px] text-ink-3">Both fields are required.</span>}
      </div>
    </div>
  );
}

function FindingCard({ finding, reviewId, onSigned }: { finding: Finding; reviewId: string; onSigned: () => void }) {
  return (
    <Card padded={false}>
      <div className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[finding.severity]} label={finding.severity} dot />
              <span className="text-[14px] font-semibold">{finding.title}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Clause {finding.location} · {finding.category}
              {finding.deviatesFromStandard && " · departs from a house standard"}
            </p>
          </div>
          <Badge tone={SIGNOFF_TONE[finding.signOff.status] ?? "neutral"} label={finding.signOff.status} dot />
        </div>

        {/* The verbatim quote. Without it the severity above is an assertion a
            lawyer cannot check. */}
        <blockquote className="border-l-2 border-border-strong bg-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-2 italic">
          {finding.quote}
        </blockquote>

        <dl className="space-y-1 text-[12.5px]">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-ink-3">Issue</dt>
            <dd className="min-w-0 flex-1">{finding.issue}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-ink-3">Risk</dt>
            <dd className="min-w-0 flex-1">{finding.risk}</dd>
          </div>
          {finding.marketStandard && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-3">Market</dt>
              <dd className="min-w-0 flex-1">{finding.marketStandard}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-ink-3">Negotiability</dt>
            <dd className="min-w-0 flex-1">{finding.negotiability}</dd>
          </div>
        </dl>

        {finding.redline && (
          <div className="space-y-1 rounded-lg border border-border bg-sunken/60 p-3 text-[12.5px]">
            <p>
              <span className="font-medium">Ask for:</span> {finding.redline.preferred}
            </p>
            {finding.redline.fallback && (
              <p>
                <span className="font-medium">Settle for:</span> {finding.redline.fallback}
              </p>
            )}
            {finding.redline.walkAway && (
              <p className="text-crit-ink">
                <span className="font-medium">Escalate below:</span> {finding.redline.walkAway}
              </p>
            )}
          </div>
        )}

        {finding.signOff.status !== "pending" && (
          <p className="text-[12px] text-ink-3">
            {finding.signOff.status} by {finding.signOff.by} · {when(finding.signOff.at)} — {finding.signOff.note}
          </p>
        )}

        <SignOff reviewId={reviewId} findingId={finding.id} onDone={onSigned} />
      </div>
    </Card>
  );
}

export function ReviewView({ reviewId, onChanged }: { reviewId: string; onChanged: () => void }) {
  const [showReport, setShowReport] = useState(false);
  const { data, loading, error, reload } = useApi<{ review: Review; contract?: Contract }>(
    `/api/reviews/${reviewId}`,
  );

  if (loading && !data) return <Loading rows={5} label="Reading the review…" />;
  if (error) return <ErrorNote>The review could not be read: {error}</ErrorNote>;
  if (!data) return null;

  const { review, contract } = data;
  const refresh = () => {
    reload();
    onChanged();
  };

  const positionLabel = POSITIONS.find((entry) => entry.id === review.position)?.label ?? review.position;
  const groups: Severity[] = ["critical", "important", "acceptable"];

  return (
    <div className="space-y-4">
      <Note>
        <strong>Awaiting legal sign-off — {review.signOff.status}.</strong> Every position below is a
        proposal, not legal advice. Material terms must be reviewed by a lawyer before this
        agreement is signed or sent.
      </Note>

      <Card>
        <dl className="grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
          {[
            ["Document", contract?.filename ?? "(removed)"],
            ["Type", review.documentTypeLabel],
            ["Our position", positionLabel],
            ["Counterparty", review.counterparty ?? "—"],
            ["Governing law", review.governingLaw ?? "—"],
            ["Status", review.documentStatus],
            ["Overall risk", HEADING[review.riskLevel]],
            ["Reviewed", when(review.createdAt)],
          ].map(([term, value]) => (
            <div key={term} className="flex gap-3">
              <dt className="w-28 shrink-0 text-ink-3">{term}</dt>
              <dd className="min-w-0 flex-1">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {review.preSigningAlerts.length > 0 && (
        <Card>
          <p className="mb-2 text-[13px] font-semibold">Before anyone signs</p>
          <ul className="space-y-1 text-[12.5px]">
            {review.preSigningAlerts.map((alert, index) => (
              <li key={index} className="flex gap-2">
                <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />
                <span>
                  <span className="font-medium">{alert.kind.replace(/-/g, " ")}</span>
                  {alert.location && <span className="text-ink-3"> ({alert.location})</span>}: {alert.detail}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="mb-1.5 text-[13px] font-semibold">Summary</p>
        <p className="text-[13px] leading-relaxed">{review.executiveSummary}</p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setShowReport((value) => !value)}>
          {showReport ? "Show findings" : "Show full report"}
        </Button>
        <CopyButton text={review.markdown} label="Copy report" />
        {contract && (
          <a
            href={`/api/contracts/${contract.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12.5px] font-medium transition hover:bg-sunken"
          >
            <Icon name="external" className="size-3.5" />
            Open the PDF
          </a>
        )}
      </div>

      {showReport ? (
        <Card>
          <Markdown text={review.markdown} />
        </Card>
      ) : (
        <div className="space-y-4">
          {review.keyTerms.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">Key terms</p>
              <Table
                head={[{ label: "Term" }, { label: "Value" }, { label: "Clause" }, { label: "Market" }]}
              >
                {review.keyTerms.map((term, index) => (
                  <Tr key={index}>
                    <Td>{term.label}</Td>
                    <Td>{term.value}</Td>
                    <Td>{term.location}</Td>
                    <Td>{term.benchmark ?? "—"}</Td>
                  </Tr>
                ))}
              </Table>
            </div>
          )}

          {groups.map((severity) => {
            const group = review.findings.filter((finding) => finding.severity === severity);
            if (group.length === 0) return null;
            return (
              <div key={severity}>
                <p className="mb-2 text-[13px] font-semibold">
                  {HEADING[severity]} ({group.length})
                </p>
                <div className="space-y-2.5">
                  {group.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} reviewId={review.id} onSigned={refresh} />
                  ))}
                </div>
              </div>
            );
          })}

          {review.standardsDeviations.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">Departures from our playbook</p>
              <div className="space-y-2">
                {review.standardsDeviations.map((deviation, index) => (
                  <Card key={index}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[deviation.severity]} label={deviation.severity} dot />
                      <span className="text-[13px] font-semibold">{deviation.topic}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px]">
                      <span className="text-ink-3">We require:</span> {deviation.requirement}
                    </p>
                    <p className="text-[12.5px]">
                      <span className="text-ink-3">This says:</span> {deviation.found}
                      {deviation.location && <span className="text-ink-3"> ({deviation.location})</span>}
                    </p>
                    {deviation.remedy && (
                      <p className="text-[12.5px]">
                        <span className="text-ink-3">Remedy:</span> {deviation.remedy}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {review.missingProvisions.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">Missing provisions</p>
              <div className="space-y-2">
                {review.missingProvisions.map((missing, index) => (
                  <Card key={index}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[missing.priority]} label={missing.priority} dot />
                      <span className="text-[13px] font-semibold">{missing.provision}</span>
                    </div>
                    <p className="mt-1 text-[12.5px]">{missing.why}</p>
                    {missing.suggestedLanguage && (
                      <blockquote className="mt-1.5 border-l-2 border-border-strong bg-sunken px-3 py-2 text-[12.5px] italic">
                        {missing.suggestedLanguage}
                      </blockquote>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {review.consistencyIssues.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">Internal consistency</p>
              <Card>
                <ul className="space-y-1 text-[12.5px]">
                  {review.consistencyIssues.map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium">{issue.kind.replace(/-/g, " ")}</span>
                      {issue.location && <span className="text-ink-3"> ({issue.location})</span>}: {issue.detail}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Always rendered, even when empty. "Nothing was unreadable" is a
              claim worth making; an absent section reads as nobody checking. */}
          <div>
            <p className="mb-2 text-[13px] font-semibold">Limitations of this review</p>
            <Card>
              {review.limitations.length === 0 ? (
                <p className="text-[12.5px] text-ink-2">
                  The document was read in full and no part of it was illegible or missing.
                </p>
              ) : (
                <ul className="space-y-1 text-[12.5px]">
                  {review.limitations.map((limitation, index) => (
                    <li key={index} className="flex gap-2">
                      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <p className="mb-2 text-[13px] font-semibold">Sign off on the review as a whole</p>
            {review.signOff.status !== "pending" && (
              <p className="mb-2 text-[12.5px] text-ink-3">
                {review.signOff.status} by {review.signOff.by} · {when(review.signOff.at)} — {review.signOff.note}
              </p>
            )}
            <SignOff reviewId={review.id} onDone={refresh} />
          </Card>
        </div>
      )}
    </div>
  );
}
