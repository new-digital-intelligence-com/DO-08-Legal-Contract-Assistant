# The house playbook

Positions this organisation has already decided it takes. Check every contract
against these as well as against the market.

**This is a different question from whether a term is market-standard, and the
two disagree often.** A clause can be entirely normal in the market and still
breach a position here — that is a deviation, and it is the case most worth
catching. A clause can also be unusual and perfectly compliant. Report a
deviation as *we require X, this says Y*, never as *this is unusual*.

Where a contract is silent on a topic below, that is a deviation only if the
standard requires the term to be present. Silence on audit rights is usually
fine; silence on data export is not.

> These are the defaults this plugin ships with. The DO-08 web console keeps an
> editable copy that its own reviews are judged against, so if this organisation
> has changed a position there, the console is the authority and this file is
> the starting point it began from.

---

## Limitation of liability — general cap
*Applies to: SaaS, MSA, services, consulting, reseller, licence · Owner: General Counsel*

**We require** general liability capped at no less than 12 months of fees paid or payable.

- **Preferred:** "Each party's total aggregate liability arising out of or related to this Agreement shall not exceed the total fees paid or payable by Customer in the twelve (12) months preceding the event giving rise to the claim."
- **Fallback:** not less than six (6) months' fees where annual contract value is under USD 50,000.
- **Escalate:** below three (3) months' fees, or a cap expressed as a fixed sum unrelated to fees.

## Uncapped liability carve-outs
*Applies to: all · Owner: General Counsel*

**We require** carve-outs from the cap to be mutual and limited to confidentiality breach, indemnity obligations, wilful misconduct, and death or personal injury.

- **Preferred:** "The limitations in this Section shall not apply to: (a) either party's indemnification obligations; (b) breach of confidentiality obligations; (c) a party's wilful misconduct or fraud; or (d) death or personal injury caused by negligence."
- **Fallback:** a one-sided carve-out where it mirrors an obligation only one party carries.
- **Escalate:** an uncapped carve-out for breach of the agreement generally. That makes the cap decorative and is not accepted.

## Indemnification — mutuality
*Applies to: SaaS, MSA, services, reseller, licence · Owner: General Counsel*

**We require** indemnities mutual in structure and capped in line with the liability cap.

- **Preferred:** "Each party shall indemnify the other against third-party claims arising from its own breach of this Agreement, subject to the limitations set out in Section [cap]."
- **Fallback:** a supplier-only IP indemnity where we present no equivalent risk.

## Termination for convenience
*Applies to: SaaS, MSA, services, consulting, reseller · Owner: Commercial Counsel*

**We require** a mutual right on no less than 30 and no more than 90 days' written notice.

- **Preferred:** "Either party may terminate this Agreement for convenience upon sixty (60) days' prior written notice to the other party."
- **Fallback:** a vendor-only right, if paired with a pro-rata refund of prepaid fees.
- **Escalate:** a vendor right on 30 days with no refund.

## Cure period for material breach
*Applies to: all · Owner: Commercial Counsel*

**We require** written notice and a 30-day cure period before termination for cause.

- **Preferred:** "Either party may terminate for material breach if the breach remains uncured thirty (30) — or ten (10) for non-payment — days after written notice describing it."
- **Fallback:** fifteen (15) days where the breach is non-payment.

## Auto-renewal and notice
*Applies to: SaaS, MSA, services, reseller, licence · Owner: Commercial Counsel*

**We require** no more than 30 days' notice to prevent renewal, and renewal terms no longer than 12 months.

- **Preferred:** "This Agreement renews for successive twelve (12) month terms unless either party gives written notice of non-renewal at least thirty (30) days before the end of the then-current term."
- **Fallback:** sixty (60) days' notice for multi-year terms.
- **Escalate:** a notice window opening more than 90 days before expiry, or a renewal term longer than the initial term.

## Price increases on renewal
*Applies to: SaaS, MSA, services, reseller, licence · Owner: Procurement*

**We require** renewal increases capped at the lower of CPI or 5% per year.

- **Preferred:** "Fees for any renewal term shall not increase by more than the lesser of (a) five percent (5%) or (b) the increase in the Consumer Price Index over the preceding twelve months."
- **Fallback:** a 7% cap on a single-year renewal.
- **Escalate:** uncapped renewal pricing on any term longer than one year.

## Data export on termination
*Applies to: SaaS, MSA, DPA, reseller · Owner: General Counsel*

**We require** customer data exportable in a machine-readable format for at least 90 days after termination, at no extra charge.

- **Preferred:** "Upon termination or expiry, Vendor shall make Customer Data available for export in a structured, commonly used, machine-readable format (CSV or JSON) for ninety (90) days at no additional charge, and shall delete it thereafter on written request."
- **Fallback:** thirty (30) days where an export API is available throughout the term.
- **Escalate:** no export right, or export offered only as a chargeable professional-services engagement.

## Security and breach notification
*Applies to: SaaS, MSA, DPA, reseller · Owner: Head of Security*

**We require** notification of a security incident affecting our data without undue delay and within 72 hours.

