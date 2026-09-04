import "server-only";
import { BUDGET, readText } from "./anthropic";
import { record } from "./audit";
import { fileDraft } from "./outputs";
import { DraftSchema } from "./schemas";
import { playbookText } from "./standards";
import { DISCLAIMER, orgName, reviewer } from "./settings";
import { mutate, newId, readStore } from "./store";
import { CONTRACT_TYPES, PENDING, POSITIONS } from "./types";
import type { ContractType, Draft, Position } from "./types";

/**
 * Drafting, written to the house playbook rather than to a generic template.
 *
 * The playbook goes into the prompt for the same reason it goes into the review:
 * a draft produced from a model's general sense of what an NDA says is a draft
 * that quietly disagrees with every position this organisation has already
 * decided it takes. Drafting against the standards means the first version
 * already contains the clauses the review would otherwise flag.
 *
 * The one thing this module refuses to do is fill in a commercial decision.
 * A drafter that silently picks a price, a term length or a governing law has
 * done the most dangerous thing available to it: put something plausible in a
 * document somebody is about to sign. A gap gets noticed and filled. An
 * invention gets signed. `openPoints` is where every such decision goes, and a
 * draft that comes back without any gets one added saying so.
 */

const COLLECTION = "drafts";

function draftSystem(org: string, playbook: string): string {
  return `
You draft commercial agreements for ${org}'s legal team. You produce a working first draft that a
lawyer then reviews, edits and takes responsibility for. You are not producing an executable
document and nothing you write is legal advice.

## How to draft

- Numbered clauses, defined terms capitalised and defined once on first use, and a definitions
  section where the document is long enough to need one.
- Plain, modern drafting. No "WHEREAS" recitals unless the document type genuinely calls for them,
  no "hereinafter", no doubled synonyms ("null and void", "each and every").
- Write mutual obligations as mutual. Where a clause can only run one way, say which way and why
  it does in a bracketed drafting note.
- Include the clauses this organisation's playbook requires, using its preferred language where it
  gives some. The playbook below is the house position — draft to it.

## What you must never do

Never invent a commercial term. Price, term length, notice periods, governing law, notice
addresses, party names, liability figures — if the brief does not state it, it goes in openPoints
and appears in the draft as a clearly marked placeholder like [FEE: to be confirmed]. Do not write
a plausible number. A gap gets noticed and filled by a person; an invented figure gets signed.

Never claim a clause is standard, enforceable or approved. Where a provision carries real legal
risk that depends on facts you do not have — a non-compete's enforceability, a limitation clause
under consumer law — add a short bracketed drafting note flagging it for the reviewing lawyer.

${playbook ? `## The house playbook\n\n${playbook}` : "## The house playbook\n\n(Empty — draft to general commercial norms and say so in openPoints.)"}
`.trim();
}

export async function draftContract(input: {
  kind: ContractType;
  title: string;
  brief: string;
  counterparty?: string;
  position?: Position;
  actor?: string;
}): Promise<Draft> {
  const actor = input.actor?.trim() || reviewer();
  const brief = input.brief?.trim();
  if (!brief) {
    throw new Error(
      "A draft needs a brief saying what the agreement is for. Without one the drafter has " +
        "nothing to work from and will invent the commercial terms, which is the one thing it " +
        "must not do.",
    );
  }

  const playbook = await playbookText(input.kind);
  const typeLabel = CONTRACT_TYPES.find((entry) => entry.id === input.kind)?.label ?? input.kind;
  const positionLabel = input.position
    ? (POSITIONS.find((entry) => entry.id === input.position)?.label ?? input.position)
    : undefined;

  const result = await readText({
    system: draftSystem(orgName(), playbook),
    prompt: [
      `Draft a ${typeLabel} titled "${input.title}".`,
      input.counterparty ? `The counterparty is ${input.counterparty}.` : null,
      positionLabel ? `We are the ${positionLabel}.` : null,
      "",
      "## The brief",
      "",
      brief,
      "",
      "Return the agreement as Markdown with numbered clauses, and list every commercial decision " +
        "you left open rather than deciding.",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: DraftSchema,
    maxTokens: BUDGET.draftTokens,
  });

  // A draft with no open points is almost always a draft that invented
  // something rather than one that needed nothing. Saying so is more useful
  // than an empty list, which reads as "everything was specified".
  const openPoints =
    result.value.openPoints.length > 0
      ? result.value.openPoints
      : [
          "The drafter reported no open commercial decisions. Check the draft against the brief " +
            "before trusting that — every figure, date and party name in it should trace back to " +
            "something you asked for.",
        ];

  const draft: Draft = {
    id: newId("drf"),
    createdAt: new Date().toISOString(),
    createdBy: actor,
    kind: input.kind,
    title: input.title,
    brief,
    markdown: `${result.value.markdown}\n\n---\n\n*${DISCLAIMER}*\n`,
    standardIds: result.value.standardsUsed,
    openPoints,
    signOff: { ...PENDING },
  };

  draft.output = await fileDraft(draft);

  await mutate<Draft[], void>(COLLECTION, [], (all) => ({
    next: [draft, ...all],
    result: undefined,
  }));

  await record({
    actor,
    action: "draft.create",
    subject: draft.id,
    detail:
      `Drafted "${draft.title}" (${typeLabel}) against ${draft.standardIds.length} house ` +
      `standard${draft.standardIds.length === 1 ? "" : "s"}, with ${openPoints.length} ` +
      `open point${openPoints.length === 1 ? "" : "s"} left for a person. Pending legal sign-off.`,
  });

  return draft;
}

export async function listDrafts(limit?: number): Promise<Draft[]> {
  const all = await readStore<Draft[]>(COLLECTION, []);
  return limit ? all.slice(0, limit) : all;
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  return (await readStore<Draft[]>(COLLECTION, [])).find((draft) => draft.id === id);
}
