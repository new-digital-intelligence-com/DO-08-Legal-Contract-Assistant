import { z } from "zod";

/**
 * The shapes the model is allowed to answer in.
 *
 * Two rules run through every schema here, and both are about what the model
 * must NOT be able to do.
 *
 * **`.nullable()`, never `.optional()`.** Structured outputs compile to a
 * strict JSON Schema where every declared key is required. An optional field is
 * a field the model may simply omit, and an omitted `location` is a finding a
 * lawyer cannot navigate to. Nullable makes "there isn't one" an explicit
 * answer the model has to give on purpose, which is a different thing from
 * silence.
 *
 * **Closed vocabularies as `z.enum`.** Severity, negotiability and contract
 * type are decoded against a fixed list rather than validated after the fact.
 * A free-text severity of "moderate-high" does not fail — it lands in a UI that
 * groups by three known values and quietly disappears from all of them.
 *
 * The findings the risk pass returns carry no `id` and no `signOff`. Both are
 * assigned in code: an id the model invents collides on the next run, and a
 * sign-off the model sets is precisely the thing this product exists to
 * prevent. They are absent from the schema so there is no field for it to fill.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Shared vocabularies
 * ────────────────────────────────────────────────────────────────────────── */

export const contractTypeEnum = z.enum([
  "nda",
  "saas",
  "msa",
  "dpa",
  "employment",
  "consulting",
  "reseller",
  "merchant",
  "ma",
  "broker",
  "license",
  "lease",
  "services",
  "other",
]);

export const positionEnum = z.enum([
  "customer",
  "vendor",
  "buyer",
  "seller",
  "licensor",
  "licensee",
  "receiving-party",
  "disclosing-party",
  "employer",
  "employee",
  "unknown",
]);

export const severityEnum = z.enum(["critical", "important", "acceptable"]);
export const negotiabilityEnum = z.enum(["high", "medium", "low", "none"]);
export const verdictEnum = z.enum(["standard", "off-market", "aggressive", "unknown"]);
export const documentStatusEnum = z.enum(["draft", "executed", "unknown"]);

/* ────────────────────────────────────────────────────────────────────────────
 * Pass 1 — intake
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * What the document is, before anybody argues about whether it is any good.
 *
 * Cheap, factual and run without thinking: none of these answers need
 * reasoning, and on the legacy model shape a thinking budget would take a third
 * of the tokens the answer needs.
 *
 * `pageCountReadable` is the question that stops the worst failure this app can
 * have. A scan that produced no legible text must come back as "I could not
 * read this", because the alternative — an empty findings list — renders as a
 * clean contract.
 */
