import "server-only";
import { BUDGET, readText } from "./anthropic";
import { record } from "./audit";
import { AnswerSchema } from "./schemas";
import { listStandards } from "./standards";
import { orgName, reviewer } from "./settings";
import { append, newId, readStore } from "./store";
import type { Answer, Contract, Review, Standard } from "./types";

/**
 * Policy and compliance questions, answered from the workspace and nowhere else.
 *
 * The distinction this module exists to hold is narrow and easy to lose. Asked
 * "do we accept uncapped indemnities", a language model has two answers
 * available: the one in this organisation's playbook, and a well-informed
 * general account of commercial contracting. Only the first is a fact about
 * this company. The second is not wrong — it is worse than wrong, because it
 * arrives in the same confident voice and gets repeated to a counterparty as
 * though it were policy.
 *
 * So the grounding context is assembled here, from the playbook, the register
 * and past findings, and the model is told plainly that anything outside it is
 * not an answer. When the workspace does not hold what was needed, `incomplete`
 * comes back true and `missing` says what was absent — which is a genuinely
 * useful answer, because it tells somebody which standard to go and write.
 */

const COLLECTION = "answers";

/**
 * How much of the workspace goes into one prompt.
 *
 * The register grows without limit and the context does not. These caps are set
 * so a workspace of two hundred contracts still produces a prompt that fits,
 * and the truncation is *reported to the model* rather than hidden — a model
 * that believes it has seen every contract will answer "no" to "do we have
 * anything with X" on the strength of a list that was cut short.
 */
const LIMITS = {
  contracts: 60,
  reviews: 25,
  findingsPerReview: 8,
};

function summariseStandards(standards: Standard[]): string {
  if (standards.length === 0) {
    return "(The playbook is empty. This organisation has not recorded any contracting positions.)";
  }
  return standards
    .map(
      (standard) =>
        `- [${standard.id}] **${standard.topic}** — ${standard.requirement}` +
        (standard.fallback ? ` Fallback: ${standard.fallback}` : "") +
        (standard.walkAway ? ` Escalate: ${standard.walkAway}` : "") +
        (standard.owner ? ` (owner: ${standard.owner})` : ""),
    )
    .join("\n");
}

function summariseContracts(contracts: Contract[]): { text: string; truncated: boolean } {
  const shown = contracts.slice(0, LIMITS.contracts);
  const text =
    shown.length === 0
      ? "(No contracts have been uploaded.)"
      : shown
          .map(
            (contract) =>
              `- [${contract.id}] ${contract.filename}` +
              (contract.title ? ` — "${contract.title}"` : "") +
              ` · type ${contract.contractType ?? "unclassified"}` +
              ` · we are the ${contract.position}` +
              (contract.counterparty ? ` · counterparty ${contract.counterparty}` : "") +
              ` · ${contract.status}`,
          )
          .join("\n");
  return { text, truncated: contracts.length > shown.length };
}

function summariseReviews(reviews: Review[]): { text: string; truncated: boolean } {
  const shown = reviews.slice(0, LIMITS.reviews);
  if (shown.length === 0) return { text: "(Nothing has been reviewed yet.)", truncated: false };

  const text = shown
    .map((review) => {
      const findings = review.findings
        .filter((finding) => finding.severity !== "acceptable")
        .slice(0, LIMITS.findingsPerReview)
        .map(
          (finding) =>
            `    - [${finding.severity}] ${finding.title} (${finding.location}) — ` +
            `sign-off: ${finding.signOff.status}`,
        )
        .join("\n");

      return (
        `- [${review.id}] on contract ${review.contractId} · ${review.documentTypeLabel} · ` +
        `we are the ${review.position} · overall ${review.riskLevel} · ` +
        `review sign-off: ${review.signOff.status}\n` +
        (findings || "    (no material findings)") +
        (review.standardsDeviations.length > 0
          ? `\n    Departures from the playbook: ${review.standardsDeviations
              .map((deviation) => deviation.topic)
              .join(", ")}`
          : "")
      );
    })
    .join("\n");

  return { text, truncated: reviews.length > shown.length };
}

