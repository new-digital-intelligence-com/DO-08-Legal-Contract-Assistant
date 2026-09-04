import "server-only";
import { record } from "./audit";
import { mutate, newId, readStore } from "./store";
import { reviewer } from "./settings";
import type { ContractType, Standard } from "./types";

/**
 * The house playbook: positions this organisation has already decided it takes.
 *
 * This is what "keeps documentation aligned with internal standards" is made
 * of, and it is the difference between a contract reviewer and a legal search
 * engine. A market benchmark says a twelve-month liability cap is normal. A
 * standard says *we require* twelve months, will take six, and escalate below
 * that — and those are different claims that lead to different negotiations.
 *
 * Standards live in the register and are edited in the app, not compiled in.
 * A standard that needs a deploy to change goes stale, and a stale standard
 * silently approves the very thing it was written to catch. The seeds below are
 * a starting position, not a fixture: the moment anybody edits one, it is
 * theirs.
 */

const COLLECTION = "standards";

/* ────────────────────────────────────────────────────────────────────────────
 * The starting playbook
 * ────────────────────────────────────────────────────────────────────────── */

type Seed = Omit<Standard, "id" | "updatedAt" | "updatedBy">;

/**
 * Sixteen positions a commercial legal team actually holds.
 *
 * Each carries real replacement language rather than an instruction to
 * negotiate. "Ask for a higher cap" is not a fallback; a sentence somebody can
 * paste into a redline is. The `walkAway` field is left empty on most of them
 * deliberately — a red line on every provision is a red line on none.
 *
 * `appliesTo: []` means all contract types.
 */
