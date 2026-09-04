import "server-only";
import { BUDGET, MODEL, explainModelError, readDocument, readText } from "./anthropic";
import { record } from "./audit";
import {
  getContract,
  readContractBase64,
  updateContract,
} from "./contracts";
import { fileOutput } from "./outputs";
import { renderReport } from "./report";
import { DeviationsSchema, IntakeSchema, RiskSchema } from "./schemas";
import { playbookText } from "./standards";
import { DISCLAIMER, orgName, reviewer } from "./settings";
import { mutate, newId, readStore } from "./store";
import { CONTRACT_TYPES, PENDING, POSITIONS } from "./types";
import type {
  ContractType,
  Finding,
  Position,
  Review,
  Severity,
  SignOffStatus,
} from "./types";

/**
 * The review pipeline.
 *
 * Three model passes, in a fixed order, each doing one job:
 *
 *   1. **Intake** — what this document is. Cheap, factual, no reasoning.
 *   2. **Risk** — the substantive review, from a stated side of the table.
 *   3. **Standards** — where it departs from this organisation's own playbook.
 *
 * They are separate calls rather than one large one for a reason that shows up
 * in the output rather than in the cost. The risk pass needs to know which
 * party we are before it can judge anything, and a single call that decides
 * that and then reasons from it will reason from a guess it has already
 * committed to. Splitting them means the position is settled — and, when it was
 * inferred rather than stated, *recorded as inferred* — before any judgement
 * depends on it.
 *
 * The standards pass is separate for a different reason: it judges the contract
 * against us, not against the market, and those disagree often. A term can be
 * entirely market-standard and still be one this company has decided it does
 * not accept. Merged into the risk pass, the market verdict would quietly
 * overrule the house rule.
 *
 * The Markdown report is rendered in code afterwards, never by a fourth call.
 */

const COLLECTION = "reviews";

/* ────────────────────────────────────────────────────────────────────────────
 * Prompts
 * ────────────────────────────────────────────────────────────────────────── */

const GROUND_RULES = `
Rules that override anything else you might do:

- Quote verbatim. Every finding carries the exact words from the document. Never paraphrase into
  the quote field, and never write a quote for text you did not read.
- One clause per quote. Where a finding spans several clauses, quote the single most important one
  and cite the others by reference in the issue. A quote stitched together from three clauses is
  not verbatim even when every word in it appears somewhere in the document, and a reader who goes
  to the cited clause will not find the sentence you showed them.
- Cite the clause reference exactly as the document prints it ("Section 10.2", "Clause 4(b)").
  A finding a lawyer cannot navigate to in ten seconds costs more time than it saves.
- Never state a term the document does not contain. If a provision is absent, that is a missing
  provision, not a term with a standard value. A missing figure is missing, never the usual one.
- Say what you could not read. A page you could not make out, a reference to an exhibit that is
  not attached, a clause that is ambiguous — all of it goes in limitations. An unstated gap is
  reported to a lawyer as a clean contract, which is the worst thing this tool can do.
- You do not decide anything. Every position you take is a proposal for a qualified lawyer to
  accept or reject. Write for that reader.
`.trim();

const INTAKE_SYSTEM = `
You read a commercial agreement and report what it is, before anybody argues about whether it is
any good. Facts only: the title, the type, the parties as they are legally defined, the governing
law, whether it is a draft or executed, and anything that is blank, missing or unsigned.

${GROUND_RULES}

On pageCountReadable: answer false if this is a scan you cannot make out, or if the document is
plainly truncated. Answering true for an unreadable document produces an empty review that reads
as a clean contract.
`.trim();