const SYSTEM = `
You answer questions about one organisation's contracting position, using only the workspace
below: its contracting playbook, the contracts it holds, and what past reviews found.

## The rule that matters

Anything not in the workspace is not an answer. If somebody asks what this organisation's position
is on a topic the playbook does not cover, the answer is that the playbook does not cover it — set
incomplete to true and put the gap in "missing". Do not fill it from general knowledge of
commercial contracting. A general answer given in the voice of company policy is how a position
nobody agreed to gets repeated to a counterparty.

The same applies to the register. "Do we have an agreement with X" is answered from the contracts
listed. If none matches, say none matches. If the list was truncated, say the search was over a
partial list — never report "no" from an incomplete list as though it were "none exists".

## How to answer

- Lead with the answer, then the support. A lawyer reading this is deciding something.
- Cite the ids you used — contract ids, review ids, standard ids — in the citations array. An
  answer with no citations should be rare and usually means incomplete is true.
- Quote the playbook's own wording when stating a position, rather than restating it.
- Where the workspace holds a relevant finding that is still pending sign-off, say so. A position
  that has not been signed off is not yet this organisation's position.
- This is not legal advice and you do not decide anything. Where a question needs a legal judgement
  rather than a lookup, say which lawyer's decision it is.
`.trim();

export async function ask(input: { question: string; actor?: string }): Promise<Answer> {
  const actor = input.actor?.trim() || reviewer();
  const question = input.question?.trim();
  if (!question) throw new Error("Ask a question.");

  const [standards, contracts, reviews] = await Promise.all([
    listStandards(),
    readStore<Contract[]>("contracts", []),
    readStore<Review[]>("reviews", []),
  ]);

  const contractSummary = summariseContracts(contracts);
  const reviewSummary = summariseReviews(reviews);

  const truncations: string[] = [];
  if (contractSummary.truncated) {
    truncations.push(
      `Only the ${LIMITS.contracts} most recent of ${contracts.length} contracts are listed. ` +
        `Do not answer "we have none" from this list.`,
    );
  }
  if (reviewSummary.truncated) {
    truncations.push(
      `Only the ${LIMITS.reviews} most recent of ${reviews.length} reviews are shown, and at ` +
        `most ${LIMITS.findingsPerReview} findings from each.`,
    );
  }

  const result = await readText({
    system: SYSTEM,
    prompt: [
      `# ${orgName()}'s workspace`,
      "",
      "## Contracting playbook",
      "",
      summariseStandards(standards),
      "",
      "## Contracts on file",
      "",
      contractSummary.text,
      "",
      "## Review findings",
      "",
      reviewSummary.text,
      "",
      ...(truncations.length > 0
        ? ["## What you are NOT seeing", "", ...truncations.map((line) => `- ${line}`), ""]
        : []),
      "## The question",
      "",
      question,
    ].join("\n"),
    schema: AnswerSchema,
    maxTokens: BUDGET.answerTokens,
  });

  const answer: Answer = {
    id: newId("ans"),
    at: new Date().toISOString(),
    by: actor,
    question,
    // The gaps are appended to the answer text as well as carried structurally.
    // A caller that renders only `answer` must still see that something was
    // missing, because that is the half of the response that changes what a
    // person does next.
    answer:
      result.value.incomplete && result.value.missing.length > 0
        ? `${result.value.answer}\n\n**Not in the workspace:**\n${result.value.missing
            .map((gap) => `- ${gap}`)
            .join("\n")}`
        : result.value.answer,
    citations: result.value.citations,
    incomplete: result.value.incomplete,
  };

  await append<Answer>(COLLECTION, answer, 500);

  await record({
    actor,
    action: "policy.ask",
    subject: answer.id,
    detail:
      `Asked: "${question.slice(0, 160)}${question.length > 160 ? "…" : ""}". ` +
      `Answered from ${answer.citations.length} source${answer.citations.length === 1 ? "" : "s"}` +
      `${answer.incomplete ? ", incomplete — the workspace did not hold everything needed." : "."}`,
  });

  return answer;
}

export async function listAnswers(limit?: number): Promise<Answer[]> {
  const all = await readStore<Answer[]>(COLLECTION, []);
  return limit ? all.slice(0, limit) : all;
}
