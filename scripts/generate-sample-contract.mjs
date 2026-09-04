/**
 * A single, properly structured contract to upload by hand and test with.
 *
 * The eight fixtures under `fixtures/contracts/` are deliberately short — each
 * is a probe for one cluster of problems. This one is different: a full-length
 * agreement of the kind that actually lands in a legal inbox, with recitals, a
 * definitions article, cross-referenced clauses, an exhibit and a signature
 * block, running to several pages.
 *
 * It matters that it is long and mixed. A short document of pure red flags does
 * not test whether the reviewer can hold a whole agreement in view, find the
 * clause that quietly undoes another one twelve pages later, or resist calling
 * everything critical. This one is roughly what a real vendor's paper looks
 * like: mostly reasonable, with a handful of genuinely serious problems and
 * several that are merely off-market.
 *
 * Written to the repository root as `sample-contract.pdf` so it is easy to find
 * and drag into the console.
 *
 * Run with: npm run sample
 */
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Doc from "./lib/contract-doc.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "sample-contract.pdf");

/**
 * What this document is built to contain.
 *
 * Kept beside the document rather than in a separate manifest because this file
 * has one job — you upload it, and you check the review against this list.
 */
const EXPECTED = {
  critical: [
    "Section 11.2 — liability capped at 3 months' fees, below the 6-month red-flag line",
    "Section 11.4 — carve-out makes Customer's liability uncapped for 'any breach of this Agreement', which voids the cap it sits under",
    "Section 12.1 — Customer indemnity is uncapped and covers Vendor's own negligence",
    "Section 9.4 — Vendor may use Customer Data to train models, with no opt-out",
    "Section 8.3 — Vendor may suspend immediately at sole discretion for any reason",
  ],
  important: [
    "Section 7.2 — renewal fee increases capped at 12%, above the 5% house standard",
    "Section 7.3 — 75 days' notice required to prevent auto-renewal",
    "Section 10.1 — 99.5% uptime, below the 99.9% standard, and credits are the sole remedy",
    "Section 13.5 — Vendor may assign freely; Customer needs consent (asymmetric)",
    "Section 6.4 — data export limited to 30 days and charged at Vendor's professional-services rate",
    "Section 14.1 — governing law is the British Virgin Islands",
    "Section 15.2 — Customer waives jury trial and class actions",
  ],
  acceptable: [
    "Section 9.1 — Customer owns Customer Data outright",
    "Section 9.3 — 72-hour security incident notification",
    "Section 5.2 — 30-day cure period for material breach, mutual",
    "Section 4.3 — subprocessor changes on 30 days' notice with an objection right",
    "Section 16.4 — amendments require a signed writing",
  ],
  consistency: [
    "Section 3.2 refers to Exhibit B, which is not attached (only Exhibit A is)",
    "Section 11.4 contradicts the cap in Section 11.2",
    "'Authorised User' is used in Section 3.1 but defined nowhere",
    "Section 10.2 cross-references Section 10.4, which does not exist",
  ],
  preSigning: ["Section 7.1 — the annual fee is left as $__________"],
};