export const IntakeSchema = z.object({
  documentTitle: z.string().describe("The agreement's own title, as printed on the first page."),
  documentType: contractTypeEnum,
  documentTypeLabel: z
    .string()
    .describe("The type as a person would say it, e.g. 'Mutual NDA' or 'SaaS subscription'."),
  parties: z.array(z.string()).describe("Every party's full legal name, as defined."),
  counterparty: z
    .string()
    .nullable()
    .describe("The party that is not us, given the stated position. Null if it cannot be told."),
  inferredPosition: positionEnum.describe(
    "Which side the reader appears to be on, judged from the document alone.",
  ),
  governingLaw: z.string().nullable(),
  documentStatus: documentStatusEnum,
  preSigningAlerts: z.array(
    z.object({
      kind: z.enum(["blank-field", "missing-exhibit", "unsigned", "truncated", "other"]),
      detail: z.string(),
      location: z.string().nullable(),
    }),
  ),
  pageCountReadable: z
    .boolean()
    .describe("False if the document is a scan you could not read, or is truncated."),
  limitations: z
    .array(z.string())
    .describe("Anything you could not read or were unsure of. Never leave a gap unstated."),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Pass 2 — the risk review
 * ────────────────────────────────────────────────────────────────────────── */

const KeyTermSchema = z.object({
  label: z.string(),
  value: z.string(),
  location: z.string().describe("Clause or section reference exactly as printed."),
  benchmark: z.string().nullable().describe("The market norm, when there is one."),
  verdict: verdictEnum,
});

/**
 * Every flag is returned whether or not it was found.
 *
 * A list of only the flags that fired reads identically to a list of the flags
 * that were checked, and those are different claims. `found: false` is the
 * evidence that somebody looked.
 */
const RedFlagSchema = z.object({
  flag: z.string(),
  found: z.boolean(),
  location: z.string().nullable(),
  quote: z.string().nullable(),
});

/**
 * A redline in three tiers.
 *
 * One "suggested change" leaves the negotiator to invent the fallback under
 * time pressure, which is exactly when a position gets conceded that did not
 * need to be. `walkAway` is nullable because most provisions do not have one,
 * and inventing a red line for a payment-terms clause devalues the ones that
 * are real.
 */
const RedlineSchema = z.object({
  preferred: z.string().describe("The opening ask, written as replacement language."),
  fallback: z.string().nullable().describe("The compromise that is still acceptable."),
  walkAway: z.string().nullable().describe("The point past which this needs an exception."),
});

const FindingSchema = z.object({
  severity: severityEnum,
  category: z.string().describe("Risk category, e.g. 'Limitation of Liability'."),
  title: z.string(),
  location: z.string().describe("Clause or section reference exactly as printed."),
  quote: z
    .string()
    .describe("Verbatim text from the document. Never paraphrase and never invent."),
  issue: z.string(),
  risk: z.string().describe("The concrete consequence, in this deal's terms."),
  marketStandard: z.string().nullable(),
  negotiability: negotiabilityEnum,
  redline: RedlineSchema.nullable().describe("Null for findings that need no change."),
});

export const RiskSchema = z.object({
  executiveSummary: z.string(),
  riskLevel: severityEnum,
  keyTerms: z.array(KeyTermSchema),
  redFlags: z.array(RedFlagSchema),
  findings: z
    .array(FindingSchema)
    .describe(
      "Every risk AND every provision reviewed and found acceptable. A review that lists only " +
        "problems reads as a demand for twelve changes; naming the clean provisions tells a " +
        "negotiator what not to spend leverage on.",
    ),
  missingProvisions: z.array(
    z.object({
      provision: z.string(),
      priority: severityEnum,
      why: z.string(),
      suggestedLanguage: z.string().nullable(),
    }),
  ),
  consistencyIssues: z.array(
    z.object({
      kind: z.enum([
        "broken-reference",
        "undefined-term",
        "conflicting-clause",
        "numbering",
        "other",
      ]),
      detail: z.string(),
      location: z.string().nullable(),
    }),
  ),
  negotiationPriority: z.array(
    z.object({
      rank: z.number().int(),
      issue: z.string(),
      ask: z.string(),
      negotiability: negotiabilityEnum,
    }),
  ),
  limitations: z.array(z.string()),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Pass 3 — the house playbook
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Where the document departs from positions the firm has already taken.
 *
 * Separate from the risk pass on purpose. The risk pass judges the contract
 * against the market; this one judges it against *us*, and the two disagree
 * often — a term can be perfectly market-standard and still be one this
 * company has decided it does not accept. Merging them would let a
 * market-standard verdict quietly overrule a house rule.
 */
export const DeviationsSchema = z.object({
  deviations: z.array(
    z.object({
      standardId: z.string().describe("The id of the standard, exactly as given in the playbook."),
      topic: z.string(),
      requirement: z.string().describe("What the standard requires."),
      found: z.string().describe("What the contract says instead."),
      location: z.string().nullable(),
      severity: severityEnum,
      remedy: z.string().nullable().describe("Language that brings it back in line."),
    }),
  ),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Policy and compliance answers
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `incomplete` is the field that keeps this honest.
 *
 * The question "do we accept uncapped indemnities" has two very different
 * answers: the one in the playbook, and the one a language model knows about
 * commercial contracting generally. Only the first is a fact about this
 * company. When the workspace does not hold the answer, the model must say so
 * rather than produce the second answer in the first one's voice.
 */
export const AnswerSchema = z.object({
  answer: z.string(),
  citations: z
    .array(z.string())
    .describe("Ids of the contracts, reviews and standards this leaned on."),
  incomplete: z
    .boolean()
    .describe("True when the workspace did not hold what was needed to answer fully."),
  missing: z
    .array(z.string())
    .describe("What was needed and absent. Empty when the answer was complete."),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Drafting
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `openPoints` is required and must never come back empty on a real draft.
 *
 * A drafter that silently picks a price, a term or a governing law has done the
 * most dangerous possible thing: filled a commercial decision with something
 * plausible, in a document somebody is about to sign. The gap gets noticed; the
 * invention gets signed.
 */
export const DraftSchema = z.object({
  markdown: z.string().describe("The agreement, with numbered clauses."),
  openPoints: z
    .array(z.string())
    .describe(
      "Every commercial decision deliberately left for a person — price, term, notice " +
        "addresses, governing law where the brief did not say. Never invent these.",
    ),
  standardsUsed: z.array(z.string()).describe("Ids of the house standards this was written to."),
});
