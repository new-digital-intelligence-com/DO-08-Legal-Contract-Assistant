# Risk taxonomy

The categories a review works through. Grounded in the CUAD dataset's 41 clause types, extended
with the provisions that matter in modern software, data and payment agreements and are absent
from a corpus of older commercial contracts.

Use it as coverage, not as an output format. A review that walks the reader through forty-one
headings is unreadable; a review that silently skipped assignment because the contract did not
mention it has failed. Work the list, report what is there and what is missing.

## Document basics

- Document name and type
- Parties, with full legal entity names and roles
- Agreement date and effective date
- Expiration and renewal
- **Document status** — draft or executed
- **Blank fields and placeholders** — "$____", "TBD", "[amount]", empty brackets
- **Missing exhibits** — schedules referenced and not attached
- **Order of precedence** between the master agreement, order forms, SOWs and linked online terms

## Term and termination

- Contract term and duration
- Termination for convenience — which side, notice period
- Termination for cause — what counts, cure period
- Post-termination services and transition assistance
- Survival clauses
- **Suspension rights** — immediate, or on notice
- **Cure periods**
- **Effect on prepaid fees** — refunded, forfeited, silent

## Assignment and control

- Anti-assignment clause
- Change of control
- Consent requirements, and whether consent may be unreasonably withheld
- **Asymmetric assignment** — they may, you may not
- Subcontracting, and liability for subcontractors

## Financial terms

- Payment terms and late payment
- Price restrictions and adjustment mechanics
- Most favoured nation
- Minimum commitment and volume restrictions
- Audit rights
- **Price escalation caps**
- **Reserve and holdback requirements**
- **Auto-debit authority**
- **Taxes** — who bears which, gross-up obligations
- **Set-off rights**

## Liability and risk

- Limitation of liability, and the cap
- **Carve-outs from the cap** — the clause that most often makes the cap meaningless
- Indemnification: scope, mutuality, defence control, settlement consent
- Insurance requirements
- Warranty scope and duration
- **Warranty disclaimer ("as-is")**
- **Exclusive remedy clauses**
- **Consequential-damages exclusion**, and whether it is mutual
- **Chargeback and return liability**
- **Force majeure**, and whether payment obligations are excused by it

## IP and confidentiality

- IP ownership and assignment
- Licence grant: scope, exclusivity, sublicensing, term, revocability
- Affiliate licence — licensor and licensee side
- Covenant not to sue
- Non-compete
- Non-solicitation, of employees and of customers
- Competitive restriction exceptions
- Exclusivity
- Non-disparagement
- Confidentiality duration and exceptions
- Third-party beneficiary
- **Residuals clause**
- **Feedback ownership**
- **Open-source and third-party components**
- **Trained-model and derived-data rights** — whether your data may be used to improve their product

## Data and security

- **Data ownership** — customer data, derived data, aggregated data
- **Data export rights** on termination: format, window, cost
- **Deletion obligations** and legal-hold carve-outs
- **Security standard committed to**, and evidence of it
- **Incident notification** window and content
- **Subprocessor** authorisation, notice and objection
- **International transfer** mechanism
- **Personnel screening and access controls**

## Service commitments

- **Uptime and availability SLA**, and the credit that backs it
- **Support response and resolution targets**
- **Maintenance windows** and whether they are excluded from uptime
- **Deprecation and end-of-life notice**
- **Chronic-failure termination right**

## Dispute resolution

- Governing law
- Jurisdiction and venue
- Arbitration or litigation; seat, rules, number of arbitrators
- Jury trial waiver
- **Class-action waiver**
- **Offshore jurisdiction flags**
- **Fee-shifting** — who pays costs
- **Limitation period** shortened by contract

## Special provisions

- ROFR, ROFO, ROFN
- Revenue and profit sharing
- Joint IP ownership
- Source-code escrow
- Irrevocable or perpetual licences
- **Unilateral amendment rights**
- **Incorporation by reference to a URL**
- **Publicity and logo rights**
- **Most-favoured-customer commitments**

## Cross-cutting, and easy to miss

These are not clause types; they are ways a document can be wrong that no single-clause read
catches. Check them explicitly.

- **A cap defined in one clause and re-defined in another.** Two liability provisions that do not
  agree; the later one usually wins, and it is usually the worse one.
- **A carve-out that swallows its own cap.** "Nothing limits liability for breach of this
  Agreement" makes the cap decorative.
- **A defined term used before it is defined, or never defined at all.**
- **A cross-reference to a clause or exhibit that does not exist.** Renumbering breaks these.
- **Obligations that survive with no corresponding right.** Fees payable after termination for a
  service no longer provided.
- **An online-terms link that overrides the negotiated document.**
- **Notice provisions nobody can comply with** — an address that is wrong, or notice by a method
  the parties do not use.
- **Inconsistent party names** between the preamble, the body and the signature block.
