# Fallback language by provision

Replacement language for the provisions that actually get negotiated. Each entry gives the opening
ask, the compromise, and — where one is genuinely warranted — the point past which it needs an
exception.

Two things to hold on to. **These are drafting starting points, not approved positions**: the
[house playbook](../../contract-review/references/playbook.md) is the authority, and where it
and this file disagree, the playbook wins. And **the bracketed placeholders stay bracketed** until a person fills them. Never
substitute a plausible number.

---

## Limitation of liability — the cap

**Ask for**
> Each party's total aggregate liability arising out of or related to this Agreement shall not
> exceed the total fees paid or payable by Customer under this Agreement in the twelve (12) months
> preceding the event giving rise to the claim.

**Settle for**
> ...in the six (6) months preceding the event giving rise to the claim.

**Escalate below** three months' fees, or any cap expressed as a fixed sum unrelated to fees — at
a low contract value a fixed cap can be smaller than a single month's charges.

*Watch for:* a cap that applies only to one party. If the drafting says "Vendor's liability shall
not exceed…", make it "Each party's".

---

## Carve-outs from the cap

This is the clause that most often makes a cap meaningless, and it is easy to miss because it
reads as protective.

**Ask for**
> The limitations in Section [cap] shall not apply to: (a) either party's indemnification
> obligations under Section [indemnity]; (b) breach of Section [confidentiality]; (c) a party's
> fraud or wilful misconduct; or (d) death or personal injury caused by a party's negligence.

**Settle for** the same list with Customer's payment obligations added.

**Escalate on** any carve-out for "breach of this Agreement", "breach of any material term", or
anything that would let the counterparty route an ordinary claim around the cap. A cap with that
carve-out is not a cap.

---

## Indemnification

**Ask for**
> Each party shall defend, indemnify and hold harmless the other against third-party claims to the
> extent arising from the indemnifying party's breach of this Agreement, negligence or wilful
> misconduct. The indemnified party shall promptly notify the indemnifying party, give it sole
> control of the defence, and provide reasonable cooperation at the indemnifying party's expense.
> The indemnifying party shall not settle any claim in a way that imposes any obligation or
> admission on the indemnified party without its prior written consent.

**Settle for** a one-directional IP indemnity from the supplier where only one party's IP is in
play, with the settlement-consent sentence kept.

**Escalate on** an indemnity that survives uncapped *and* covers first-party losses. That is not
an indemnity, it is uncapped liability wearing one.

---

## Termination for convenience

**Ask for**
> Either party may terminate this Agreement for convenience upon sixty (60) days' prior written
> notice to the other party. Upon such termination, Vendor shall refund any prepaid fees for the
> period after the effective date of termination.

**Settle for** a vendor-only right, provided the refund sentence stays and the notice period is at
least ninety (90) days so there is time to migrate.

**Escalate on** a vendor right to terminate on thirty days with no refund and no transition
assistance.

---

## Cure period

**Ask for**
> Either party may terminate this Agreement for material breach if the breach remains uncured
> thirty (30) days after written notice describing it in reasonable detail, save that the cure
> period for non-payment shall be ten (10) days.

**Settle for** fifteen (15) days for non-payment breaches only.

---

## Auto-renewal

**Ask for**
> This Agreement renews for successive twelve (12) month terms unless either party gives written
> notice of non-renewal at least thirty (30) days before the end of the then-current term.

**Settle for** sixty (60) days' notice on a multi-year term.

**Escalate on** a notice window that opens more than ninety days before expiry, or a renewal term
longer than the initial term.

---

## Price increases

**Ask for**
> Fees for any renewal term shall not increase by more than the lesser of (a) five percent (5%) or
> (b) the increase in the Consumer Price Index (All Urban Consumers, US City Average) over the
> preceding twelve (12) months. Vendor shall give at least sixty (60) days' notice of any increase.

**Settle for** a seven percent cap on a single-year renewal, notice period kept.

**Escalate on** uncapped renewal pricing on any term longer than one year.

---

## Data export on termination

**Ask for**
> Upon termination or expiry for any reason, Vendor shall make Customer Data available for export
> in a structured, commonly used, machine-readable format (CSV or JSON) for ninety (90) days at no
> additional charge, and shall permanently delete it thereafter upon Customer's written request,
> subject only to retention required by law.

**Settle for** thirty (30) days, where a self-service export API is available throughout the term.

**Escalate on** no export right, or export offered only as chargeable professional services.

---

## Unilateral amendment

**Ask for** deletion. Replace with:
> This Agreement may be amended only by a written instrument signed by both parties.

**Settle for**
> Vendor may modify the [online terms] on sixty (60) days' notice. If a modification materially
> and adversely affects Customer, Customer may terminate without penalty and receive a pro-rata
> refund of prepaid fees by giving notice within thirty (30) days of the modification taking
> effect.

