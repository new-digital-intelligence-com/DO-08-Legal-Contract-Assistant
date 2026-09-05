/**
 * The domain model, in one file, because every other module agrees on it.
 *
 * Two ideas shape the shapes below.
 *
 * **A finding is evidence, not an opinion.** Every risk this app raises carries
 * the clause reference and the quoted text it came from. A severity with no
 * quote is an assertion a lawyer cannot check, and an unverifiable assertion is
 * worse than silence — it costs them the time to go and find the clause anyway,
 * having already been told what to think about it.
 *
 * **Nothing here is a decision.** `SignOff` hangs off every finding and every
 * review, it starts `pending`, and no code path in this app sets it to
 * `approved` — only a named person through a route that records their note. The
 * model proposes a position; a lawyer takes it. That distinction is the whole
 * product, so it is in the type system rather than in a paragraph of a README.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Vocabulary
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Document types with their own checklist. `other` is a real answer, not a
 * fallback for laziness — a settlement agreement reviewed against the SaaS
 * checklist produces confident nonsense, and no checklist at all is better.
 */
export type ContractType =
  | "nda"
  | "saas"
  | "msa"
  | "dpa"
  | "employment"
  | "consulting"
  | "reseller"
  | "merchant"
  | "ma"
  | "broker"
  | "license"
  | "lease"
  | "services"
  | "other";

export const CONTRACT_TYPES: { id: ContractType; label: string; checklist: string }[] = [
  { id: "nda", label: "NDA / Confidentiality", checklist: "nda" },
  { id: "saas", label: "SaaS subscription", checklist: "saas" },
  { id: "msa", label: "Master services agreement", checklist: "saas" },
  { id: "dpa", label: "Data processing agreement", checklist: "dpa" },
  { id: "employment", label: "Employment agreement", checklist: "employment" },
  { id: "consulting", label: "Consulting / contractor", checklist: "employment" },
  { id: "reseller", label: "Reseller / partner", checklist: "saas" },
  { id: "merchant", label: "Payment / merchant", checklist: "merchant" },
  { id: "ma", label: "M&A / purchase agreement", checklist: "ma" },
  { id: "broker", label: "Finder / broker", checklist: "broker" },
  { id: "license", label: "IP licence", checklist: "saas" },
  { id: "lease", label: "Lease", checklist: "other" },
  { id: "services", label: "Services / SOW", checklist: "saas" },
  { id: "other", label: "Other", checklist: "other" },
];

/**
 * Which side of the table we are on.
 *
 * This is the single most consequential input to a review: a three-month
 * liability cap is a red flag to a customer and a win to a vendor, and the same
 * model reading the same page must say opposite things depending on this value.
 * `unknown` exists so the app can *ask* rather than guess — a review run from
 * the wrong position is not slightly wrong, it is inverted.
 */
export type Position =
  | "customer"
  | "vendor"
  | "buyer"
  | "seller"
  | "licensor"
  | "licensee"
  | "receiving-party"
  | "disclosing-party"
  | "employer"
  | "employee"
  | "unknown";

export const POSITIONS: { id: Position; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "vendor", label: "Vendor / supplier" },
  { id: "buyer", label: "Buyer" },
  { id: "seller", label: "Seller" },
  { id: "licensor", label: "Licensor" },
  { id: "licensee", label: "Licensee" },
  { id: "receiving-party", label: "Receiving party" },
  { id: "disclosing-party", label: "Disclosing party" },
  { id: "employer", label: "Employer" },
  { id: "employee", label: "Employee / contractor" },
  { id: "unknown", label: "Not stated" },
];

/**
 * Three levels, matching the 🔴/🟡/🟢 a reviewer already reads.
 *
 * `acceptable` is a first-class outcome and is always populated. A review that
 * lists only problems reads as a demand for twelve changes; the same review
 * with the clean provisions named tells a negotiator what not to spend leverage
 * on, which is the more useful half.
 */
export type Severity = "critical" | "important" | "acceptable";

export type Negotiability = "high" | "medium" | "low" | "none";

/** How a position compares to the market benchmark for that provision. */
export type Verdict = "standard" | "off-market" | "aggressive" | "unknown";

export type DocumentStatus = "draft" | "executed" | "unknown";

/* ────────────────────────────────────────────────────────────────────────────
 * Human sign-off
 * ────────────────────────────────────────────────────────────────────────── */

export type SignOffStatus = "pending" | "approved" | "rejected" | "changes-requested";

/**
 * The human decision on one position, or on a whole review.
 *
 * `by` and `note` are required the moment `status` leaves `pending`, enforced
 * at the route rather than the type because TypeScript cannot express "these
 * two fields become mandatory when that one changes". A sign-off with no name
 * against it is indistinguishable, six months later, from one nobody made.
 */
export type SignOff = {
  status: SignOffStatus;
  by?: string;
  at?: string;
  note?: string;
};