function riskSystem(position: Position, contractType: ContractType, org: string): string {
  const positionLabel = POSITIONS.find((entry) => entry.id === position)?.label ?? position;
  const typeLabel =
    CONTRACT_TYPES.find((entry) => entry.id === contractType)?.label ?? contractType;

  return `
You are a commercial contracts lawyer reviewing a ${typeLabel} on behalf of ${org}.

**We are the ${positionLabel}.** This is the single most consequential fact in the review and it
inverts most judgements. A three-month liability cap is a serious problem for a customer and a
win for a vendor. A broad indemnity is a risk to the party giving it and protection to the party
receiving it. Judge every clause by what it does to US, in this position — not by whether it is
unusual in the abstract.

Assess the power dynamic and let it shape negotiability rather than severity. A term can be
seriously bad and realistically unchangeable; say both. Severity is about exposure, negotiability
is about what is achievable, and collapsing them produces advice nobody can act on.

## What to produce

- **Findings.** Every material risk, worst first. Also — and this is not optional — the provisions
  you reviewed and found acceptable, at severity "acceptable". A review listing only problems
  reads as a demand for twelve changes. Naming the clean provisions tells a negotiator what not to
  spend leverage on, and it is how a reader knows the review was thorough rather than alarmist.
- **Red flags.** Return the standard scan with an entry for EVERY flag below, with found true or
  false. A list of only the ones that fired cannot be told from a list of the ones you checked:
  liability cap under 6 months; uncapped indemnification; "as-is" with no warranty; unilateral
  suspension without notice; unilateral amendment rights; no termination for convenience;
  perpetual obligations; offshore jurisdiction; automatic renewal with a long notice window;
  "sole discretion" language favouring the counterparty; class-action waiver with mandatory
  arbitration; asymmetric assignment rights.
- **Key terms**, with the market benchmark where one exists.
- **Missing provisions** that a document of this type should have and does not.
- **Internal consistency** — cross-references to clauses or exhibits that do not exist, terms used
  before they are defined, clauses that contradict each other, broken numbering.
- **Negotiation priority** — ranked, with the specific ask for each.

## Redlines

Where a finding needs a change, give replacement language, not an instruction. "Negotiate a higher
cap" is not a redline; a sentence somebody can paste into the document is. Give the opening ask
and, where there is a sensible compromise, the fallback. Only give a walk-away where one is
genuinely warranted — a red line on every provision is a red line on none.

## Benchmarks to judge against

Liability cap: 12 months' fees standard, 6-11 marginal, under 6 a red flag. Non-compete: 1-2 years
standard, 3-4 marginal, 5+ a red flag; void in California, North Dakota, Oklahoma and Minnesota
regardless of what the document says. Auto-renewal notice: 90+ days to prevent is customer-hostile,
30 days is fine. Indemnification: mutual and capped is standard, asymmetric is marginal, uncapped
is a red flag. Rep survival in M&A: 12-18 months standard, 24-30 marginal, 36+ a red flag. Escrow:
10-15% for 12-18 months standard. Confidentiality: 3 years standard, indefinite for trade secrets.
Broker fee tail: 12-18 months standard, perpetual a red flag. SLA: 99.9% with credits standard, a
percentage with no credit is not a service level. Data export: 90 days in a standard format.
Price increase: CPI or 5% a year. Cure period: 30 days.

${GROUND_RULES}
`.trim();
}

const STANDARDS_SYSTEM = `
You compare a contract review against an organisation's own contracting playbook, and report only
where the document departs from it.

This is a different question from whether a term is market-standard, and you must not confuse
them. A clause can be entirely normal in the market and still breach a house standard — that is a
deviation, and it is the whole reason this pass exists. A clause can also be unusual and still
comply. Judge only against the standards given.

Report a deviation only where the contract genuinely conflicts with a stated requirement. Do not
report a standard as breached because the contract is silent on it unless the standard requires
that term to be present. Use the exact standardId given in the playbook — an invented id cannot be
linked back to anything.

Return an empty list if the document complies. An empty list is a complete answer.
`.trim();

/* ────────────────────────────────────────────────────────────────────────────
 * The pipeline
 * ────────────────────────────────────────────────────────────────────────── */

/** The worst severity actually present, never an average of them. */
function worstSeverity(findings: Finding[]): Severity {
  if (findings.some((finding) => finding.severity === "critical")) return "critical";
  if (findings.some((finding) => finding.severity === "important")) return "important";
  return "acceptable";
}