**Escalate on** terms that change by being posted, with no notice and no exit.

---

## Suspension

**Ask for**
> Vendor may suspend the Services only (a) for non-payment, following ten (10) days' written
> notice and a failure to cure, or (b) where continued provision presents a material and imminent
> security risk, in which case Vendor shall limit the suspension to the affected component and
> restore service as soon as the risk is resolved.

**Settle for** immediate suspension for a genuine security event, with a notice-and-cure
requirement kept for everything else.

**Escalate on** suspension at sole discretion for any reason.

---

## Service levels

**Ask for**
> Vendor shall maintain at least 99.9% availability of the Services in each calendar month,
> measured excluding scheduled maintenance notified at least five (5) business days in advance.
> Failure entitles Customer to the service credits in Exhibit [SLA]. If availability falls below
> the committed level in any three (3) months within a rolling twelve-month period, Customer may
> terminate the affected Services without penalty and receive a pro-rata refund.

**Settle for** 99.5% for non-production environments, chronic-failure exit kept.

**Escalate on** an availability figure with no credit and no remedy. That is a marketing claim.

---

## Security incident notification

**Ask for**
> Vendor shall notify Customer without undue delay and in any event within seventy-two (72) hours
> of becoming aware of any Security Incident affecting Customer Data, and shall provide sufficient
> information to enable Customer to meet its own notification obligations, together with regular
> updates until the incident is resolved.

**Settle for** "without undue delay" plus a stated internal escalation commitment.

**Escalate on** notification triggered only by a confirmed regulatory obligation — by then the
customer's own clock has usually run.

---

## Subprocessors

**Ask for**
> Vendor shall give Customer at least thirty (30) days' notice before engaging any new
> Subprocessor with access to Customer Data. Customer may object on reasonable data-protection
> grounds, and if the parties cannot resolve the objection, Customer may terminate the affected
> Services without penalty.

**Settle for** notice plus the termination right, where an objection right is refused.

---

## Confidentiality term

**Ask for**
> Each party shall protect the other's Confidential Information for three (3) years from the date
> of disclosure, and for so long as it remains a trade secret under applicable law in the case of
> trade secrets.

**Settle for** five (5) years for technical or product information.

**Escalate on** a perpetual obligation over all information with no trade-secret carve-out —
unadministrable, and it never expires from anybody's systems.

---

## Residuals

**Ask for** deletion. Where it must stay:
> Neither party shall be restricted from using general knowledge, skills and experience retained
> in the unaided memory of its personnel, provided that this Section does not grant any licence
> under either party's patents or copyrights, and does not permit use of the other party's
> Confidential Information in tangible or recorded form.

**Escalate on** a one-way residuals clause in favour of the party receiving more information — it
converts the NDA into a licence.

---

## Non-solicitation

**Ask for**
> During the term and for twelve (12) months thereafter, neither party shall knowingly solicit for
> employment any employee of the other with whom it had material contact in connection with this
> Agreement. General advertising not targeted at the other party's employees, and unsolicited
> applications, shall not breach this Section.

**Settle for** eighteen (18) months where personnel are embedded on site.

**Escalate on** a no-hire covering all employees regardless of contact, or anything beyond
twenty-four months.

---

## Assignment

**Ask for**
> Neither party may assign this Agreement without the other's prior written consent, such consent
> not to be unreasonably withheld or delayed, except that either party may assign to a successor
> to all or substantially all of its business or assets on written notice. Customer may terminate
> on notice if Vendor is acquired by a direct competitor of Customer.

**Settle for** symmetrical free assignment to affiliates and successors, with notice both ways.

**Escalate on** any clause letting them assign freely while requiring our consent.

---

## Governing law

**Ask for**
> This Agreement is governed by the laws of the State of Delaware, excluding its conflict-of-laws
> rules, and the parties submit to the exclusive jurisdiction of the state and federal courts
> located in Delaware.

**Settle for** New York, England and Wales, or the counterparty's home jurisdiction where it is an
OECD member and they are materially the larger party.

**Escalate on** BVI, Cayman, Seychelles or Marshall Islands on an operating contract — the
objection is enforcement cost, not the substantive law.

---

## Audit rights

**Ask for**
> Either party may audit the other's compliance with this Agreement no more than once in any
> twelve-month period, on thirty (30) days' written notice, during normal business hours, and
> subject to reasonable confidentiality obligations. The auditing party shall bear the cost, save
> that where an audit reveals material non-compliance, the audited party shall bear the reasonable
> cost of that audit.

**Settle for** twice-yearly in a regulated context, notice period kept.

**Escalate on** unannounced audits, or audits always at our cost regardless of outcome.