function build() {
  const doc = new Doc("Master Subscription Agreement");

  /* ── Front matter ─────────────────────────────────────────────────────── */
  doc.title(
    "Master Subscription Agreement",
    "Helix Data Systems, Inc. and Northwind Studio LLC",
  );

  doc.para(
    "This Master Subscription Agreement (this \"Agreement\") is entered into as of 12 January 2026 " +
      "(the \"Effective Date\") by and between Helix Data Systems, Inc., a Delaware corporation with " +
      "its principal place of business at 400 Sansome Street, San Francisco, California (\"Vendor\"), " +
      "and Northwind Studio LLC, a California limited liability company with its principal place of " +
      "business at 1100 Bryant Street, San Francisco, California (\"Customer\"). Vendor and Customer " +
      "are each a \"Party\" and together the \"Parties\".",
  );
  doc.space(4);
  doc.para(
    "WHEREAS Vendor operates a hosted data-integration platform; and WHEREAS Customer wishes to " +
      "subscribe to that platform on the terms set out below; NOW THEREFORE, in consideration of the " +
      "mutual covenants contained herein, the Parties agree as follows.",
  );

  /* ── 1. Definitions ───────────────────────────────────────────────────── */
  doc.heading("1. Definitions");
  doc.clause("1.1", "Affiliate", "any entity that controls, is controlled by, or is under common control with a Party, where control means ownership of more than fifty percent (50%) of the voting interests.");
  doc.clause("1.2", "Confidential Information", "all non-public information disclosed by one Party to the other, whether orally or in writing, that is designated as confidential or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure.");
  doc.clause("1.3", "Customer Data", "all data, content and materials submitted to or processed by the Services by or on behalf of Customer.");
  doc.clause("1.4", "Documentation", "Vendor's then-current technical documentation for the Services made available at docs.helixdata.example.");
  doc.clause("1.5", "Order Form", "an ordering document executed by both Parties that references this Agreement and specifies the Services, the fees and the Subscription Term.");
  doc.clause("1.6", "Services", "the hosted software platform identified in an Order Form, together with any updates Vendor makes generally available.");
  doc.clause("1.7", "Subscription Term", "the period specified in an Order Form during which Customer is entitled to access the Services.");

  /* ── 2. Provision ─────────────────────────────────────────────────────── */
  doc.heading("2. Provision of the Services");
  doc.clause("2.1", "Access", "Subject to Customer's compliance with this Agreement and payment of the applicable fees, Vendor grants Customer a non-exclusive, non-transferable right during the Subscription Term to access and use the Services for Customer's internal business purposes.");
  doc.clause("2.2", "Restrictions", "Customer shall not: (a) resell or sublicense the Services; (b) reverse engineer or attempt to derive the source code of the Services except to the extent that restriction is prohibited by applicable law; (c) use the Services to build a competing product; or (d) circumvent any usage limits set out in an Order Form.");
  doc.clause("2.3", "Vendor Responsibilities", "Vendor shall provide the Services in accordance with the Documentation and shall not materially decrease the functionality of the Services during a Subscription Term.");

  /* ── 3. Implementation ────────────────────────────────────────────────── */
  doc.heading("3. Implementation and Support");
  doc.clause("3.1", "Onboarding", "Vendor shall provide the onboarding assistance described in the applicable Order Form. Customer shall designate a technical contact and shall ensure that each Authorised User completes Vendor's standard onboarding before accessing the Services.");
  doc.clause("3.2", "Support", "Vendor shall provide support in accordance with the support policy set out in Exhibit B, including the response targets stated therein.");
  doc.clause("3.3", "Professional Services", "Any professional services shall be scoped in a separate statement of work and charged at Vendor's then-current rates.");

  /* ── 4. Subprocessors ─────────────────────────────────────────────────── */
  doc.heading("4. Subprocessors and Third Parties");
  doc.clause("4.1", "Use of Subprocessors", "Vendor may engage subprocessors to assist in providing the Services, and remains responsible for their performance and compliance with this Agreement.");
  doc.clause("4.2", "Current List", "Vendor maintains a current list of subprocessors in the Documentation.");
  doc.clause("4.3", "Changes", "Vendor shall give Customer at least thirty (30) days' written notice before engaging any new subprocessor with access to Customer Data. Customer may object on reasonable data-protection grounds within that period, and if the Parties cannot resolve the objection in good faith, Customer may terminate the affected Services without penalty and receive a pro-rata refund of prepaid fees.");
  doc.clause("4.4", "Third-Party Integrations", "The Services may interoperate with third-party products. Vendor is not responsible for those products, and Customer's use of them is governed by its own agreements with the relevant providers.");

  /* ── 5. Term ──────────────────────────────────────────────────────────── */
  doc.heading("5. Term and Termination");
  doc.clause("5.1", "Term", "This Agreement commences on the Effective Date and continues until all Subscription Terms have expired or been terminated.");
  doc.clause("5.2", "Termination for Cause", "Either Party may terminate this Agreement or any Order Form if the other Party materially breaches this Agreement and fails to cure that breach within thirty (30) days after receiving written notice describing it in reasonable detail, provided that the cure period for non-payment shall be ten (10) days.");
  doc.clause("5.3", "Termination for Insolvency", "Either Party may terminate immediately if the other becomes insolvent, makes an assignment for the benefit of creditors, or has a receiver appointed over a material part of its assets.");
  doc.clause("5.4", "Survival", "Sections 1, 9, 11, 12, 13 and 16 survive any termination or expiry of this Agreement.");

  /* ── 6. Post-termination ──────────────────────────────────────────────── */
  doc.heading("6. Effect of Termination");
  doc.clause("6.1", "Cessation", "Upon termination or expiry, Customer's right to access the Services ceases.");
  doc.clause("6.2", "Outstanding Fees", "All fees accrued prior to termination become immediately due. Fees for the remainder of a terminated Subscription Term are non-refundable except where Customer terminates under Section 5.2.");
  doc.clause("6.3", "Deletion", "Vendor shall delete Customer Data from its production systems within ninety (90) days of termination, save for copies retained in routine backups or as required by law.");
  doc.clause("6.4", "Data Export", "Customer may request an export of Customer Data within thirty (30) days of termination. Vendor shall provide the export in a format of Vendor's choosing, and such export shall be charged as a professional services engagement at Vendor's then-current rates.");

  /* ── 7. Fees ──────────────────────────────────────────────────────────── */
  doc.heading("7. Fees and Payment");
  doc.clause("7.1", "Fees", "Customer shall pay Vendor an annual subscription fee of $__________, invoiced annually in advance. All fees are stated exclusive of taxes.");
  doc.clause("7.2", "Increases", "Vendor may increase the fees for any renewal term by giving notice not less than thirty (30) days before the start of that renewal term, provided that no single increase shall exceed twelve percent (12%) of the fees for the preceding term.");
  doc.clause("7.3", "Renewal", "Each Subscription Term renews automatically for successive periods of equal length unless either Party gives written notice of non-renewal at least seventy-five (75) days before the end of the then-current Subscription Term.");
  doc.clause("7.4", "Late Payment", "Undisputed invoices unpaid after thirty (30) days accrue interest at one and one-half percent (1.5%) per month or the maximum rate permitted by law, whichever is lower.");
  doc.clause("7.5", "Disputes", "Customer may withhold payment of any amount it disputes in good faith, provided it pays the undisputed balance and notifies Vendor of the basis of the dispute within fifteen (15) days of the invoice date.");

  /* ── 8. Suspension ────────────────────────────────────────────────────── */
  doc.heading("8. Suspension");
  doc.clause("8.1", "For Non-Payment", "Vendor may suspend the Services if any undisputed invoice remains unpaid more than thirty (30) days after written notice.");
  doc.clause("8.2", "For Security", "Vendor may suspend affected components of the Services where continued provision presents a material and imminent security risk, and shall restore them as soon as the risk is resolved.");
  doc.clause("8.3", "General", "Notwithstanding Sections 8.1 and 8.2, Vendor may suspend or limit the Services immediately, in its sole discretion, without prior notice and for any reason it deems appropriate. Suspension under this Section does not relieve Customer of its obligation to pay fees for the suspended period.");

  /* ── 9. Data ──────────────────────────────────────────────────────────── */
  doc.heading("9. Customer Data and Security");
  doc.clause("9.1", "Ownership", "As between the Parties, Customer owns all right, title and interest in and to Customer Data. Vendor acquires no rights in Customer Data other than the limited rights expressly granted in this Agreement.");
  doc.clause("9.2", "Security Measures", "Vendor shall maintain an information security programme consistent with SOC 2 Type II and shall make its most recent audit report available to Customer on request under confidentiality.");
  doc.clause("9.3", "Incident Notification", "Vendor shall notify Customer without undue delay, and in any event within seventy-two (72) hours, of becoming aware of any unauthorised access to or disclosure of Customer Data, and shall provide sufficient information to enable Customer to meet its own notification obligations.");
  doc.clause("9.4", "Service Improvement", "Notwithstanding Section 9.1, Customer grants Vendor a perpetual, irrevocable, worldwide, royalty-free licence to use, reproduce and create derivative works of Customer Data for the purpose of developing, training and improving Vendor's machine-learning models and other products and services. This licence survives termination of this Agreement.");

  /* ── 10. SLA ──────────────────────────────────────────────────────────── */
  doc.heading("10. Service Levels");
  doc.clause("10.1", "Availability", "Vendor shall use commercially reasonable efforts to make the Services available at least ninety-nine and five tenths percent (99.5%) of the time in each calendar month, excluding scheduled maintenance. Customer's sole and exclusive remedy for any failure to meet this commitment is the service credits set out in Exhibit A.");
  doc.clause("10.2", "Exclusions", "The availability commitment excludes downtime caused by Customer's systems, third-party services, or force majeure events as described in Section 10.4.");
  doc.clause("10.3", "Maintenance", "Vendor shall give at least five (5) business days' notice of scheduled maintenance likely to affect availability.");

  /* ── 11. Liability ────────────────────────────────────────────────────── */
  doc.heading("11. Limitation of Liability");
  doc.clause("11.1", "Exclusion", "Neither Party shall be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue or data, however caused and under any theory of liability.");
  doc.clause("11.2", "Cap", "Each Party's total aggregate liability arising out of or relating to this Agreement shall not exceed the total fees paid by Customer under this Agreement in the three (3) months immediately preceding the event giving rise to the claim.");
  doc.clause("11.3", "Mutual Exceptions", "The exclusion in Section 11.1 does not apply to a Party's fraud or wilful misconduct, or to death or personal injury caused by a Party's negligence.");
  doc.clause("11.4", "Customer Exceptions", "The limitation in Section 11.2 shall not apply to, and Customer's liability shall be unlimited in respect of: (a) Customer's payment obligations; (b) Customer's indemnification obligations under Section 12.1; (c) Customer's breach of Section 2.2; and (d) any breach of this Agreement by Customer.");

  /* ── 12. Indemnity ────────────────────────────────────────────────────── */
  doc.heading("12. Indemnification");
  doc.clause("12.1", "By Customer", "Customer shall defend, indemnify and hold harmless Vendor, its Affiliates, officers, directors, employees and agents from and against any and all claims, damages, losses, liabilities, costs and expenses (including reasonable legal fees) arising out of or relating to Customer Data, Customer's use of the Services, or Customer's breach of this Agreement, regardless of whether such claim arises in whole or in part from Vendor's own negligence.");
  doc.clause("12.2", "By Vendor", "Vendor shall defend Customer against any third-party claim that the Services, as provided by Vendor and used in accordance with the Documentation, infringe a United States patent or copyright, and shall pay damages finally awarded, subject to the limitation in Section 11.2.");
  doc.clause("12.3", "Procedure", "The indemnified Party shall promptly notify the indemnifying Party of any claim, give the indemnifying Party sole control of the defence and settlement, and provide reasonable cooperation at the indemnifying Party's expense.");

  /* ── 13. Confidentiality and assignment ───────────────────────────────── */
  doc.heading("13. Confidentiality and General Obligations");
  doc.clause("13.1", "Obligation", "Each Party shall protect the other's Confidential Information using no less than reasonable care and shall not disclose it except to its employees, Affiliates and advisers who need to know it and who are bound by confidentiality obligations no less protective than these.");
  doc.clause("13.2", "Exceptions", "These obligations do not apply to information that is or becomes public through no fault of the receiving Party, was known to the receiving Party before disclosure, is independently developed without use of the disclosing Party's Confidential Information, or is rightfully received from a third party without restriction.");
  doc.clause("13.3", "Duration", "The obligations in this Section continue for three (3) years from the date of disclosure, and indefinitely in respect of any information that constitutes a trade secret.");
  doc.clause("13.4", "Compelled Disclosure", "A Party may disclose Confidential Information to the extent required by law, provided it gives the other Party prompt notice where legally permitted and reasonable assistance in seeking protective treatment.");
  doc.clause("13.5", "Assignment", "Vendor may assign or transfer this Agreement, in whole or in part, to any Affiliate or successor without Customer's consent and without notice. Customer may not assign or transfer this Agreement, in whole or in part, without Vendor's prior written consent, which Vendor may withhold in its sole discretion.");

  /* ── 14–16 ────────────────────────────────────────────────────────────── */
  doc.heading("14. Governing Law");
  doc.clause("14.1", "Law", "This Agreement and any dispute arising out of or in connection with it shall be governed by and construed in accordance with the laws of the British Virgin Islands, without regard to its conflict-of-laws principles.");

  doc.heading("15. Dispute Resolution");
  doc.clause("15.1", "Arbitration", "Any dispute arising out of or relating to this Agreement shall be finally resolved by binding arbitration administered by the Singapore International Arbitration Centre under its rules then in force, seated in Singapore, before a single arbitrator.");
  doc.clause("15.2", "Waivers", "EACH PARTY IRREVOCABLY WAIVES ANY RIGHT TO TRIAL BY JURY AND AGREES THAT ANY CLAIM SHALL BE BROUGHT ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.");

  doc.heading("16. Miscellaneous");
  doc.clause("16.1", "Entire Agreement", "This Agreement, together with all Order Forms and Exhibits, constitutes the entire agreement between the Parties and supersedes all prior proposals and understandings on its subject matter.");
  doc.clause("16.2", "Order of Precedence", "In the event of conflict, the following order applies: (a) the applicable Order Form; (b) the body of this Agreement; (c) the Exhibits.");
  doc.clause("16.3", "Notices", "Notices shall be given in writing to the addresses stated above, and are deemed received on delivery if hand-delivered, or three (3) business days after posting if sent by recorded delivery.");
  doc.clause("16.4", "Amendment", "No amendment to this Agreement is effective unless it is in writing and signed by an authorised representative of each Party.");
  doc.clause("16.5", "Severability", "If any provision is held unenforceable, the remainder of this Agreement continues in full force and the unenforceable provision shall be modified to the minimum extent necessary to make it enforceable.");
  doc.clause("16.6", "Counterparts", "This Agreement may be executed in counterparts, each of which is deemed an original.");

  /* ── Exhibit A ────────────────────────────────────────────────────────── */
  doc.heading("Exhibit A — Service Credits");
  doc.para(
    "Where monthly availability falls below the commitment in Section 10.1, Customer may request " +
      "service credits, calculated as a percentage of the monthly fee for the affected Services:",
  );
  doc.space(4);
  doc.para("99.0% to below 99.5% — a credit of five percent (5%) of the monthly fee.");
  doc.para("95.0% to below 99.0% — a credit of ten percent (10%) of the monthly fee.");
  doc.para("Below 95.0% — a credit of twenty percent (20%) of the monthly fee.");
  doc.space(4);
  doc.para(
    "Credits must be requested in writing within thirty (30) days of the end of the affected month, " +
      "are applied against future invoices, are not payable in cash, and shall not in aggregate " +
      "exceed twenty percent (20%) of the fees for the affected month.",
  );

  doc.signature(["HELIX DATA SYSTEMS, INC.", "NORTHWIND STUDIO LLC"]);
  return doc.toBuffer();
}

