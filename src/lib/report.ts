import { DISCLAIMER, orgName } from "./settings";
import { CONTRACT_TYPES, POSITIONS } from "./types";
import type {
  Contract,
  Finding,
  Negotiability,
  Position,
  Review,
  Severity,
} from "./types";

/**
 * The review, as Markdown, built in code from the structured data.
 *
 * Never a second model call. A model asked to write the prose version of a
 * review it produced a moment ago writes from its memory of the document rather
 * than from the findings, and the two drift: the JSON says the cap is three
 * months and the paragraph says six, and the paragraph is the part somebody
 * reads. Rendering deterministically makes that class of disagreement
 * impossible rather than unlikely.
 *
 * This file is also what lands in the shared Drive folder, so it has to stand
 * on its own — read by somebody who has never opened the console, months later,
 * with no other context.
 */

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  important: "Important",
  acceptable: "Reviewed and acceptable",
};

const NEGOTIABILITY_LABEL: Record<Negotiability, string> = {
  high: "High — usually accepted",
  medium: "Medium — depends on leverage",
  low: "Low — rarely changed",
  none: "None — legally or commercially fixed",
};

function positionLabel(position: Position): string {
  return POSITIONS.find((entry) => entry.id === position)?.label ?? position;
}

function typeLabel(review: Review): string {
  return (
    review.documentTypeLabel ||
    CONTRACT_TYPES.find((entry) => entry.id === review.documentType)?.label ||
    review.documentType
  );
}

/**
 * Escape a value going into a Markdown table cell.
 *
 * One quoted clause containing a pipe — and indemnity clauses are full of
 * "(a) | (b)" style enumerations — silently destroys the table for every row
 * after it. Newlines do the same thing, so they collapse to spaces.
 */
function cell(value: string | undefined | null): string {
  if (!value) return "—";
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "—";
}

