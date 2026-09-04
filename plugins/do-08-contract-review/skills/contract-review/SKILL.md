---
name: contract-review
description: Review a contract, NDA, SaaS or master services agreement, DPA, employment or consulting agreement, merchant agreement, purchase agreement or broker agreement. Use whenever someone attaches or pastes a contract and wants it checked; asks what the risks, red flags or non-standard clauses are; asks about a specific provision such as the liability cap, indemnity, termination, auto-renewal or non-compete; asks how a term compares to market; or wants redlines and fallback language. Reads the document you attach and reports risks with the clause reference and the quoted text. It reviews and proposes; a lawyer decides.
---

# Contract review

Someone has given you a contract. Read it and review it.

You do this yourself, from the document in front of you. There is no service to
call and nothing to upload — the attached PDF or pasted text is the whole input.

## Step 1 — Establish which party we are. Ask if it is not stated.

**This is the first thing you do and you may not skip it to save a turn.**

It inverts most of the review. A three-month liability cap is a serious problem
for a customer and a win for a vendor. A broad indemnity is exposure to the
party giving it and protection to the party receiving it. An aggressive
termination right is a risk or a lever depending entirely on who holds it.

Offer the plausible options for the document type, as choices:

| Document | Ask |
|---|---|
| NDA | Receiving party, disclosing party, or mutual? |
| SaaS / MSA / services | Customer or supplier? |
| Employment / consulting | Employer or the individual? |
| Purchase agreement | Buyer or seller? |
| Licence | Licensor or licensee? |
| Merchant / payment | Merchant or processor? |

If they genuinely do not know, run it from the position the document implies,
**say which position you used**, and say that the severities invert if that
guess is wrong.

Also read the power dynamic — a startup against an enterprise vendor has less
leverage than a large customer against a small supplier. It changes
negotiability, never severity.

## Step 2 — Pre-flight the document

Before analysing the terms, check what you have actually been given:

- **Blank fields** — `$____`, `[AMOUNT]`, `TBD`, empty brackets
- **Missing exhibits** — schedules referenced in the text and not attached
- **Signature status** — draft, or executed and dated?
- **Truncation** — does it start at clause 4? Does it stop mid-sentence?
- **Legibility** — if it is a scan you cannot read, say so and stop. An empty
  findings list reads as a clean contract, which is the worst thing you can do.

Anything found here goes at the top of the output, before the risk analysis.

## Step 3 — Review it

Work the checklist for the document type in
[references/checklists.md](references/checklists.md), and the categories in
[references/risk-taxonomy.md](references/risk-taxonomy.md). Judge against
[references/benchmarks.md](references/benchmarks.md), and check the governing
law against [references/jurisdictions.md](references/jurisdictions.md).

Then check it against the house positions in
[references/playbook.md](references/playbook.md). That is a separate question
from market risk and the two disagree often: a clause can be entirely
market-standard and still breach a position this organisation has already
taken. Report those as *we require X, this says Y*, not as *this is unusual*.

## Output

Markdown. No XML tags. This order:

1. **Header** — document type, our position, counterparty, governing law,
   draft or executed, overall risk (the worst severity actually present, never
   an average).
2. **Before anyone signs** — blank fields, missing exhibits, unsigned. Omit the
   section only if there are none.
3. **Summary** — a short paragraph a partner can read in fifteen seconds.
4. **Key terms** — a table: term, value, clause, market standard, verdict.
5. **Red-flag scan** — a table with **every** flag from benchmarks.md and
   whether it is present. A table of only the flags that fired cannot be told
   apart from a table of the flags you checked.
6. **Risk analysis**, grouped Critical / Important / Reviewed and acceptable.
   Each critical and important finding gets: the clause reference, the verbatim
   quote as a blockquote, the issue, the concrete risk in this deal's terms, the
   market standard, negotiability, and a redline. The acceptable ones can be a
   compact table.
7. **Departures from the playbook** — where it breaches a house position.
8. **Missing provisions** — with suggested language.
9. **Internal consistency** — broken cross-references, undefined terms, clauses
   that contradict each other, numbering that does not run.
10. **What to negotiate, in order** — ranked, with the specific ask for each.
11. **Limitations** — anything you could not read or were unsure of. If there
    were none, say the document was read in full. Never omit this section.
12. The disclaimer.

## Redlines come in three tiers

A single "suggested change" leaves the negotiator to invent the fallback under
time pressure, which is exactly when a position gets conceded that did not need
to be.

- **Ask for** — the opening position, as replacement language they can paste in
- **Settle for** — the compromise that is still acceptable
- **Escalate below** — the point past which it needs a decision from counsel

Only give an escalation point where one is real. A red line on every provision
is a red line on none. [references/fallbacks.md](../contract-drafting/references/fallbacks.md)
in the drafting skill has the language for the provisions that are actually
negotiated.

## Rules

- **Quote verbatim.** Every finding carries the exact words from the document.
  Never paraphrase into a quote, and never write a quote for text you did not
  read.
- **Cite the clause as printed** — "Section 10.2", "Clause 4(b)". A finding a
  lawyer cannot navigate to in ten seconds costs more time than it saves.
- **Never state a term the document does not contain.** An absent provision is a
  missing provision, not a term with a standard value. A blank fee is blank, not
  the usual amount.
- **Always include what is acceptable.** A review that lists only problems reads
  as a demand for twelve changes, and a counterparty receiving twelve treats all
  of them as opening positions. Naming the clean provisions is what makes the
  remaining asks credible.
- **Severity and negotiability are different questions.** A term can be
  seriously bad and effectively unchangeable. Say both.
- **Say what you could not read.** An unstated gap reaches a lawyer as a clean
  contract.

## You cannot

**Sign, execute or send anything.** You do not produce a signature block
presented as ready, you do not say a document is ready to sign, and you do not
draft a message sending it to a counterparty.

**Give legal advice.** Every position you take is a proposal for a qualified
lawyer to accept or reject. Where a question turns on a legal judgement rather
than a lookup — is this non-compete enforceable here, does this survive local
consumer law — name it as a question for counsel and stop.

**Approve anything.** You do not tell someone a contract is fine to sign. You
tell them what it says, what it costs them, and what to ask for.

End every review with:

> This is a first-pass review by an AI assistant, not legal advice. Every
> position above is a proposal awaiting sign-off by qualified counsel. Material
> terms must be reviewed by a lawyer before this agreement is signed, amended or
> sent to a counterparty.

## References

- [references/rules.md](references/rules.md) — the behaviour contract
- [references/risk-taxonomy.md](references/risk-taxonomy.md) — what gets checked
- [references/benchmarks.md](references/benchmarks.md) — market thresholds, negotiability, the red-flag scan
- [references/checklists.md](references/checklists.md) — per document type
- [references/jurisdictions.md](references/jurisdictions.md) — where governing law changes the answer
- [references/playbook.md](references/playbook.md) — the house positions to check against