const bytes = build();

// The same two checks the fixture generator runs: a header a reader will
// accept, and page objects the app's own page count can see. A sample that
// cannot be opened would waste a manual test rather than fail one.
if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
  throw new Error("The generated file is not a PDF.");
}
const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page(?![sA-Za-z])/g) ?? []).length;
if (pages < 3) throw new Error(`Expected a multi-page agreement, produced ${pages}.`);

await writeFile(OUT, new Uint8Array(bytes));

const total =
  EXPECTED.critical.length +
  EXPECTED.important.length +
  EXPECTED.acceptable.length +
  EXPECTED.consistency.length +
  EXPECTED.preSigning.length;

console.log(`\nsample-contract.pdf — ${pages} pages, ${(bytes.length / 1024).toFixed(0)} KB`);
console.log(`sha256 ${createHash("sha256").update(new Uint8Array(bytes)).digest("hex").slice(0, 16)}…`);
console.log(`\nUpload it as the CUSTOMER. It is built to contain ${total} findable things:\n`);
for (const [group, items] of Object.entries(EXPECTED)) {
  console.log(`  ${group}`);
  for (const item of items) console.log(`    - ${item}`);
}
console.log("\nA review that misses the Section 11.4 carve-out or the Section 9.4 training licence");
console.log("has missed the two that actually matter.\n");