export const PENDING: SignOff = { status: "pending" };

/* ────────────────────────────────────────────────────────────────────────────
 * The contract
 * ────────────────────────────────────────────────────────────────────────── */

export type ContractStatus = "uploaded" | "reviewing" | "reviewed" | "failed";

/** Where a file physically is, and whether Drive actually has it. */
export type DriveRef = {
  fileId: string;
  /** ISO timestamp of the write that put it there. */
  syncedAt: string;
};

export type Contract = {
  id: string;
  filename: string;
  /** Content hash. Two uploads of the same bytes are the same contract. */
  sha256: string;
  bytes: number;
  mimeType: string;
  pages?: number;

  uploadedAt: string;
  uploadedBy: string;
  /** `web` for the console, `fixture` for the seed corpus, `drive` for a folder sweep. */
  origin: "web" | "fixture" | "drive";

  /** What the reviewer told us, or what intake inferred. */
  title?: string;
  counterparty?: string;
  contractType?: ContractType;
  position: Position;

  status: ContractStatus;
  /** Set when `status` is `failed`, so the list can say why without a second read. */
  error?: string;

  latestReviewId?: string;
  reviewCount: number;

  /**
   * The PDF in the workspace folder's `input/`.
   *
   * Optional in the type and always present in practice: `ingest` uploads
   * before it writes the register row and fails the whole operation if the
   * upload fails, so a row without one means a register written by an older
   * version. Readers check it and say so rather than assuming.
   */
  input?: DriveRef;
};

/* ────────────────────────────────────────────────────────────────────────────
 * The review
 * ────────────────────────────────────────────────────────────────────────── */

/** One negotiated term, with where it is and how it compares. */
export type KeyTerm = {
  label: string;
  value: string;
  /** Section or clause reference, as printed in the document. */
  location: string;
  /** The market norm for this provision, when there is one. */
  benchmark?: string;
  verdict: Verdict;
};

/**
 * One entry in the fast danger scan.
 *
 * Every flag in the standard set is emitted whether or not it was found, so a
 * reviewer can tell "checked, absent" from "not checked". An omitted row reads
 * as the former and means the latter.
 */
export type RedFlag = {
  flag: string;
  found: boolean;
  location?: string;
  quote?: string;
};

/**
 * A redline: what to ask for, what to settle for, and when to stop.
 *
 * Three tiers rather than one string, because a single "suggested change"
 * leaves the negotiator to invent the fallback under time pressure — which is
 * exactly when a position gets conceded that did not need to be. `walkAway`
 * is allowed to be absent; most provisions do not have one, and inventing a
 * red line for a payment-terms clause devalues the ones that are real.
 */
export type Redline = {
  /** The opening ask, as replacement language. */
  preferred: string;
  /** The compromise that is still acceptable. */
  fallback?: string;
  /** The point past which this should not be signed without an exception. */
  walkAway?: string;
};

/**
 * One risk, with the evidence attached.
 *
 * `quote` is verbatim from the document. `location` is the clause reference as
 * printed. Both are required: a finding a lawyer cannot navigate to in ten
 * seconds costs more time than it saves.
 */
export type Finding = {
  id: string;
  severity: Severity;
  /** CUAD-style category — see `references/risk-taxonomy.md` in the plugin. */
  category: string;
  title: string;
  location: string;
  quote: string;

  issue: string;
  risk: string;
  marketStandard?: string;
  negotiability: Negotiability;
  redline?: Redline;

  /** Set when this finding maps onto a house standard. */
  standardId?: string;
  /** True when the clause departs from that standard. */
  deviatesFromStandard?: boolean;

  /** The lawyer's decision on this position. Never set by the model. */
  signOff: SignOff;
};

export type MissingProvision = {
  provision: string;
  priority: Severity;
  why: string;
  suggestedLanguage?: string;
};

/** A document that argues with itself: broken cross-references, orphan defines. */
export type ConsistencyIssue = {
  kind: "broken-reference" | "undefined-term" | "conflicting-clause" | "numbering" | "other";
  detail: string;
  location?: string;
};

/** Blank fields, absent exhibits — things to fix before anyone signs. */
export type PreSigningAlert = {
  kind: "blank-field" | "missing-exhibit" | "unsigned" | "truncated" | "other";
  detail: string;
  location?: string;
};

export type NegotiationItem = {
  rank: number;
  issue: string;
  ask: string;
  negotiability: Negotiability;
  findingId?: string;
};

/** Where a clause departs from the house playbook, named against the standard. */
export type StandardsDeviation = {
  standardId: string;
  topic: string;
  requirement: string;
  found: string;
  location?: string;
  severity: Severity;
  /** What to put in its place to bring the document back in line. */
  remedy?: string;
};

