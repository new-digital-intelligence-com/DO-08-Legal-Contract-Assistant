# Market benchmarks and negotiability

Thresholds for judging whether a term is normal, marginal or a problem. They are US-market
commercial defaults for mid-market deals. They are a starting point for a conversation with a
lawyer, not a rule — deal size, leverage and industry move all of them.

**Two different questions, never collapsed.** *Severity* is how much exposure the term creates.
*Negotiability* is how likely it is to change. A term can be seriously bad and effectively fixed
(card-network rules in a merchant agreement), or fairly minor and trivially fixed (a cure period).
Reporting only one of the two produces advice nobody can act on.

## Thresholds

| Provision | Standard | Marginal | Red flag |
|---|---|---|---|
| Liability cap (general) | 12 months' fees | 6–11 months | Under 6 months, or a fixed sum unrelated to fees |
| Liability cap carve-outs | Mutual; confidentiality, indemnity, wilful misconduct | One-sided but mirrors a one-sided obligation | Uncapped for breach generally — this voids the cap |
| Indemnification | Mutual, capped | Asymmetric | Uncapped, or defence-and-settlement control with no consent right |
| Warranty | Fitness plus conformance to docs | Docs only, short period | "As-is" with all warranties disclaimed |
| Termination for convenience | Mutual, 60–90 days | One-sided with a pro-rata refund | Vendor-only on 30 days, no refund |
| Cure period (material breach) | 30 days | 15 days | None, or termination on notice alone |
| Auto-renewal notice window | 30 days to prevent | 60 days | 90+ days, or a renewal term longer than the initial term |
| Price increase on renewal | CPI or 5% a year | 7–10% | Uncapped |
| Suspension rights | On notice, for non-payment after cure | Immediate for a security event | Immediate, sole discretion, any reason |
| Unilateral amendment | None — changes by agreement | Notice plus a right to terminate | Vendor may change terms by posting them |
| Data export on termination | 90 days, standard format, free | 30 days | None, or chargeable professional services |
| Security incident notice | Without undue delay, max 72 hours | "Promptly", with an internal SLA | Only on confirmed regulatory duty |
| Subprocessor changes | 30 days' notice, right to object | Notice with a termination right | No notice |
| SLA | 99.9% with credits and a chronic-failure exit | 99.5% with credits | A percentage with no credit — a marketing claim, not a service level |
| Confidentiality term | 3 years; indefinite for trade secrets | 5 years | Perpetual over everything, no trade-secret carve-out |
| Non-compete duration | 1–2 years | 3–4 years | 5+ years — and see jurisdictions.md, many are void outright |
| Non-compete geography | Where the business actually operates | State-wide | Nationwide or worldwide |
| Non-solicit | Mutual, 12 months, contact-based, ads carved out | 18 months | No-hire covering all employees regardless of contact |
| Assignment | Symmetrical, consent not unreasonably withheld | Free to affiliates and successors both ways | They assign freely, you need consent |
| Audit rights | Annual, 30 days' notice, auditor pays unless material failure | Twice yearly in a regulated context | Unannounced, or always at your cost |
| Governing law | Delaware, New York, England and Wales | Counterparty's home OECD jurisdiction | BVI, Cayman, or anywhere enforcement is disproportionate |
| Rep survival (M&A) | 12–18 months general | 24–30 months | 36+ months |
| Escrow / holdback (M&A) | 10–15% for 12–18 months | 15–20% for 18–24 months | Over 20%, or over 24 months |
| Indemnity cap (M&A) | 10–20% of price | 20–30% | Uncapped, or up to the full purchase price |
| Broker fee tail | 12–18 months | 24 months | Perpetual |
| Reserve / holdback (merchant) | Defined %, defined release date | Rolling, formula-based, disclosed | "As determined by us", no release condition |

## Negotiability

| Rating | Meaning | Typically |
|---|---|---|
| **High** | Usually accepted if asked | Mutual termination, cure periods, data export, notice windows, non-solicit carve-outs, mutual confidentiality term |
| **Medium** | Depends on leverage | Liability cap size, price-increase caps, indemnity mutuality, SLA credits, audit frequency |
| **Low** | Rarely moves | Governing law on a large vendor's paper, subprocessor lists, standard product terms, insurance minimums |
| **None** | Cannot move | Card-network rules, banking and payment regulation, statutory data-protection terms, regulator-mandated language |

What shifts these: a large customer against a small vendor gains a level. A startup against an
enterprise vendor loses one. A competitive market with real alternatives gains one; a sole-source
or deeply embedded supplier loses one. Anything legally required is `None` no matter who is asking.

## The red-flag scan

Run every one of these on every contract and report each as found or not found. A list of only the
flags that fired cannot be told apart from a list of the flags that were checked, and the second
is the claim a reader will assume.

- Liability cap under 6 months' fees
- Uncapped indemnification, or carve-outs broad enough to void the cap
- "As-is", all warranties disclaimed
- Unilateral suspension without notice
- Unilateral amendment rights
- No termination for convenience on our side
- Perpetual obligations — tails, non-competes, confidentiality with no end
- Offshore jurisdiction (BVI, Cayman, Seychelles, Marshall Islands)
- Auto-renewal with a notice window over 60 days
- "Sole discretion" or "as determined by [counterparty]" on anything that costs money
- Class-action waiver combined with mandatory individual arbitration
- Asymmetric assignment — they may, you may not
- Fee or payment obligations that survive termination without a corresponding service
- A blank, "TBD" or "$____" in any operative commercial term