- **Preferred:** "Vendor shall notify Customer without undue delay and in any event within seventy-two (72) hours of becoming aware of any Security Incident affecting Customer Data, and shall provide sufficient information to allow Customer to meet its own notification obligations."
- **Fallback:** "without undue delay" with a stated internal escalation SLA.
- **Escalate:** notification triggered only by a confirmed regulatory duty.

## Subprocessor changes
*Applies to: SaaS, DPA, MSA · Owner: Data Protection Officer*

**We require** at least 30 days' notice of a new subprocessor, and a right to object.

- **Preferred:** "Vendor shall give Customer at least thirty (30) days' notice before engaging any new Subprocessor with access to Customer Data. Customer may object on reasonable data-protection grounds, and if the objection cannot be resolved, Customer may terminate the affected Services without penalty."
- **Fallback:** notice with a right to terminate, where an objection right is refused.

## Ownership of deliverables and feedback
*Applies to: services, consulting, MSA, licence · Owner: General Counsel*

**We require** ownership of deliverables created specifically for us, and that feedback we give transfers no IP.

- **Preferred:** "All Deliverables created specifically for Customer under a Statement of Work shall be the property of Customer upon payment. Vendor retains its pre-existing materials and grants Customer a perpetual, non-exclusive licence to use them as embedded in the Deliverables."
- **Fallback:** a perpetual, irrevocable, worldwide licence where the supplier's business model depends on retaining ownership.
- **Escalate:** any clause assigning ownership of our feedback, ideas or data to the vendor.

## Confidentiality duration
*Applies to: NDA, SaaS, MSA, services, consulting · Owner: General Counsel*

**We require** 3 to 5 years from disclosure, and indefinitely for trade secrets.

- **Preferred:** "Each party shall protect the other's Confidential Information for three (3) years from the date of disclosure, and for so long as it remains a trade secret in the case of trade secrets."
- **Fallback:** five (5) years for technical or product information.
- **Escalate:** a perpetual obligation over all information with no trade-secret carve-out.

## Residuals clause
*Applies to: NDA · Owner: General Counsel*

**We require** that a residuals clause is accepted only when mutual and limited to unaided memory.

- **Preferred:** "Neither party shall be restricted from using general knowledge, skills and experience retained in the unaided memory of its personnel, provided that this does not licence any patent or copyright, and does not permit use of the other party's Confidential Information in tangible form."
- **Fallback:** delete the residuals clause entirely.
- **Escalate:** a one-way residuals clause favouring the party receiving more information.

## Non-solicitation
*Applies to: NDA, MSA, services, consulting, reseller · Owner: Commercial Counsel*

**We require** mutual, no longer than 12 months, with general advertising carved out.

- **Preferred:** "During the term and for twelve (12) months thereafter, neither party shall knowingly solicit for employment any employee of the other with whom it had material contact under this Agreement. General advertising and unsolicited applications are not a breach."
- **Fallback:** eighteen (18) months where the engagement involves embedded personnel.
- **Escalate:** a no-hire covering all employees regardless of contact, or anything longer than 24 months.

## Governing law and venue
*Applies to: all · Owner: General Counsel*

**We require** a neutral, well-developed commercial jurisdiction. Offshore jurisdictions are escalated.

- **Preferred:** "This Agreement is governed by the laws of the State of Delaware, and the parties submit to the exclusive jurisdiction of the state and federal courts located there."
- **Fallback:** New York or England and Wales. The counterparty's home jurisdiction where it is an OECD member and we are the smaller party.
- **Escalate:** BVI, Cayman, or any jurisdiction where enforcement would be disproportionately expensive.

## Assignment and change of control
*Applies to: all · Owner: General Counsel*

**We require** symmetrical assignment rights, and a termination right if the counterparty is acquired by a competitor.

- **Preferred:** "Neither party may assign this Agreement without the other's prior written consent, not to be unreasonably withheld, except to a successor in interest to all or substantially all of its business. Customer may terminate on notice if Vendor is acquired by a direct competitor of Customer."
- **Fallback:** symmetrical free assignment to affiliates and successors, with notice.
- **Escalate:** any clause permitting them to assign freely while requiring our consent.

## Service levels and credits
*Applies to: SaaS, MSA, reseller · Owner: Head of Engineering*

**We require** at least 99.9% availability with service credits, and a termination right for chronic failure.

- **Preferred:** "Vendor shall maintain at least 99.9% monthly availability. Failure entitles Customer to service credits as set out in the SLA, and to terminate without penalty if availability falls below the committed level in any three (3) months of a rolling twelve-month period."
- **Fallback:** 99.5% for non-production or internal-only services.
- **Escalate:** an availability figure stated with no credit and no remedy. That is a marketing claim, not a service level.

## Audit rights
*Applies to: SaaS, MSA, services, reseller, merchant · Owner: Commercial Counsel*

**We require** reasonable notice, no more than annually, at the auditing party's cost unless material non-compliance is found.

- **Preferred:** "Either party may audit the other's compliance no more than once per year, on thirty (30) days' written notice, during business hours, at the auditing party's cost — save that where an audit reveals material non-compliance, the audited party shall bear the reasonable cost of that audit."
- **Fallback:** twice-yearly audits in a regulated context.
- **Escalate:** unannounced audit rights, or audits at our cost regardless of outcome.