export type Review = {
  id: string;
  contractId: string;
  createdAt: string;
  createdBy: string;
  model: string;

  documentType: ContractType;
  documentTypeLabel: string;
  position: Position;
  counterparty?: string;
  parties: string[];
  governingLaw?: string;
  documentStatus: DocumentStatus;
  /** Headline: the worst severity actually present, never an average. */
  riskLevel: Severity;

  executiveSummary: string;
  preSigningAlerts: PreSigningAlert[];
  keyTerms: KeyTerm[];
  redFlags: RedFlag[];
  findings: Finding[];
  missingProvisions: MissingProvision[];
  consistencyIssues: ConsistencyIssue[];
  negotiationPriority: NegotiationItem[];
  standardsDeviations: StandardsDeviation[];

  /** Anything the model could not read or was unsure of. Never silently dropped. */
  limitations: string[];

  /** The rendered report — what goes to Drive's `output/` and what a person reads. */
  markdown: string;

  /** Where the outputs landed on Drive. Absent until the write succeeded. */
  outputJson?: DriveRef;
  outputMarkdown?: DriveRef;

  /** The lawyer's decision on the review as a whole. Never set by the model. */
  signOff: SignOff;

  /** Wall-clock and token cost, for the run log. */
  elapsedMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
};

/* ────────────────────────────────────────────────────────────────────────────
 * Review progress
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One step of a review, reported while it runs.
 *
 * A full review is three model calls and several minutes. Without this the
 * console shows a spinner for that whole time, and a spinner is
 * indistinguishable from a hang — people re-click, re-upload, or give up on a
 * request that was working. Worse, when it does fail there is nothing to say
 * *where*, so "the review failed" is the whole diagnosis.
 *
 * So each stage announces itself before it starts and reports what it found
 * when it ends. `detail` is the part that makes this traceability rather than
 * decoration: "Identifying the document" tells somebody the app is alive, but
 * "Mutual NDA, Acme Corp, Delaware law" tells them it is reading the right
 * document — and lets them stop a review that has already gone wrong instead of
 * waiting four minutes to find out.
 */
export type ReviewStep =
  | "queued"
  | "fetching"
  | "intake"
  | "risk"
  | "standards"
  | "report"
  | "filing"
  | "done"
  | "failed";

export type ReviewProgress = {
  step: ReviewStep;
  /** What is happening, in the present tense. */
  label: string;
  /** What that stage established. Set when the stage completes. */
  detail?: string;
  /** Set on `done`. */
  reviewId?: string;
  /** Set on `failed`. */
  error?: string;
  /** Milliseconds since the review started, so the UI can show it is moving. */
  elapsedMs: number;
};

/* ────────────────────────────────────────────────────────────────────────────
 * The house playbook
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One position the firm has already decided it takes.
 *
 * This is what "keeps documentation aligned with internal standards" is made
 * of. It is deliberately editable in the app rather than compiled in: a
 * standard that needs a deploy to change is a standard that goes stale, and a
 * stale standard silently approves the thing it was written to catch.
 */
export type Standard = {
  id: string;
  topic: string;
  /** Which contract types it applies to. Empty means all of them. */
  appliesTo: ContractType[];
  /** The rule, in one sentence a lawyer would recognise. */
  requirement: string;
  preferred: string;
  fallback?: string;
  walkAway?: string;
  /** Who owns the position, so a deviation has somebody to go to. */
  owner?: string;
  updatedAt: string;
  updatedBy: string;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Drafting
 * ────────────────────────────────────────────────────────────────────────── */

export type Draft = {
  id: string;
  createdAt: string;
  createdBy: string;
  kind: ContractType;
  title: string;
  /** What was asked for, kept so a redraft can be compared to the brief. */
  brief: string;
  markdown: string;
  /** Standards the draft was written against. */
  standardIds: string[];
  /** Points the drafter deliberately left for a lawyer. Always populated. */
  openPoints: string[];
  signOff: SignOff;
  output?: DriveRef;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Q&A and the trail
 * ────────────────────────────────────────────────────────────────────────── */

export type Answer = {
  id: string;
  at: string;
  by: string;
  question: string;
  answer: string;
  /** Contract ids, standard ids and clause references the answer leaned on. */
  citations: string[];
  /** True when the answer needed something the workspace does not hold. */
  incomplete: boolean;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  /** What it happened to: a contract id, a review id, a standard id. */
  subject?: string;
  detail: string;
  /** The note a person typed, on anything irreversible or anything signed off. */
  note?: string;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Status
 * ────────────────────────────────────────────────────────────────────────── */

export type WorkspaceStatus = {
  contracts: number;
  reviewed: number;
  awaitingReview: number;
  failed: number;
  openFindings: number;
  criticalFindings: number;
  awaitingSignOff: number;
  standards: number;
  drive: { state: "ready" | "needs-consent" | "unconfigured"; detail: string; folderId: string };
  model: { configured: boolean; name: string };
  latest?: {
    contractId: string;
    reviewId?: string;
    filename: string;
    title?: string;
    riskLevel?: Severity;
    at: string;
  };
};