/** A verbatim quote, as a blockquote, with every line prefixed. */
function quote(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function when(iso: string): string {
  // Fixed locale and UTC: this file is read by people in several places and a
  // date that renders differently depending on who opened it is a date two
  // people can disagree about.
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function renderFinding(finding: Finding, index: number): string {
  const lines: string[] = [
    `#### ${index}. ${finding.title}`,
    "",
    `**Clause ${finding.location}** · ${finding.category}`,
    "",
    quote(finding.quote),
    "",
    `- **Issue:** ${finding.issue}`,
    `- **Risk:** ${finding.risk}`,
  ];

  if (finding.marketStandard) lines.push(`- **Market standard:** ${finding.marketStandard}`);
  lines.push(`- **Negotiability:** ${NEGOTIABILITY_LABEL[finding.negotiability]}`);

  if (finding.deviatesFromStandard) {
    lines.push(`- **Departs from a house standard.** See the deviations section below.`);
  }

  if (finding.redline) {
    lines.push("", "**Redline**", "");
    lines.push(`- *Ask for:* ${finding.redline.preferred}`);
    if (finding.redline.fallback) lines.push(`- *Settle for:* ${finding.redline.fallback}`);
    if (finding.redline.walkAway) lines.push(`- *Escalate below:* ${finding.redline.walkAway}`);
  }

  lines.push(
    "",
    `*Sign-off: ${finding.signOff.status}${
      finding.signOff.by ? ` — ${finding.signOff.by}` : ""
    }${finding.signOff.note ? ` — "${finding.signOff.note}"` : ""}*`,
  );

  return lines.join("\n");
}

export function renderReport(review: Review, contract: Contract): string {
  const out: string[] = [];
  const title = contract.title || review.parties.join(" / ") || contract.filename;

  out.push(`# Contract review: ${title}`);
  out.push("");
  out.push(`*Prepared for ${orgName()} · ${when(review.createdAt)} · ${review.model}*`);
  out.push("");

  /* ── The banner, first, because it changes how everything below is read ── */
  out.push("> [!IMPORTANT]");
  out.push(
    `> **Awaiting legal sign-off — status: ${review.signOff.status}.** ${DISCLAIMER.replace(/\n/g, " ")}`,
  );
  out.push("");

  /* ── Metadata ─────────────────────────────────────────────────────────── */
  out.push("| | |");
  out.push("|---|---|");
  out.push(`| Document | ${cell(contract.filename)} |`);
  out.push(`| Type | ${cell(typeLabel(review))} |`);
  out.push(`| Our position | ${cell(positionLabel(review.position))} |`);
  out.push(`| Counterparty | ${cell(review.counterparty)} |`);
  out.push(`| Parties | ${cell(review.parties.join("; "))} |`);
  out.push(`| Governing law | ${cell(review.governingLaw)} |`);
  out.push(`| Document status | ${cell(review.documentStatus)} |`);
  out.push(`| Overall risk | ${cell(SEVERITY_LABEL[review.riskLevel])} |`);
  out.push("");

  /* ── Pre-signing alerts ───────────────────────────────────────────────── */
  if (review.preSigningAlerts.length > 0) {
    out.push("## Before anyone signs");
    out.push("");
    for (const alert of review.preSigningAlerts) {
      out.push(
        `- **${alert.kind.replace(/-/g, " ")}**${alert.location ? ` (${alert.location})` : ""}: ${alert.detail}`,
      );
    }
    out.push("");
  }

  /* ── Summary ──────────────────────────────────────────────────────────── */
  out.push("## Summary");
  out.push("");
  out.push(review.executiveSummary);
  out.push("");

  /* ── Key terms ────────────────────────────────────────────────────────── */
  if (review.keyTerms.length > 0) {
    out.push("## Key terms");
    out.push("");
    out.push("| Term | Value | Clause | Market standard | Verdict |");
    out.push("|---|---|---|---|---|");
    for (const term of review.keyTerms) {
      out.push(
        `| ${cell(term.label)} | ${cell(term.value)} | ${cell(term.location)} | ${cell(term.benchmark)} | ${cell(term.verdict)} |`,
      );
    }
    out.push("");
  }

  /* ── Red-flag scan ────────────────────────────────────────────────────── */
  if (review.redFlags.length > 0) {
    out.push("## Red-flag scan");
    out.push("");
    // Every flag is listed, found or not. A table of only the flags that fired
    // is indistinguishable from a table of the flags that were checked.
    out.push("| Flag | Present | Clause |");
    out.push("|---|---|---|");
    for (const flag of review.redFlags) {
      out.push(`| ${cell(flag.flag)} | ${flag.found ? "**Yes**" : "No"} | ${cell(flag.location)} |`);
    }
    out.push("");
  }

  /* ── Findings ─────────────────────────────────────────────────────────── */
  out.push("## Risk analysis");
  out.push("");

  const order: Severity[] = ["critical", "important", "acceptable"];
  for (const severity of order) {
    const group = review.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) continue;

    out.push(`### ${SEVERITY_LABEL[severity]} (${group.length})`);
    out.push("");

    if (severity === "acceptable") {
      // The clean provisions are a table rather than full entries. They matter
      // — they tell a negotiator what not to spend leverage on — but giving
      // them the same weight as a critical finding buries the critical one.
      out.push("| Provision | Clause | Note |");
      out.push("|---|---|---|");
      for (const finding of group) {
        out.push(`| ${cell(finding.title)} | ${cell(finding.location)} | ${cell(finding.issue)} |`);
      }
      out.push("");
      continue;
    }

    group.forEach((finding, index) => {
      out.push(renderFinding(finding, index + 1));
      out.push("");
    });
  }

  /* ── House standards ──────────────────────────────────────────────────── */
  if (review.standardsDeviations.length > 0) {
    out.push("## Departures from our own playbook");
    out.push("");
    out.push(
      "These are positions this organisation has already decided it takes. A term can be " +
        "perfectly market-standard and still appear here.",
    );
    out.push("");
    for (const deviation of review.standardsDeviations) {
      out.push(`### ${deviation.topic}`);
      out.push("");
      out.push(`- **We require:** ${deviation.requirement}`);
      out.push(
        `- **This contract says:** ${deviation.found}${deviation.location ? ` (${deviation.location})` : ""}`,
      );
      out.push(`- **Severity:** ${SEVERITY_LABEL[deviation.severity]}`);
      if (deviation.remedy) out.push(`- **Remedy:** ${deviation.remedy}`);
      out.push("");
    }
  }

  /* ── Missing provisions ───────────────────────────────────────────────── */
  if (review.missingProvisions.length > 0) {
    out.push("## Missing provisions");
    out.push("");
    for (const missing of review.missingProvisions) {
      out.push(`### ${missing.provision} — ${SEVERITY_LABEL[missing.priority]}`);
      out.push("");
      out.push(missing.why);
      if (missing.suggestedLanguage) {
        out.push("");
        out.push("**Suggested language**");
        out.push("");
        out.push(quote(missing.suggestedLanguage));
      }
      out.push("");
    }
  }

  /* ── Consistency ──────────────────────────────────────────────────────── */
  if (review.consistencyIssues.length > 0) {
    out.push("## Internal consistency");
    out.push("");
    for (const issue of review.consistencyIssues) {
      out.push(
        `- **${issue.kind.replace(/-/g, " ")}**${issue.location ? ` (${issue.location})` : ""}: ${issue.detail}`,
      );
    }
    out.push("");
  }

  /* ── Priority ─────────────────────────────────────────────────────────── */
  if (review.negotiationPriority.length > 0) {
    out.push("## What to negotiate, in order");
    out.push("");
    out.push("| # | Issue | Ask | Negotiability |");
    out.push("|---|---|---|---|");
    for (const item of [...review.negotiationPriority].sort((a, b) => a.rank - b.rank)) {
      out.push(
        `| ${item.rank} | ${cell(item.issue)} | ${cell(item.ask)} | ${cell(NEGOTIABILITY_LABEL[item.negotiability])} |`,
      );
    }
    out.push("");
  }

  /* ── Limitations ──────────────────────────────────────────────────────── */
  // Always rendered, even when empty. "Nothing was unreadable" is a claim worth
  // making explicitly; an absent section reads as though nobody checked.
  out.push("## Limitations of this review");
  out.push("");
  if (review.limitations.length === 0) {
    out.push(
      "The document was read in full and no part of it was illegible or missing. Everything " +
        "above is drawn from the text as printed.",
    );
  } else {
    for (const limitation of review.limitations) out.push(`- ${limitation}`);
  }
  out.push("");

  /* ── Foot ─────────────────────────────────────────────────────────────── */
  out.push("---");
  out.push("");
  out.push(`*${DISCLAIMER}*`);
  out.push("");
  out.push(
    `*Review ${review.id} · contract ${contract.id} · generated by DO-08 Legal Contract Assistant.*`,
  );

  return out.join("\n");
}
