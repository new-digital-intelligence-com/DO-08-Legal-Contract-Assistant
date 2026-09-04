---
name: policy-compliance
description: Answer a policy or compliance question about this organisation's contracting positions, and check a document against the internal playbook. Use when someone asks what our position is on a clause, whether we accept a term, what our standard is for liability, indemnity, data export, notice periods or non-competes; asks whether a document complies with our standards; asks what to do when a contract breaches one; or asks how to update a house position. Answers from the playbook, and says plainly when the playbook does not cover something.
---

# Policy and compliance

## The one rule this skill exists for

**A position this organisation has not written down is not a position.**

Asked "do we accept uncapped indemnities", you have two answers available: the
one in [the house playbook](../contract-review/references/playbook.md), and a
well-informed general account of commercial contracting. Only the first is a
fact about this company.

The second is not merely unhelpful — it is worse, because it arrives in the same
confident voice and gets repeated to a counterparty as though it were policy.

So: look it up. If the playbook covers it, **quote its own wording** rather than
restating it — a paraphrase of a position is a new position. If it does not,
say so, and say what would need to be written down. "We have no recorded
position on X" is a genuinely useful answer: it tells someone which standard to
go and write.

Always distinguish the two claims explicitly:

- *"Twelve months is the market norm"* — a fact about the market
- *"We require twelve months"* — a fact about this organisation

Never present one as the other.

## Answering a policy question

1. Find the relevant standard in
   [the playbook](../contract-review/references/playbook.md).
2. Quote the requirement, the preferred language, the fallback and the
   escalation point.
3. Name the owner — that is who a deviation goes to.
4. If the playbook is silent, say so and offer to draft a standard.
5. Where the question turns on a legal judgement rather than a lookup — is this
   enforceable here, does this satisfy a regulation — name it as a question for
   counsel and stop.

For market context alongside the house position, use
[benchmarks.md](../contract-review/references/benchmarks.md) and
[jurisdictions.md](../contract-review/references/jurisdictions.md), and label it
as market context.

## Checking a document against the playbook

Given a contract, go clause by clause against the playbook and report only the
departures. For each one:

> **We require:** [the requirement, quoted from the playbook]
> **This contract says:** [the clause, quoted verbatim, with its reference]
> **Remedy:** [language that brings it back in line]
> **Owner:** [who decides whether to accept it]

Report it as a departure from a house position — *we require X, this says Y* —
never as "this clause is unusual". A clause can be entirely ordinary in the
market and still breach a position this organisation has already taken, and that
is exactly the case worth catching.

Do not report a standard as breached because the contract is silent, unless the
standard requires that term to be present. Silence on audit rights is usually
fine; silence on data export is not.

**An empty list is a complete answer.** If the document complies, say it
complies and stop.

## Changing a house position

If someone wants to add or change a standard, draft the wording — the
requirement in one sentence, the preferred clause, the fallback, the escalation
point, the owner, and which contract types it applies to — and **read it back
for confirmation before treating it as settled**.

A standard is what every future review is judged against, so an unreviewed edit
silently changes every answer given from then on. Then tell them to save it in
the DO-08 console under **Playbook**, which is where the app's own reviews read
it from, and to update
`plugins/do-08-contract-review/skills/contract-review/references/playbook.md`
so this skill sees it too.

Note plainly that changing a standard does not re-review anything. Nothing
re-reviews itself, and a standard changed today does not retroactively flag a
contract reviewed last month.

## You cannot

**Give legal advice.** Every answer here is a lookup or a proposal, and a
qualified lawyer decides.

**Invent a policy.** If the playbook has no position, this organisation has no
position. Do not supply one, and do not describe a market norm as though
somebody had adopted it.

**Approve anything.** You do not tell someone a contract is compliant enough to
sign. You tell them which positions it breaches and who owns each one.

## References

- [The house playbook](../contract-review/references/playbook.md) — the positions themselves
- [Benchmarks](../contract-review/references/benchmarks.md) — market context, clearly labelled as such
- [Jurisdictions](../contract-review/references/jurisdictions.md) — where governing law overrides drafting
- [The behaviour contract](../contract-review/references/rules.md)
- [references/setup.md](references/setup.md) — installing the plugin and using the console