const SEEDS: Seed[] = [
  {
    topic: "Limitation of liability — general cap",
    appliesTo: ["saas", "msa", "services", "consulting", "reseller", "license"],
    requirement:
      "General liability is capped at no less than 12 months of fees paid or payable under the agreement.",
    preferred:
      "Each party's total aggregate liability arising out of or related to this Agreement shall not exceed the total fees paid or payable by Customer in the twelve (12) months preceding the event giving rise to the claim.",
    fallback:
      "Accept a cap of not less than six (6) months' fees where the annual contract value is under USD 50,000.",
    walkAway:
      "Below three (3) months' fees, or a cap expressed as a fixed sum unrelated to fees, needs an exception from the General Counsel.",
    owner: "General Counsel",
  },
  {
    topic: "Uncapped liability carve-outs",
    appliesTo: [],
    requirement:
      "Carve-outs from the liability cap are mutual and limited to confidentiality breach, indemnity obligations, wilful misconduct and death or personal injury.",
    preferred:
      "The limitations in this Section shall not apply to: (a) either party's indemnification obligations; (b) breach of confidentiality obligations; (c) a party's wilful misconduct or fraud; or (d) death or personal injury caused by negligence.",
    fallback:
      "A one-sided carve-out is acceptable only where it mirrors an obligation only one party carries.",
    walkAway:
      "An uncapped carve-out for breach of the agreement generally, or for payment of fees plus anything else, makes the cap meaningless and is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Indemnification — mutuality",
    appliesTo: ["saas", "msa", "services", "reseller", "license"],
    requirement: "Indemnities are mutual in structure and capped in line with the liability cap.",
    preferred:
      "Each party shall indemnify the other against third-party claims arising from its own breach of this Agreement, subject to the limitations set out in Section [cap].",
    fallback:
      "A supplier-only IP indemnity is acceptable where we receive no equivalent risk from the other direction.",
    owner: "General Counsel",
  },
  {
    topic: "Termination for convenience",
    appliesTo: ["saas", "msa", "services", "consulting", "reseller"],
    requirement:
      "Termination for convenience is mutual, on no less than 30 days' and no more than 90 days' written notice.",
    preferred:
      "Either party may terminate this Agreement for convenience upon sixty (60) days' prior written notice to the other party.",
    fallback:
      "A vendor-only right to terminate for convenience is acceptable only if paired with a pro-rata refund of prepaid fees.",
    walkAway: "A vendor right to terminate on 30 days' notice with no refund is not accepted.",
    owner: "Commercial Counsel",
  },
  {
    topic: "Cure period for material breach",
    appliesTo: [],
    requirement: "Termination for cause requires written notice and a cure period of 30 days.",
    preferred:
      "Either party may terminate for material breach if the breach remains uncured thirty (30) (or ten (10) for non-payment) days after written notice describing it.",
    fallback: "Fifteen (15) days is acceptable where the breach is non-payment.",
    owner: "Commercial Counsel",
  },
  {
    topic: "Auto-renewal and notice",
    appliesTo: ["saas", "msa", "services", "reseller", "license"],
    requirement:
      "Auto-renewal requires no more than 30 days' notice to prevent, and renewal terms no longer than 12 months.",
    preferred:
      "This Agreement renews for successive twelve (12) month terms unless either party gives written notice of non-renewal at least thirty (30) days before the end of the then-current term.",
    fallback: "Sixty (60) days' notice is acceptable for multi-year terms.",
    walkAway:
      "A notice window opening more than 90 days before expiry, or a renewal term longer than the initial term, is not accepted.",
    owner: "Commercial Counsel",
  },
  {
    topic: "Price increases on renewal",
    appliesTo: ["saas", "msa", "services", "reseller", "license"],
    requirement: "Renewal price increases are capped at the lower of CPI or 5% per year.",
    preferred:
      "Fees for any renewal term shall not increase by more than the lesser of (a) five percent (5%) or (b) the increase in the Consumer Price Index over the preceding twelve months.",
    fallback: "A 7% cap is acceptable on a single-year renewal.",
    walkAway: "Uncapped renewal pricing is not accepted on any term longer than one year.",
    owner: "Procurement",
  },
  {
    topic: "Data export on termination",
    appliesTo: ["saas", "msa", "dpa", "reseller"],
    requirement:
      "Customer data is exportable in a machine-readable format for at least 90 days after termination, at no additional charge.",
    preferred:
      "Upon termination or expiry, Vendor shall make Customer Data available for export in a structured, commonly used, machine-readable format (CSV or JSON) for ninety (90) days at no additional charge, and shall delete it thereafter on written request.",
    fallback: "Thirty (30) days is acceptable where an export API is available throughout the term.",
    walkAway:
      "No export right, or export offered only as a chargeable professional-services engagement, is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Security and breach notification",
    appliesTo: ["saas", "msa", "dpa", "reseller"],
    requirement:
      "The supplier notifies us of a security incident affecting our data without undue delay and in any case within 72 hours.",
    preferred:
      "Vendor shall notify Customer without undue delay and in any event within seventy-two (72) hours of becoming aware of any Security Incident affecting Customer Data, and shall provide sufficient information to allow Customer to meet its own notification obligations.",
    fallback: "Notification 'without undue delay' with a stated internal escalation SLA.",
    walkAway: "A notification obligation triggered only by a confirmed regulatory duty is not accepted.",
    owner: "Head of Security",
  },
  {
    topic: "Subprocessor changes",
    appliesTo: ["saas", "dpa", "msa"],
    requirement: "We receive at least 30 days' notice of a new subprocessor and may object.",
    preferred:
      "Vendor shall give Customer at least thirty (30) days' notice before engaging any new Subprocessor with access to Customer Data. Customer may object on reasonable data-protection grounds, and if the objection cannot be resolved, Customer may terminate the affected Services without penalty.",
    fallback: "Notice with a right to terminate, where an objection right is refused.",
    owner: "Data Protection Officer",
  },
  {
    topic: "Ownership of deliverables and feedback",
    appliesTo: ["services", "consulting", "msa", "license"],
    requirement:
      "We own deliverables created specifically for us. Feedback we give does not transfer our IP.",
    preferred:
      "All Deliverables created specifically for Customer under a Statement of Work shall be the property of Customer upon payment. Vendor retains its pre-existing materials and grants Customer a perpetual, non-exclusive licence to use them as embedded in the Deliverables.",
    fallback:
      "A perpetual, irrevocable, worldwide licence to the deliverables is acceptable where the supplier's business model depends on retaining ownership.",
    walkAway:
      "A clause assigning ownership of Customer feedback, ideas or data to the vendor is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Confidentiality duration",
    appliesTo: ["nda", "saas", "msa", "services", "consulting"],
    requirement:
      "Confidentiality obligations run 3 to 5 years from disclosure, and indefinitely for trade secrets.",
    preferred:
      "Each party shall protect the other's Confidential Information for three (3) years from the date of disclosure, and for so long as it remains a trade secret in the case of trade secrets.",
    fallback: "Five (5) years is acceptable for technical or product information.",
    walkAway:
      "A perpetual obligation over all information, with no trade-secret carve-out, is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Residuals clause",
    appliesTo: ["nda"],
    requirement: "A residuals clause is accepted only when mutual and limited to unaided memory.",
    preferred:
      "Neither party shall be restricted from using general knowledge, skills and experience retained in the unaided memory of its personnel, provided that this does not licence any patent or copyright, and does not permit use of the other party's Confidential Information in tangible form.",
    fallback: "Delete the residuals clause entirely where the counterparty will accept that.",
    walkAway:
      "A one-way residuals clause in favour of the party receiving more information is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Non-solicitation",
    appliesTo: ["nda", "msa", "services", "consulting", "reseller"],
    requirement:
      "Non-solicits are mutual, no longer than 12 months, and carve out general advertising.",
    preferred:
      "During the term and for twelve (12) months thereafter, neither party shall knowingly solicit for employment any employee of the other with whom it had material contact under this Agreement. General advertising and unsolicited applications are not a breach.",
    fallback: "Eighteen (18) months where the engagement involves embedded personnel.",
    walkAway:
      "A no-hire clause covering all employees regardless of contact, or longer than 24 months, is not accepted.",
    owner: "Commercial Counsel",
  },
  {
    topic: "Governing law and venue",
    appliesTo: [],
    requirement:
      "Governing law is a neutral, well-developed commercial jurisdiction. Offshore jurisdictions are escalated.",
    preferred:
      "This Agreement is governed by the laws of the State of Delaware, and the parties submit to the exclusive jurisdiction of the state and federal courts located there.",
    fallback:
      "New York or England and Wales are acceptable. The counterparty's home jurisdiction is acceptable where it is an OECD member and we are the smaller party.",
    walkAway:
      "BVI, Cayman, or any jurisdiction where enforcement would be disproportionately expensive, needs an exception from the General Counsel.",
    owner: "General Counsel",
  },
  {
    topic: "Assignment and change of control",
    appliesTo: [],
    requirement:
      "Assignment rights are symmetrical. A change of control at the counterparty gives us a right to terminate where they become a competitor.",
    preferred:
      "Neither party may assign this Agreement without the other's prior written consent, not to be unreasonably withheld, except to a successor in interest to all or substantially all of its business. Customer may terminate on notice if Vendor is acquired by a direct competitor of Customer.",
    fallback: "Symmetrical free assignment to affiliates and successors, with notice.",
    walkAway:
      "A clause permitting the counterparty to assign freely while requiring our consent is not accepted.",
    owner: "General Counsel",
  },
  {
    topic: "Service levels and credits",
    appliesTo: ["saas", "msa", "reseller"],
    requirement:
      "An availability commitment of at least 99.9% with service credits, and a termination right for chronic failure.",
    preferred:
      "Vendor shall maintain at least 99.9% monthly availability. Failure entitles Customer to service credits as set out in the SLA, and to terminate without penalty if availability falls below the committed level in any three (3) months of a rolling twelve-month period.",
    fallback:
      "99.5% is acceptable for non-production or internal-only services.",
    walkAway:
      "An availability figure stated with no credit and no remedy is a marketing claim, not a service level, and is not accepted.",
    owner: "Head of Engineering",
  },
  {
    topic: "Audit rights",
    appliesTo: ["saas", "msa", "services", "reseller", "merchant"],
    requirement:
      "Audits require reasonable notice, happen no more than annually, and are at the auditing party's cost unless material non-compliance is found.",
    preferred:
      "Either party may audit the other's compliance no more than once per year, on thirty (30) days' written notice, during business hours, at the auditing party's cost — save that where an audit reveals material non-compliance, the audited party shall bear the reasonable cost of that audit.",
    fallback: "Twice-yearly audits are acceptable in a regulated context.",
    walkAway: "Unannounced audit rights, or audits at our cost regardless of outcome, are not accepted.",
    owner: "Commercial Counsel",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Reading and writing
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Seeded on first read, then owned by whoever edits it.
 *
 * Seeding on read rather than at install time means a fresh checkout has a
 * usable playbook immediately — an empty playbook makes the standards pass a
 * no-op and the product looks like it does not have the feature. It only ever
 * fires when the collection is genuinely empty, so a team that deletes a
 * standard does not find it back the next morning.
 */
async function ensureSeeded(): Promise<Standard[]> {
  const existing = await readStore<Standard[]>(COLLECTION, []);
  if (existing.length > 0) return existing;

  const at = new Date().toISOString();
  const seeded: Standard[] = SEEDS.map((seed) => ({
    ...seed,
    id: newId("std"),
    updatedAt: at,
    updatedBy: "seed",
  }));

  return mutate<Standard[], Standard[]>(COLLECTION, [], (current) =>
    // Re-checked inside the queue: two requests racing the first read would
    // otherwise both seed, and the playbook would come up with every standard
    // in it twice.
    current.length > 0 ? { next: current, result: current } : { next: seeded, result: seeded },
  );
}

export const SEED_STANDARDS = SEEDS;

export async function listStandards(filter?: {
  contractType?: ContractType;
}): Promise<Standard[]> {
  const all = await ensureSeeded();
  if (!filter?.contractType) return all;
  const type = filter.contractType;
  // An empty `appliesTo` means every contract type — a standard about governing
  // law is not less relevant because somebody added a new document type.
  return all.filter(
    (standard) => standard.appliesTo.length === 0 || standard.appliesTo.includes(type),
  );
}

export async function getStandard(id: string): Promise<Standard | undefined> {
  return (await ensureSeeded()).find((standard) => standard.id === id);
}

export async function saveStandard(
  input: Partial<Standard> & { topic: string; requirement: string; preferred: string },
  actor: string,
): Promise<Standard> {
  await ensureSeeded();
  const who = actor?.trim() || reviewer();
  const at = new Date().toISOString();

  const saved = await mutate<Standard[], Standard>(COLLECTION, [], (all) => {
    const index = input.id ? all.findIndex((standard) => standard.id === input.id) : -1;

    if (index === -1) {
      const created: Standard = {
        id: input.id ?? newId("std"),
        topic: input.topic,
        appliesTo: input.appliesTo ?? [],
        requirement: input.requirement,
        preferred: input.preferred,
        fallback: input.fallback,
        walkAway: input.walkAway,
        owner: input.owner,
        updatedAt: at,
        updatedBy: who,
      };
      return { next: [created, ...all], result: created };
    }

    const next = [...all];
    next[index] = { ...next[index], ...input, id: next[index].id, updatedAt: at, updatedBy: who };
    return { next, result: next[index] };
  });

  await record({
    actor: who,
    action: input.id ? "standard.update" : "standard.create",
    subject: saved.id,
    detail: `${input.id ? "Updated" : "Added"} the house position on ${saved.topic}.`,
  });

  return saved;
}

/**
 * Removing a standard needs a note, like every other irreversible act here.
 *
 * A deleted standard is a position the company silently stopped holding, and
 * six months later the only way to tell that from "we never had one" is the
 * trail.
 */
export async function removeStandard(id: string, actor: string, note: string): Promise<void> {
  const standard = await getStandard(id);
  if (!standard) throw new Error(`No standard with id ${id}.`);

  await mutate<Standard[], void>(COLLECTION, [], (all) => ({
    next: all.filter((s) => s.id !== id),
    result: undefined,
  }));

  await record({
    actor: actor?.trim() || reviewer(),
    action: "standard.remove",
    subject: id,
    note,
    detail: `Removed the house position on ${standard.topic}.`,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * For prompts
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The applicable standards, rendered for a prompt.
 *
 * Returns an empty string when there are none, and the caller must treat that
 * as "skip the call" rather than "ask anyway". Asking a model to compare a
 * contract against an empty playbook does not return no deviations — it returns
 * invented ones, because the request implies there is something to find.
 */
export async function playbookText(contractType?: ContractType): Promise<string> {
  const standards = await listStandards(contractType ? { contractType } : undefined);
  if (standards.length === 0) return "";

  return standards
    .map((standard) =>
      [
        `### ${standard.topic}`,
        `- id: ${standard.id}`,
        `- Requirement: ${standard.requirement}`,
        `- Preferred language: ${standard.preferred}`,
        standard.fallback ? `- Acceptable fallback: ${standard.fallback}` : null,
        standard.walkAway ? `- Escalate / walk away: ${standard.walkAway}` : null,
        standard.owner ? `- Owner: ${standard.owner}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
