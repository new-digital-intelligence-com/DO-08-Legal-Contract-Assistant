"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  ErrorNote,
  InfoNote,
  Loading,
  Note,
  Section,
  Table,
  Td,
  Tr,
} from "../ui";
import { Icon } from "../icons";
import { Markdown } from "../Markdown";
import { useApi, when } from "../api";
import { SignOffForm } from "./SignOffPanel";
import { POSITIONS } from "@/lib/types";
import type { Contract, Finding, Review, Severity } from "@/lib/types";

/**
 * One contract's review, rendered from the structured findings rather than from
 * the Markdown.
 *
 * The Markdown is offered as a second view and is what goes to Drive, but the
 * primary rendering is built from the data because only the data carries the
 * sign-off state. A lawyer working through a review needs the approve/reject
 * control beside each finding, and a rendered document cannot have one.
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

function label(list: { id: string; label: string }[], id: string) {
  return list.find((entry) => entry.id === id)?.label ?? id;
}

function FindingCard({
  finding,
  reviewId,
  onSigned,
}: {
  finding: Finding;
  reviewId: string;
  onSigned: () => void;
}) {
  const [signing, setSigning] = useState(false);

  return (
    <Card padded={false}>
      <div className="space-y-3 p-4">
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
          <Badge
            tone={SIGNOFF_TONE[finding.signOff.status] ?? "neutral"}
            label={finding.signOff.status}
            dot
          />
        </div>

        {/* The verbatim quote. This is the evidence — without it the severity
            above is an assertion a lawyer cannot check. */}
        <blockquote className="border-l-2 border-border-strong bg-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-2 italic">
          {finding.quote}
        </blockquote>

        <dl className="space-y-1.5 text-[12.5px]">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Issue</dt>
            <dd className="min-w-0 flex-1">{finding.issue}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Risk</dt>
            <dd className="min-w-0 flex-1">{finding.risk}</dd>
          </div>
          {finding.marketStandard && (
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-ink-3">Market</dt>
              <dd className="min-w-0 flex-1">{finding.marketStandard}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Negotiability</dt>
            <dd className="min-w-0 flex-1">{finding.negotiability}</dd>
          </div>
        </dl>

        {finding.redline && (
          <div className="space-y-1.5 rounded-lg border border-border bg-sunken/60 p-3 text-[12.5px]">
            <div className="text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">
              Redline
            </div>
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
            {finding.signOff.status} by {finding.signOff.by} · {when(finding.signOff.at)} —{" "}
            {finding.signOff.note}
          </p>
        )}

        {signing ? (
          <SignOffForm
            reviewId={reviewId}
            findingId={finding.id}
            onDone={() => {
              setSigning(false);
              onSigned();
            }}
            onCancel={() => setSigning(false)}
          />
        ) : (
          <Button size="sm" onClick={() => setSigning(true)}>
            {finding.signOff.status === "pending" ? "Record a decision" : "Record a new decision"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function ReviewPanel({
  reviewId,
  onSigned,
}: {
  reviewId: string;
  onSigned: () => void;
}) {
  const [view, setView] = useState<"findings" | "report">("findings");
  const { data, loading, error, reload } = useApi<{ review: Review; contract?: Contract }>(
    `/api/reviews/${reviewId}`,
  );

  if (loading && !data) return <Loading rows={5} label="Reading the review…" />;
  if (error) return <ErrorNote>The review could not be read: {error}</ErrorNote>;
  if (!data) return null;

  const { review, contract } = data;
  const refresh = () => {
    reload();
    onSigned();
  };

  const groups: Severity[] = ["critical", "important", "acceptable"];

  return (
    <div className="space-y-5">
      {/* ── The banner. First, because it changes how everything below reads ── */}
      <Note>
        <strong>Awaiting legal sign-off — {review.signOff.status}.</strong> Every position below is
        a proposal by an AI assistant, not legal advice. Material terms must be reviewed by a
        lawyer before this agreement is signed or sent.
      </Note>

      <Card>
        <dl className="grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
          {[
            ["Document", contract?.filename ?? "(removed)"],
            ["Type", review.documentTypeLabel],
            ["Our position", label(POSITIONS, review.position)],
            ["Counterparty", review.counterparty ?? "—"],
            ["Parties", review.parties.join("; ") || "—"],
            ["Governing law", review.governingLaw ?? "—"],
            ["Document status", review.documentStatus],
            ["Reviewed", `${when(review.createdAt)} · ${review.model}`],
          ].map(([term, value]) => (
            <div key={term} className="flex gap-3">
              <dt className="w-32 shrink-0 text-ink-3">{term}</dt>
              <dd className="min-w-0 flex-1">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {review.preSigningAlerts.length > 0 && (
        <Section title="Before anyone signs">
          <Card>
            <ul className="space-y-1.5 text-[12.5px]">
              {review.preSigningAlerts.map((alert, index) => (
                <li key={index} className="flex gap-2">
                  <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />
                  <span>
                    <span className="font-medium">{alert.kind.replace(/-/g, " ")}</span>
                    {alert.location && <span className="text-ink-3"> ({alert.location})</span>}:{" "}
                    {alert.detail}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      <Section title="Summary">
        <Card>
          <p className="text-[13px] leading-relaxed">{review.executiveSummary}</p>
        </Card>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={view === "findings" ? "primary" : "secondary"}
          onClick={() => setView("findings")}
        >
          Findings
        </Button>
        <Button
          size="sm"
          variant={view === "report" ? "primary" : "secondary"}
          onClick={() => setView("report")}
        >
          Full report
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

      {view === "report" ? (
        <Card>
          <Markdown text={review.markdown} />
        </Card>
      ) : (
        <div className="space-y-5">
          {review.keyTerms.length > 0 && (
            <Section title="Key terms">
              <Table
                head={[
                  { label: "Term" },
                  { label: "Value" },
                  { label: "Clause" },
                  { label: "Market" },
                  { label: "Verdict" },
                ]}
              >
                {review.keyTerms.map((term, index) => (
                  <Tr key={index}>
                    <Td>{term.label}</Td>
                    <Td>{term.value}</Td>
                    <Td>{term.location}</Td>
                    <Td>{term.benchmark ?? "—"}</Td>
                    <Td>
                      <Badge
                        tone={
                          term.verdict === "standard"
                            ? "ok"
                            : term.verdict === "unknown"
                              ? "neutral"
                              : "warn"
                        }
                        label={term.verdict}
                      />
                    </Td>
                  </Tr>
                ))}
              </Table>
            </Section>
          )}

          {review.redFlags.length > 0 && (
            <Section
              title="Red-flag scan"
              description="Every flag is listed, present or not — a list of only the ones that fired cannot be told from a list of the ones that were checked."
            >
              <Table head={[{ label: "Flag" }, { label: "Present", width: "6rem" }, { label: "Clause" }]}>
                {review.redFlags.map((flag, index) => (
                  <Tr key={index}>
                    <Td>{flag.flag}</Td>
                    <Td>
                      {flag.found ? (
                        <Badge tone="crit" label="Yes" dot />
                      ) : (
                        <span className="text-ink-3">No</span>
                      )}
                    </Td>
                    <Td>{flag.location ?? "—"}</Td>
                  </Tr>
                ))}
              </Table>
            </Section>
          )}

          {groups.map((severity) => {
            const group = review.findings.filter((finding) => finding.severity === severity);
            if (group.length === 0) return null;
            return (
              <Section key={severity} title={`${HEADING[severity]} (${group.length})`}>
                <div className="space-y-3">
                  {group.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      reviewId={review.id}
                      onSigned={refresh}
                    />
                  ))}
                </div>
              </Section>
            );
          })}

          {review.standardsDeviations.length > 0 && (
            <Section
              title="Departures from our own playbook"
              description="A term can be perfectly market-standard and still breach a position this organisation has already taken."
            >
              <div className="space-y-3">
                {review.standardsDeviations.map((deviation, index) => (
                  <Card key={index}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[deviation.severity]} label={deviation.severity} dot />
                      <span className="text-[13.5px] font-semibold">{deviation.topic}</span>
                    </div>
                    <dl className="mt-2 space-y-1.5 text-[12.5px]">
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-ink-3">We require</dt>
                        <dd className="min-w-0 flex-1">{deviation.requirement}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-ink-3">This says</dt>
                        <dd className="min-w-0 flex-1">
                          {deviation.found}
                          {deviation.location && (
                            <span className="text-ink-3"> ({deviation.location})</span>
                          )}
                        </dd>
                      </div>
                      {deviation.remedy && (
                        <div className="flex gap-2">
                          <dt className="w-28 shrink-0 text-ink-3">Remedy</dt>
                          <dd className="min-w-0 flex-1">{deviation.remedy}</dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {review.missingProvisions.length > 0 && (
            <Section title="Missing provisions">
              <div className="space-y-3">
                {review.missingProvisions.map((missing, index) => (
                  <Card key={index}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[missing.priority]} label={missing.priority} dot />
                      <span className="text-[13.5px] font-semibold">{missing.provision}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px]">{missing.why}</p>
                    {missing.suggestedLanguage && (
                      <blockquote className="mt-2 border-l-2 border-border-strong bg-sunken px-3 py-2 text-[12.5px] italic">
                        {missing.suggestedLanguage}
                      </blockquote>
                    )}
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {review.consistencyIssues.length > 0 && (
            <Section title="Internal consistency">
              <Card>
                <ul className="space-y-1.5 text-[12.5px]">
                  {review.consistencyIssues.map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium">{issue.kind.replace(/-/g, " ")}</span>
                      {issue.location && <span className="text-ink-3"> ({issue.location})</span>}:{" "}
                      {issue.detail}
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          )}

          {review.negotiationPriority.length > 0 && (
            <Section title="What to negotiate, in order">
              <Table
                head={[
                  { label: "#", width: "3rem" },
                  { label: "Issue" },
                  { label: "Ask" },
                  { label: "Negotiability", width: "9rem" },
                ]}
              >
                {[...review.negotiationPriority]
                  .sort((a, b) => a.rank - b.rank)
                  .map((item, index) => (
                    <Tr key={index}>
                      <Td>{item.rank}</Td>
                      <Td>{item.issue}</Td>
                      <Td>{item.ask}</Td>
                      <Td>{item.negotiability}</Td>
                    </Tr>
                  ))}
              </Table>
            </Section>
          )}

          {/* Always rendered, even when empty. "Nothing was unreadable" is a
              claim worth making; an absent section reads as nobody checking. */}
          <Section title="Limitations of this review">
            <Card>
              {review.limitations.length === 0 ? (
                <p className="text-[12.5px] text-ink-2">
                  The document was read in full and no part of it was illegible or missing.
                </p>
              ) : (
                <ul className="space-y-1.5 text-[12.5px]">
                  {review.limitations.map((limitation, index) => (
                    <li key={index} className="flex gap-2">
                      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
        </div>
      )}

      <Section title="Sign off on the review as a whole">
        <Card>
          {review.signOff.status !== "pending" && (
            <p className="mb-3 text-[12.5px] text-ink-3">
              {review.signOff.status} by {review.signOff.by} · {when(review.signOff.at)} —{" "}
              {review.signOff.note}
            </p>
          )}
          <SignOffForm reviewId={review.id} onDone={refresh} />
        </Card>
      </Section>

      <InfoNote>
        This review is filed in the shared Drive folder under <code>output/</code>, as Markdown and
        as JSON.
      </InfoNote>
    </div>
  );
}
