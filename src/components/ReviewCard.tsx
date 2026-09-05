"use client";

import Link from "next/link";
import { Badge, Card } from "./ui";
import { Icon } from "./icons";
import { when } from "./api";
import { POSITIONS } from "@/lib/types";
import type { Contract, Review, Severity } from "@/lib/types";

/**
 * One contract, summarised, linking to its full review.
 *
 * The card carries the four things somebody scanning a list actually needs:
 * what the document is, which side we are on, how bad it is, and the worst two
 * or three things in it. Everything else — the quotes, the redlines, the
 * sign-off controls — is a click away, because a page that inlines four full
 * reviews is a page nobody can scan.
 *
 * The headline counts deliberately exclude `acceptable` findings. A card
 * reading "17 findings" beside a green badge is confusing; "2 critical, 6
 * important" is the number a person is deciding on.
 */

const RISK_TONE: Record<Severity, "crit" | "warn" | "ok"> = {
  critical: "crit",
  important: "warn",
  acceptable: "ok",
};

const RISK_LABEL: Record<Severity, string> = {
  critical: "Critical risk",
  important: "Needs attention",
  acceptable: "No material risk",
};

function positionLabel(id: string): string {
  return POSITIONS.find((entry) => entry.id === id)?.label ?? id;
}

export function ReviewCard({
  contract,
  review,
  /** The headline card is bigger and shows the summary and top findings. */
  featured = false,
}: {
  contract: Contract;
  review?: Review;
  featured?: boolean;
}) {
  const critical = review?.findings.filter((f) => f.severity === "critical") ?? [];
  const important = review?.findings.filter((f) => f.severity === "important") ?? [];
  const acceptable = review?.findings.filter((f) => f.severity === "acceptable") ?? [];
  const pending =
    review?.findings.filter((f) => f.signOff.status === "pending" && f.severity !== "acceptable")
      .length ?? 0;

  // Worst first, and only a few — the card is a pointer, not the review.
  const headline = [...critical, ...important].slice(0, featured ? 3 : 2);

  return (
    <Link href={`/contract/${contract.id}`} className="block">
      <Card
        padded={false}
        className="transition hover:border-border-strong hover:shadow-pop"
      >
        <div className={featured ? "p-5" : "p-4"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`truncate font-semibold ${featured ? "text-[16px]" : "text-[13.5px]"}`}
                >
                  {contract.title || contract.filename}
                </span>
                {review ? (
                  <Badge
                    tone={RISK_TONE[review.riskLevel]}
                    label={RISK_LABEL[review.riskLevel]}
                    dot
                  />
                ) : contract.status === "failed" ? (
                  <Badge tone="crit" label="review failed" dot />
                ) : (
                  <Badge tone="neutral" label="not reviewed" dot />
                )}
              </div>

              <p className="mt-1 text-[12px] text-ink-3">
                {[
                  review?.documentTypeLabel,
                  `we are the ${positionLabel(contract.position)}`,
                  review?.counterparty ?? contract.counterparty,
                  review?.governingLaw ? `${review.governingLaw} law` : undefined,
                  when(contract.uploadedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <Icon name="chevron" className="mt-1 size-4 shrink-0 text-ink-3" />
          </div>

          {/* ── The main points ──────────────────────────────────────────── */}
          {review && (
            <>
              {featured && (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                  {review.executiveSummary}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                <span className={critical.length ? "text-crit-ink" : "text-ink-3"}>
                  <span className="tnum font-semibold">{critical.length}</span> critical
                </span>
                <span className={important.length ? "text-warn-ink" : "text-ink-3"}>
                  <span className="tnum font-semibold">{important.length}</span> important
                </span>
                <span className="text-ink-3">
                  <span className="tnum font-semibold">{acceptable.length}</span> acceptable
                </span>
                {review.standardsDeviations.length > 0 && (
                  <span className="text-ink-3">
                    <span className="tnum font-semibold">{review.standardsDeviations.length}</span>{" "}
                    playbook departures
                  </span>
                )}
                {review.preSigningAlerts.length > 0 && (
                  <span className="text-warn-ink">
                    <span className="tnum font-semibold">{review.preSigningAlerts.length}</span>{" "}
                    pre-signing alerts
                  </span>
                )}
                {pending > 0 && (
                  <span className="text-ink-3">
                    <span className="tnum font-semibold">{pending}</span> awaiting sign-off
                  </span>
                )}
              </div>

              {headline.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-2.5 text-[12.5px]">
                  {headline.map((finding) => (
                    <li key={finding.id} className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                          finding.severity === "critical" ? "bg-crit-ink" : "bg-warn-ink"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="text-ink-2">{finding.title}</span>
                        <span className="text-ink-3"> — {finding.location}</span>
                      </span>
                    </li>
                  ))}
                  {critical.length + important.length > headline.length && (
                    <li className="pl-3.5 text-ink-3">
                      and {critical.length + important.length - headline.length} more
                    </li>
                  )}
                </ul>
              )}
            </>
          )}

          {contract.status === "failed" && (
            <p className="mt-2 text-[12.5px] text-crit-ink">{contract.error}</p>
          )}

          {featured && (
            <p className="mt-3 text-[12.5px] font-medium text-brand-ink">
              Read the full review →
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