export async function reviewContract(input: {
  contractId: string;
  position?: Position;
  contractType?: ContractType;
  actor?: string;
}): Promise<Review> {
  const actor = input.actor?.trim() || reviewer();
  const contract = await getContract(input.contractId);
  if (!contract) throw new Error(`No contract with id ${input.contractId}.`);

  const started = Date.now();
  await updateContract(contract.id, { status: "reviewing", error: undefined });

  try {
    const base64 = await readContractBase64(contract.id);
    const pdf = { base64, filename: contract.filename };
    let inputTokens = 0;
    let outputTokens = 0;

    /* ── Pass 1: intake ────────────────────────────────────────────────── */
    const intake = await readDocument({
      system: INTAKE_SYSTEM,
      instruction:
        "Report what this document is. Facts as printed, and state anything you could not read.",
      pdf,
      schema: IntakeSchema,
      maxTokens: BUDGET.intakeTokens,
      think: false,
    });
    inputTokens += intake.usage.inputTokens;
    outputTokens += intake.usage.outputTokens;

    const limitations = [...intake.value.limitations];

    // The position, settled before anything is judged from it.
    const stated = input.position ?? (contract.position !== "unknown" ? contract.position : undefined);
    const position = stated ?? intake.value.inferredPosition;
    if (!stated) {
      limitations.push(
        `Nobody stated which party we are, so the review was run as the ` +
          `${POSITIONS.find((entry) => entry.id === position)?.label ?? position}, inferred from ` +
          `the document. If that is wrong, most of the findings below invert — set the position ` +
          `and run it again.`,
      );
    }

    const contractType = input.contractType ?? contract.contractType ?? intake.value.documentType;

    if (!intake.value.pageCountReadable) {
      limitations.push(
        "Parts of this document could not be read. Treat the findings below as covering only " +
          "what was legible, and have a person check the original.",
      );
    }

    /* ── Pass 2: the risk review ───────────────────────────────────────── */
    const risk = await readDocument({
      system: riskSystem(position, contractType, orgName()),
      instruction:
        `Review this ${contract.filename} in full. We are the ` +
        `${POSITIONS.find((entry) => entry.id === position)?.label ?? position}. ` +
        `Return every material risk, every provision you reviewed and found acceptable, the ` +
        `complete red-flag scan, and ranked redlines.`,
      pdf,
      schema: RiskSchema,
      maxTokens: BUDGET.reviewTokens,
    });
    inputTokens += risk.usage.inputTokens;
    outputTokens += risk.usage.outputTokens;
    limitations.push(...risk.value.limitations);

    // Ids and sign-off are assigned here, not by the model. An id the model
    // invents collides across runs, and a sign-off it sets is exactly what
    // this product forbids.
    const findings: Finding[] = risk.value.findings.map((finding) => ({
      id: newId("fnd"),
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      location: finding.location,
      quote: finding.quote,
      issue: finding.issue,
      risk: finding.risk,
      marketStandard: finding.marketStandard ?? undefined,
      negotiability: finding.negotiability,
      redline: finding.redline
        ? {
            preferred: finding.redline.preferred,
            fallback: finding.redline.fallback ?? undefined,
            walkAway: finding.redline.walkAway ?? undefined,
          }
        : undefined,
      signOff: { ...PENDING },
    }));

    /* ── Pass 3: the house playbook ────────────────────────────────────── */
    const playbook = await playbookText(contractType);
    let deviations: Review["standardsDeviations"] = [];

    if (playbook) {
      const summary = findings
        .map(
          (finding) =>
            `- [${finding.severity}] ${finding.title} (${finding.location}): ${finding.issue} — quoted: "${finding.quote.slice(0, 300)}"`,
        )
        .join("\n");
      const terms = risk.value.keyTerms
        .map((term) => `- ${term.label}: ${term.value} (${term.location})`)
        .join("\n");

      const checked = await readText({
        system: STANDARDS_SYSTEM,
        prompt: [
          `## Our playbook`,
          "",
          playbook,
          "",
          `## The contract's key terms`,
          "",
          terms || "(none extracted)",
          "",
          `## What the review found`,
          "",
          summary || "(no findings)",
          "",
          `Report only where this contract departs from a standard above.`,
        ].join("\n"),
        schema: DeviationsSchema,
        maxTokens: BUDGET.standardsTokens,
      });
      inputTokens += checked.usage.inputTokens;
      outputTokens += checked.usage.outputTokens;

      deviations = checked.value.deviations.map((deviation) => ({
        standardId: deviation.standardId,
        topic: deviation.topic,
        requirement: deviation.requirement,
        found: deviation.found,
        location: deviation.location ?? undefined,
        severity: deviation.severity,
        remedy: deviation.remedy ?? undefined,
      }));

      // Mark the findings a deviation lands on, so the report can point at the
      // house rule from beside the clause rather than only in its own section.
      for (const deviation of deviations) {
        const hit = findings.find(
          (finding) => deviation.location && finding.location === deviation.location,
        );
        if (hit) {
          hit.standardId = deviation.standardId;
          hit.deviatesFromStandard = true;
        }
      }
    } else {
      limitations.push(
        "The house playbook is empty, so this review was judged against market norms only and " +
          "not against this organisation's own positions.",
      );
    }

    /* ── Assemble ──────────────────────────────────────────────────────── */
    const review: Review = {
      id: newId("rev"),
      contractId: contract.id,
      createdAt: new Date().toISOString(),
      createdBy: actor,
      model: MODEL,
      documentType: contractType,
      documentTypeLabel: intake.value.documentTypeLabel,
      position,
      counterparty: intake.value.counterparty ?? contract.counterparty,
      parties: intake.value.parties,
      governingLaw: intake.value.governingLaw ?? undefined,
      documentStatus: intake.value.documentStatus,
      riskLevel: worstSeverity(findings),
      executiveSummary: risk.value.executiveSummary,
      preSigningAlerts: intake.value.preSigningAlerts.map((alert) => ({
        kind: alert.kind,
        detail: alert.detail,
        location: alert.location ?? undefined,
      })),
      keyTerms: risk.value.keyTerms.map((term) => ({
        label: term.label,
        value: term.value,
        location: term.location,
        benchmark: term.benchmark ?? undefined,
        verdict: term.verdict,
      })),
      redFlags: risk.value.redFlags.map((flag) => ({
        flag: flag.flag,
        found: flag.found,
        location: flag.location ?? undefined,
        quote: flag.quote ?? undefined,
      })),
      findings,
      missingProvisions: risk.value.missingProvisions.map((missing) => ({
        provision: missing.provision,
        priority: missing.priority,
        why: missing.why,
        suggestedLanguage: missing.suggestedLanguage ?? undefined,
      })),
      consistencyIssues: risk.value.consistencyIssues.map((issue) => ({
        kind: issue.kind,
        detail: issue.detail,
        location: issue.location ?? undefined,
      })),
      negotiationPriority: risk.value.negotiationPriority,
      standardsDeviations: deviations,
      limitations,
      markdown: "",
      signOff: { ...PENDING },
      elapsedMs: Date.now() - started,
      usage: { inputTokens, outputTokens },
    };

    review.markdown = renderReport(review, contract);

    // Drive before the register, for the same reason as an upload: an
    // `outputJson` in a stored row that no write produced is a claim the app
    // cannot back up.
    const filed = await fileOutput(review, contract);
    review.outputJson = filed.json;
    review.outputMarkdown = filed.markdown;

    await mutate<Review[], void>(COLLECTION, [], (all) => ({
      next: [review, ...all],
      result: undefined,
    }));

    await updateContract(contract.id, {
      status: "reviewed",
      error: undefined,
      latestReviewId: review.id,
      reviewCount: contract.reviewCount + 1,
      position,
      contractType,
      counterparty: review.counterparty ?? contract.counterparty,
      title: contract.title || intake.value.documentTitle,
    });

    await record({
      actor,
      action: "contract.review",
      subject: contract.id,
      detail:
        `Reviewed ${contract.filename} as the ${position}. ` +
        `${findings.filter((f) => f.severity !== "acceptable").length} risks ` +
        `(${findings.filter((f) => f.severity === "critical").length} critical), ` +
        `${deviations.length} departures from the playbook. ` +
        `Every position is pending legal sign-off. Filed to Drive output/.`,
    });

    return review;
  } catch (error) {
    const explained = explainModelError(error);
    // The contract must not sit in the list looking reviewed. A failed review
    // is a contract nobody has looked at, and it has to read that way.
    await updateContract(contract.id, { status: "failed", error: explained.message });
    await record({
      actor,
      action: "contract.review.failed",
      subject: contract.id,
      detail: `Review of ${contract.filename} failed: ${explained.message}`,
    });
    throw error;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading reviews
 * ────────────────────────────────────────────────────────────────────────── */

export async function listReviews(filter?: {
  contractId?: string;
  limit?: number;
}): Promise<Review[]> {
  const all = await readStore<Review[]>(COLLECTION, []);
  const matched = filter?.contractId
    ? all.filter((review) => review.contractId === filter.contractId)
    : all;
  return filter?.limit ? matched.slice(0, filter.limit) : matched;
}

export async function getReview(id: string): Promise<Review | undefined> {
  return (await readStore<Review[]>(COLLECTION, [])).find((review) => review.id === id);
}

/** The most recent review in the workspace, whichever contract it belongs to. */
export async function latestReview(): Promise<Review | undefined> {
  return (await readStore<Review[]>(COLLECTION, []))[0];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sign-off
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The only way a `SignOff` leaves `pending`.
 *
 * There is deliberately no other path in this codebase, and no argument that
 * lets a caller skip the name or the note. This is the product's one hard
 * promise: a qualified person took this position, and the trail says who and
 * why. A sign-off with no note is indistinguishable six months later from a
 * position nobody looked at.
 *
 * Re-rendering the Markdown afterwards matters more than it looks. The report
 * on Drive carries each finding's sign-off state, and a lawyer reading the file
 * in the shared folder rather than in this console must see the same answer.
 */
export async function signOff(input: {
  reviewId: string;
  findingId?: string;
  status: SignOffStatus;
  by: string;
  note: string;
}): Promise<Review> {
  const by = input.by?.trim();
  const note = input.note?.trim();
  if (!by) throw new Error("A sign-off needs the name of the person making it.");
  if (!note) {
    throw new Error(
      "A sign-off needs a note saying what was decided and why. It is written to the audit " +
        "trail, and a position closed without one reads later as a position nobody looked at.",
    );
  }
  if (input.status === "pending") {
    throw new Error("A sign-off cannot be set back to pending; record a new decision instead.");
  }

  const decision = { status: input.status, by, note, at: new Date().toISOString() };

  const updated = await mutate<Review[], Review>(COLLECTION, [], (all) => {
    const index = all.findIndex((review) => review.id === input.reviewId);
    if (index === -1) throw new Error(`No review with id ${input.reviewId}.`);

    const review = { ...all[index] };

    if (input.findingId) {
      const finding = review.findings.find((entry) => entry.id === input.findingId);
      if (!finding) {
        throw new Error(`No finding with id ${input.findingId} in review ${input.reviewId}.`);
      }
      review.findings = review.findings.map((entry) =>
        entry.id === input.findingId ? { ...entry, signOff: decision } : entry,
      );
    } else {
      review.signOff = decision;
    }

    const next = [...all];
    next[index] = review;
    return { next, result: review };
  });

  const contract = await getContract(updated.contractId);
  if (contract) {
    const rerendered = { ...updated, markdown: renderReport(updated, contract) };
    await mutate<Review[], void>(COLLECTION, [], (all) => ({
      next: all.map((review) => (review.id === rerendered.id ? rerendered : review)),
      result: undefined,
    }));
    const filed = await fileOutput(rerendered, contract);
    if (filed.json || filed.markdown) {
      await mutate<Review[], void>(COLLECTION, [], (all) => ({
        next: all.map((review) =>
          review.id === rerendered.id
            ? {
                ...rerendered,
                outputJson: filed.json ?? review.outputJson,
                outputMarkdown: filed.markdown ?? review.outputMarkdown,
              }
            : review,
        ),
        result: undefined,
      }));
    }
  }

  const target = input.findingId
    ? updated.findings.find((entry) => entry.id === input.findingId)
    : undefined;

  await record({
    actor: by,
    action: input.findingId ? "finding.signoff" : "review.signoff",
    subject: input.findingId ?? input.reviewId,
    note,
    detail:
      `${by} marked ${target ? `"${target.title}" (${target.location})` : `review ${updated.id}`} ` +
      `as ${input.status}. ${DISCLAIMER}`,
  });

  return (await getReview(input.reviewId)) ?? updated;
}
