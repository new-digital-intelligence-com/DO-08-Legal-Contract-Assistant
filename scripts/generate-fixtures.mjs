/**
 * The fixture corpus: eight real, openable contract PDFs.
 *
 * These have to be genuine PDFs, not stand-ins. The review pipeline hands each
 * one to the model as a `document` content block and the console renders it in
 * an iframe, so a fake that only this repository's own code can read would let
 * the whole pipeline pass on files no lawyer could ever open.
 *
 * Each one is built to contain specific, known problems — the manifest records
 * which. That is what makes this a test corpus rather than eight documents: a
 * review of `saas-vendor-favourable.pdf` that does not flag the three-month
 * liability cap is a regression, and you can tell without reading the contract.
 *
 * `pdf-lite.mjs` has no layout engine on purpose, so the wrapping below is
 * done here, explicitly, against the same font metrics the writer uses.
 *
 * Run with: npm run fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Doc from "./lib/contract-doc.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "fixtures", "contracts");

/* ────────────────────────────────────────────────────────────────────────────
 * The corpus
 * ────────────────────────────────────────────────────────────────────────── */

const FIXTURES = [];

function fixture(entry) {
  FIXTURES.push(entry);
}

/* 1 ── The canonical bad SaaS paper ─────────────────────────────────────── */
fixture({
  filename: "saas-vendor-favourable.pdf",
  contractType: "saas",
  position: "customer",
  title: "Cloudform Subscription Agreement",
  contains: [
    "Liability cap of 3 months' fees (Section 10.2) — under the 6-month red-flag line",
    "Unilateral amendment by posting (Section 14.1)",
    "Auto-renewal with a 90-day notice window (Section 8.2)",
    "Vendor-only termination for convenience on 30 days (Section 8.5)",
    "No data export right on termination",
    "Immediate suspension at sole discretion (Section 6.3)",
    "Asymmetric assignment (Section 15.2)",
  ],
  build() {
    const doc = new Doc("Cloudform Subscription Agreement");
    doc.title("Subscription Agreement", "Cloudform Systems, Inc. and Northwind Studio LLC");
    doc.para(
      "This Subscription Agreement (the \"Agreement\") is entered into as of 14 March 2025 (the " +
        "\"Effective Date\") by and between Cloudform Systems, Inc., a Delaware corporation " +
        "(\"Vendor\"), and Northwind Studio LLC, a California limited liability company (\"Customer\").",
    );

    doc.heading("1. Definitions");
    doc.clause("1.1", "Services", "the hosted software made available by Vendor as described in an Order Form.");
    doc.clause("1.2", "Customer Data", "data submitted by Customer to the Services.");
    doc.clause("1.3", "Confidential Information", "non-public information disclosed by either party and identified as confidential.");

    doc.heading("6. Provision of the Services");
    doc.clause("6.1", "Availability", "Vendor will use commercially reasonable efforts to make the Services available 99.9% of the time each calendar month, excluding scheduled maintenance.");
    doc.clause("6.2", "No Credits", "Customer's sole remedy for any failure to meet the availability target set out in Section 6.1 is to notify Vendor. No service credits, refunds or other compensation are payable.");
    doc.clause("6.3", "Suspension", "Vendor may suspend the Services immediately, in its sole discretion and without prior notice, for any reason it considers appropriate, including suspected breach of this Agreement.");

    doc.heading("8. Term and Termination");
    doc.clause("8.1", "Initial Term", "twelve (12) months from the Effective Date.");
    doc.clause("8.2", "Renewal", "This Agreement renews automatically for successive twelve (12) month terms unless Customer gives written notice of non-renewal not less than ninety (90) days before the end of the then-current term.");
    doc.clause("8.3", "Fees on Renewal", "Vendor may increase the fees for any renewal term. No cap applies to such increases.");
    doc.clause("8.5", "Termination for Convenience", "Vendor may terminate this Agreement for any reason upon thirty (30) days' written notice to Customer. Customer has no equivalent right and prepaid fees are non-refundable.");
    doc.clause("8.6", "Effect of Termination", "Upon termination Customer's access to the Services ceases immediately. Vendor has no obligation to return, export or make available any Customer Data.");

    doc.heading("10. Limitation of Liability");
    doc.clause("10.1", "Exclusion", "Neither party is liable for indirect, incidental, special or consequential damages.");
    doc.clause("10.2", "Cap", "Vendor's total aggregate liability arising out of or related to this Agreement shall not exceed the fees paid by Customer in the three (3) months preceding the event giving rise to the claim.");
    doc.clause("10.3", "Carve-out", "Nothing in Section 10.2 limits Customer's obligation to pay fees, or Customer's liability for breach of Section 11 (Confidentiality), which shall be unlimited.");

    doc.heading("12. Indemnification");
    doc.clause("12.1", "By Customer", "Customer shall defend, indemnify and hold harmless Vendor against all claims arising from Customer's use of the Services or breach of this Agreement. This obligation is not subject to the limitation in Section 10.2.");

    doc.heading("14. General");
    doc.clause("14.1", "Amendment", "Vendor may modify the terms of this Agreement at any time by posting an updated version to its website. Continued use of the Services after posting constitutes acceptance.");
    doc.clause("14.2", "Governing Law", "This Agreement is governed by the laws of the State of Delaware.");

    doc.heading("15. Assignment");
    doc.clause("15.2", "Assignment", "Vendor may assign this Agreement freely and without notice. Customer may not assign this Agreement, in whole or in part, without Vendor's prior written consent, which may be withheld in Vendor's sole discretion.");

    doc.signature(["CLOUDFORM SYSTEMS, INC.", "NORTHWIND STUDIO LLC"]);
    return doc.toBuffer();
  },
});

/* 2 ── A balanced NDA, so "acceptable" has real content ─────────────────── */
fixture({
  filename: "mutual-nda-balanced.pdf",
  contractType: "nda",
  position: "receiving-party",
  title: "Mutual Non-Disclosure Agreement",
  contains: [
    "Genuinely balanced — most provisions should come back acceptable",
    "3-year term with an indefinite trade-secret carve-out (Section 4)",
    "Mutual non-solicit, 12 months, contact-based, advertising carved out (Section 7)",
    "Compelled disclosure with notice and time to seek protection (Section 5.2)",
  ],
  build() {
    const doc = new Doc("Mutual Non-Disclosure Agreement");
    doc.title("Mutual Non-Disclosure Agreement", "Northwind Studio LLC and Harbour Analytics Ltd");
    doc.para(
      "This Mutual Non-Disclosure Agreement is made on 2 April 2025 between Northwind Studio LLC " +
        "and Harbour Analytics Ltd (each a \"Party\"), in connection with discussions regarding a " +
        "potential commercial relationship (the \"Purpose\").",
    );

    doc.heading("1. Confidential Information");
    doc.clause("1.1", "Definition", "information disclosed by one Party to the other that is marked confidential, or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure.");
    doc.clause("1.2", "Exclusions", "Confidential Information does not include information that is or becomes public through no fault of the receiving Party; was rightfully known to the receiving Party before disclosure; is rightfully received from a third party without restriction; or is independently developed without use of the disclosing Party's Confidential Information.");

    doc.heading("2. Obligations");
    doc.clause("2.1", "Use", "Each Party shall use the other's Confidential Information solely for the Purpose.");
    doc.clause("2.2", "Care", "Each Party shall protect the other's Confidential Information using no less than reasonable care, and no less care than it applies to its own confidential information of like importance.");
    doc.clause("2.3", "Representatives", "A Party may disclose Confidential Information to its employees, officers and professional advisers who need to know it for the Purpose and who are bound by obligations no less protective than those in this Agreement. The disclosing Party remains responsible for their compliance.");

    doc.heading("4. Term");
    doc.clause("4.1", "Duration", "The obligations in this Agreement continue for three (3) years from the date of disclosure of the relevant Confidential Information, and, in respect of any information that constitutes a trade secret, for so long as it remains a trade secret under applicable law.");

    doc.heading("5. Permitted Disclosure");
    doc.clause("5.1", "Legal Requirement", "A Party may disclose Confidential Information to the extent required by law, regulation or court order.");
    doc.clause("5.2", "Notice", "Where legally permitted, the Party required to disclose shall give the other prompt written notice before disclosure and reasonable assistance, at the other's expense, so that the other may seek a protective order or other appropriate remedy.");

    doc.heading("6. Return and Destruction");
    doc.clause("6.1", "On Request", "Upon written request, each Party shall return or destroy the other's Confidential Information and, if asked, certify in writing that it has done so. Each Party may retain copies held in routine backup systems or required by law, which remain subject to this Agreement.");

    doc.heading("7. Non-Solicitation");
    doc.clause("7.1", "Mutual", "During the term and for twelve (12) months thereafter, neither Party shall knowingly solicit for employment any employee of the other with whom it had material contact in connection with the Purpose. General advertising not targeted at the other Party's employees, and unsolicited applications, do not breach this Section.");

    doc.heading("8. General");
    doc.clause("8.1", "No Licence", "Nothing in this Agreement grants any licence under any patent, copyright or other intellectual property right, and neither Party is obliged to enter into any further agreement.");
    doc.clause("8.2", "Injunctive Relief", "Each Party acknowledges that a breach of this Agreement may cause irreparable harm for which damages are an inadequate remedy, and that the other Party may seek injunctive relief in addition to any other remedy.");
    doc.clause("8.3", "Governing Law", "This Agreement is governed by the laws of the State of Delaware, and the parties submit to the exclusive jurisdiction of the courts located there.");

    doc.signature(["NORTHWIND STUDIO LLC", "HARBOUR ANALYTICS LTD"]);
    return doc.toBuffer();
  },
});

/* 3 ── NDA with a long tail and a broad residuals clause ────────────────── */
fixture({
  filename: "nda-broad-residuals.pdf",
  contractType: "nda",
  position: "disclosing-party",
  title: "Confidentiality Agreement (one-way)",
  contains: [
    "Seven-year confidentiality term (Section 3) — above the 5-year red-flag line",
    "One-way residuals clause favouring the recipient (Section 4.3)",
    "No destruction certification (Section 5)",
    "No notice requirement on compelled disclosure (Section 6)",
    "One-way agreement where both sides will in fact disclose",
  ],
  build() {
    const doc = new Doc("Confidentiality Agreement");
    doc.title("Confidentiality Agreement", "Northwind Studio LLC (Discloser) and Vantage Partners LP (Recipient)");
    doc.para(
      "This Confidentiality Agreement is entered into on 18 February 2025 between Northwind Studio " +
        "LLC (\"Discloser\") and Vantage Partners LP (\"Recipient\") in connection with Recipient's " +
        "evaluation of a potential investment.",
    );

    doc.heading("2. Obligations of Recipient");
    doc.clause("2.1", "Confidentiality", "Recipient shall keep the Confidential Information confidential and shall not disclose it other than to its affiliates, employees, agents, advisers, and any co-investors or financing sources it considers appropriate.");
    doc.clause("2.2", "No Flow-Down", "Recipient shall use reasonable efforts to inform recipients of the confidential nature of the information but shall not be liable for their acts or omissions.");

    doc.heading("3. Term");
    doc.clause("3.1", "Duration", "The obligations in this Agreement shall continue for seven (7) years from the date of this Agreement.");

    doc.heading("4. Use of Information");
    doc.clause("4.1", "Purpose", "Recipient shall use the Confidential Information solely to evaluate the potential investment.");
    doc.clause("4.3", "Residuals", "Notwithstanding anything to the contrary, Recipient shall be free to use for any purpose the residual knowledge retained in the unaided memory of its personnel resulting from access to the Confidential Information, including for the purpose of evaluating or making investments in competing businesses. Discloser has no equivalent right.");

    doc.heading("5. Return of Information");
    doc.clause("5.1", "On Request", "Upon written request, Recipient shall return or destroy the Confidential Information in its possession. No certification of destruction is required.");

    doc.heading("6. Compelled Disclosure");
    doc.clause("6.1", "Legal Process", "Recipient may disclose Confidential Information if required by law, regulation, or legal process.");

    doc.heading("7. General");
    doc.clause("7.1", "No Warranty", "The Confidential Information is provided \"as is\" and Discloser makes no representation or warranty as to its accuracy or completeness.");
    doc.clause("7.2", "Governing Law", "This Agreement is governed by the laws of the British Virgin Islands.");

    doc.signature(["NORTHWIND STUDIO LLC", "VANTAGE PARTNERS LP"]);
    return doc.toBuffer();
  },
});

/* 4 ── MSA with uncapped indemnity and asymmetric assignment ────────────── */
fixture({
  filename: "msa-uncapped-indemnity.pdf",
  contractType: "msa",
  position: "customer",
  title: "Master Services Agreement",
  contains: [
    "Uncapped customer indemnity (Section 9.1) carved out of the cap",
    "Cap carve-out for 'breach of this Agreement' which voids the cap (Section 8.3)",
    "Broken cross-reference: Section 5.2 cites Exhibit C, which does not exist",
    "'Confidential Information' used in Section 7 but never defined",
    "Audit rights at Customer's cost regardless of outcome (Section 11.2)",
  ],
  build() {
    const doc = new Doc("Master Services Agreement");
    doc.title("Master Services Agreement", "Meridian Consulting Group and Northwind Studio LLC");
    doc.para(
      "This Master Services Agreement is made as of 5 January 2025 between Meridian Consulting " +
        "Group (\"Supplier\") and Northwind Studio LLC (\"Customer\"). Services are ordered under " +
        "Statements of Work referencing this Agreement.",
    );

    doc.heading("5. Deliverables");
    doc.clause("5.1", "Acceptance", "Customer shall have ten (10) business days to review each Deliverable.");
    doc.clause("5.2", "Standards", "All Deliverables shall conform to the specifications set out in Exhibit C. Exhibit C is incorporated by reference and forms part of this Agreement.");

    doc.heading("7. Confidentiality");
    doc.clause("7.1", "Obligation", "Each party shall keep the other's Confidential Information confidential and shall not use it except as required to perform this Agreement.");

    doc.heading("8. Limitation of Liability");
    doc.clause("8.1", "Exclusion", "Neither party is liable for indirect or consequential loss.");
    doc.clause("8.2", "Cap", "Each party's aggregate liability under this Agreement shall not exceed the fees paid in the twelve (12) months preceding the claim.");
    doc.clause("8.3", "Exceptions", "The limitation in Section 8.2 shall not apply to: (a) a party's indemnification obligations; (b) breach of Section 7; or (c) any breach of this Agreement by Customer.");

    doc.heading("9. Indemnification");
    doc.clause("9.1", "By Customer", "Customer shall indemnify, defend and hold harmless Supplier and its affiliates, officers and agents from and against any and all claims, losses, liabilities and expenses arising out of or relating to this Agreement, the Deliverables, or Customer's business. Such indemnity is unlimited in amount and survives termination indefinitely.");
    doc.clause("9.2", "By Supplier", "Supplier shall indemnify Customer against third-party claims that a Deliverable infringes a United States patent, subject to the cap in Section 8.2.");

    doc.heading("11. Audit");
    doc.clause("11.1", "Right", "Supplier may audit Customer's use of the Deliverables upon reasonable notice, no more than twice per calendar year.");
    doc.clause("11.2", "Cost", "Customer shall bear all costs of any audit conducted under this Section, including Supplier's internal costs, regardless of the outcome.");

    doc.heading("14. Assignment");
    doc.clause("14.1", "Assignment", "Supplier may assign or novate this Agreement to any affiliate or successor without consent. Customer may not assign this Agreement without Supplier's prior written consent.");

    doc.heading("16. Governing Law");
    doc.clause("16.1", "Law and Venue", "This Agreement is governed by the laws of the State of New York.");

    doc.signature(["MERIDIAN CONSULTING GROUP", "NORTHWIND STUDIO LLC"]);
    return doc.toBuffer();
  },
});

/* 5 ── Employment with a non-compete void where it is governed ──────────── */
fixture({
  filename: "employment-california-noncompete.pdf",
  contractType: "employment",
  position: "employee",
  title: "Employment Agreement",
  contains: [
    "Three-year nationwide non-compete (Section 8.1) governed by California law — void under Cal. B&P Code 16600",
    "No-hire covering all employees regardless of contact (Section 8.2)",
    "IP assignment with no carve-out for prior inventions (Section 6.1)",
    "Bonus entirely discretionary despite being described as part of compensation (Section 3.2)",
    "Fee blank: base salary shown as $______ (Section 3.1)",
  ],
  build() {
    const doc = new Doc("Employment Agreement");
    doc.title("Employment Agreement", "Northwind Studio LLC and Priya Raman");
    doc.para(
      "This Employment Agreement is entered into as of 1 May 2025 between Northwind Studio LLC " +
        "(the \"Company\") and Priya Raman (the \"Employee\"), who will be based in San Francisco, " +
        "California.",
    );

    doc.heading("3. Compensation");
    doc.clause("3.1", "Base Salary", "The Company shall pay the Employee an annual base salary of $______, payable in accordance with the Company's standard payroll practices.");
    doc.clause("3.2", "Bonus", "The Employee may be eligible for an annual bonus of up to thirty percent (30%) of base salary. Any bonus is entirely at the discretion of the Company, is not earned until paid, and requires the Employee to be employed and not under notice on the payment date.");

    doc.heading("6. Intellectual Property");
    doc.clause("6.1", "Assignment", "The Employee hereby assigns to the Company all right, title and interest in and to all inventions, works of authorship, discoveries and improvements conceived or reduced to practice by the Employee, whether or not during working hours and whether or not related to the Company's business.");
    doc.clause("6.2", "Moral Rights", "The Employee waives all moral rights in such works to the fullest extent permitted by law.");

    doc.heading("8. Restrictive Covenants");
    doc.clause("8.1", "Non-Competition", "For a period of three (3) years following termination of employment for any reason, the Employee shall not, anywhere in the United States, directly or indirectly engage in, be employed by, or hold any interest in any business that competes with the Company.");
    doc.clause("8.2", "Non-Solicitation of Employees", "For a period of two (2) years following termination, the Employee shall not solicit, hire or engage any person employed by the Company at any time during the Employee's employment, whether or not the Employee had any contact with that person.");
    doc.clause("8.3", "Acknowledgement", "The Employee acknowledges that the restrictions in this Section 8 are reasonable and necessary to protect the Company's legitimate business interests.");

    doc.heading("11. Termination");
    doc.clause("11.1", "By the Company", "The Company may terminate this Agreement at any time with or without Cause, effective immediately upon notice.");
    doc.clause("11.2", "By the Employee", "The Employee shall give the Company not less than ninety (90) days' written notice of resignation.");

    doc.heading("13. Governing Law");
    doc.clause("13.1", "Law", "This Agreement is governed by the laws of the State of California.");

    doc.signature(["NORTHWIND STUDIO LLC", "PRIYA RAMAN"]);
    return doc.toBuffer();
  },
});

/* 6 ── Merchant agreement with a discretionary rolling reserve ──────────── */
fixture({
  filename: "merchant-rolling-reserve.pdf",
  contractType: "merchant",
  position: "customer",
  title: "Payment Processing Agreement",
  contains: [
    "Rolling reserve at processor's sole discretion, no release condition (Section 5.1)",
    "Immediate suspension and fund-holding on risk grounds (Section 6.2)",
    "Network rules incorporated by reference with no copy provided (Section 2.3)",
    "Auto-debit of any amount owed with no notice (Section 4.4)",
    "Unlimited chargeback liability including fraud (Section 7.1)",
    "180-day termination tail on reserves (Section 9.3)",
  ],
  build() {
    const doc = new Doc("Payment Processing Agreement");
    doc.title("Payment Processing Agreement", "Cardinal Payments LLC and Northwind Studio LLC");
    doc.para(
      "This Payment Processing Agreement is entered into on 20 January 2025 between Cardinal " +
        "Payments LLC (\"Processor\") and Northwind Studio LLC (\"Merchant\").",
    );

    doc.heading("2. The Services");
    doc.clause("2.1", "Processing", "Processor shall process card transactions submitted by Merchant in accordance with this Agreement.");
    doc.clause("2.3", "Network Rules", "Merchant shall comply with all applicable rules of the card networks, as amended from time to time. Such rules are incorporated into this Agreement by reference. Merchant is responsible for obtaining copies of the rules from the networks directly.");

    doc.heading("4. Settlement and Fees");
    doc.clause("4.1", "Settlement", "Processor shall settle funds to Merchant's designated account within two (2) business days of processing, subject to Sections 5 and 6.");
    doc.clause("4.4", "Debit Authority", "Merchant authorises Processor to debit Merchant's designated account for any amounts owed to Processor under this Agreement, including fees, chargebacks, fines and reserves, at any time and without prior notice to Merchant.");

    doc.heading("5. Reserve");
    doc.clause("5.1", "Establishment", "Processor may establish and maintain a reserve in such amount and for such duration as Processor determines in its sole discretion, funded by withholding a percentage of settlement amounts. Processor may increase the reserve at any time.");
    doc.clause("5.2", "Release", "Processor shall release the reserve at such time as it determines that the risk to Processor has sufficiently diminished.");

    doc.heading("6. Risk and Suspension");
    doc.clause("6.2", "Suspension", "Processor may, immediately and without notice, suspend processing, hold settlement funds, or terminate this Agreement if Processor believes in its sole discretion that Merchant presents an elevated risk.");

    doc.heading("7. Chargebacks");
    doc.clause("7.1", "Liability", "Merchant is liable for the full amount of all chargebacks, returns and associated fees, without limit, including those arising from fraudulent transactions, whether or not Merchant followed Processor's fraud-prevention recommendations.");

    doc.heading("9. Term and Termination");
    doc.clause("9.1", "Term", "This Agreement continues until terminated in accordance with this Section.");
    doc.clause("9.2", "By Merchant", "Merchant may terminate on ninety (90) days' written notice.");
    doc.clause("9.3", "Survival of Reserve", "Processor may retain any reserve for one hundred and eighty (180) days following termination, and Merchant's obligations in respect of chargebacks survive for the same period.");

    doc.heading("12. Governing Law");
    doc.clause("12.1", "Law", "This Agreement is governed by the laws of the State of Delaware. The parties waive trial by jury and agree that any dispute shall be resolved by binding individual arbitration. Class actions are waived.");

    doc.signature(["CARDINAL PAYMENTS LLC", "NORTHWIND STUDIO LLC"]);
    return doc.toBuffer();
  },
});

/* 7 ── M&A extract with an aggressive earnout and long survival ─────────── */
fixture({
  filename: "purchase-agreement-earnout.pdf",
  contractType: "ma",
  position: "seller",
  title: "Stock Purchase Agreement (extract)",
  contains: [
    "36-month general rep survival (Section 8.1) — above the 24-30 month marginal band",
    "25% escrow for 24 months (Section 2.4) — above the 20% red-flag line",
    "Earnout measured at Buyer's sole discretion with no operating covenants (Section 3.2)",
    "No acceleration of earnout on breach or on sale of the business",
    "Anti-sandbagging clause reducing seller protection (Section 8.5)",
    "Founder employment compensation counted against the purchase price (Section 3.4)",
  ],
  build() {
    const doc = new Doc("Stock Purchase Agreement");
    doc.title("Stock Purchase Agreement", "Extract — Articles II, III and VIII");
    doc.para(
      "This extract is taken from the Stock Purchase Agreement dated 11 March 2025 among Lattice " +
        "Holdings Inc. (\"Buyer\"), Northwind Studio LLC (the \"Company\") and the holders of the " +
        "Company's outstanding equity (the \"Sellers\").",
    );

    doc.heading("Article II — Purchase Price");
    doc.clause("2.1", "Consideration", "The aggregate consideration is $18,000,000, comprising $12,000,000 payable in cash at Closing and up to $6,000,000 payable as an Earnout under Section 3.2.");
    doc.clause("2.4", "Escrow", "At Closing, Buyer shall withhold twenty-five percent (25%) of the cash consideration and deposit it into escrow as security for the Sellers' indemnification obligations. The escrow shall be released twenty-four (24) months after Closing, less any amounts subject to pending claims.");

    doc.heading("Article III — Earnout");
    doc.clause("3.1", "Earnout Period", "the twenty-four (24) months following Closing.");
    doc.clause("3.2", "Measurement", "The Earnout shall be payable based on Adjusted Revenue for the Earnout Period, as determined by Buyer in its sole and absolute discretion. Buyer's determination shall be final and binding absent manifest error. Sellers shall have no right to audit or challenge the calculation.");
    doc.clause("3.3", "Operation of the Business", "Buyer shall have no obligation to operate the Business in any particular manner during the Earnout Period, and may reorganise, combine, discontinue or sell the Business in its discretion. No such action shall accelerate or increase any Earnout payment.");
    doc.clause("3.4", "Offset", "Any compensation paid to the Founders under their employment agreements during the Earnout Period shall be deducted from amounts otherwise payable as Earnout.");

    doc.heading("Article VIII — Survival and Indemnification");
    doc.clause("8.1", "Survival", "The representations and warranties of the Sellers shall survive Closing for thirty-six (36) months. The Fundamental Representations shall survive indefinitely.");
    doc.clause("8.2", "Cap", "The Sellers' aggregate indemnification liability shall not exceed thirty percent (30%) of the aggregate consideration.");
    doc.clause("8.3", "Basket", "No claim may be made until aggregate losses exceed $50,000, whereupon the Sellers shall be liable for the full amount of all losses from the first dollar.");
    doc.clause("8.5", "No Sandbagging", "Buyer shall have no right to indemnification in respect of any breach of which any Seller can demonstrate Buyer had knowledge prior to Closing. For the avoidance of doubt, information contained in any data room shall constitute knowledge.");

    doc.heading("Article X — Governing Law");
    doc.clause("10.1", "Law", "This Agreement is governed by the laws of the State of Delaware.");

    doc.signature(["LATTICE HOLDINGS INC.", "NORTHWIND STUDIO LLC", "THE SELLERS"]);
    return doc.toBuffer();
  },
});

/* 8 ── The incomplete draft, for the pre-signing alerts ─────────────────── */
fixture({
  filename: "draft-incomplete-services.pdf",
  contractType: "services",
  position: "customer",
  title: "Services Agreement (DRAFT)",
  contains: [
    "Fee stated as $______ (Section 4.1)",
    "Term stated as TBD (Section 3.1)",
    "Governing law left as [JURISDICTION] (Section 12.1)",
    "Exhibit B referenced (Section 2.2) but not attached",
    "Notice address left blank (Section 11.1)",
    "No signature block — the document is unexecuted",
    "Liability cap left as [__] months (Section 8.2)",
  ],
  build() {
    const doc = new Doc("Services Agreement DRAFT");
    doc.title("Services Agreement", "DRAFT — NOT FOR EXECUTION");
    doc.para(
      "This Services Agreement is made as of [DATE] between Northwind Studio LLC (\"Client\") and " +
        "[SUPPLIER NAME] (\"Supplier\").",
      { font: "Helvetica", size: 9.5 },
    );

    doc.heading("2. Services");
    doc.clause("2.1", "Scope", "Supplier shall provide the services described in each Statement of Work agreed between the parties.");
    doc.clause("2.2", "Service Levels", "Supplier shall meet the service levels set out in Exhibit B.");

    doc.heading("3. Term");
    doc.clause("3.1", "Initial Term", "This Agreement commences on the Effective Date and continues for TBD, unless terminated earlier in accordance with Section 9.");

    doc.heading("4. Fees");
    doc.clause("4.1", "Charges", "Client shall pay Supplier $______ per month, invoiced monthly in arrears.");
    doc.clause("4.2", "Payment Terms", "Invoices are payable within [__] days of receipt.");

    doc.heading("8. Limitation of Liability");
    doc.clause("8.1", "Exclusion", "Neither party shall be liable for indirect or consequential loss.");
    doc.clause("8.2", "Cap", "Each party's aggregate liability shall not exceed the fees paid in the [__] months preceding the claim.");

    doc.heading("9. Termination");
    doc.clause("9.1", "For Convenience", "Either party may terminate on [__] days' written notice.");
    doc.clause("9.2", "For Cause", "Either party may terminate for material breach not cured within thirty (30) days of written notice.");

    doc.heading("11. Notices");
    doc.clause("11.1", "Address", "Notices shall be sent to: Client: ____________________. Supplier: ____________________.");

    doc.heading("12. General");
    doc.clause("12.1", "Governing Law", "This Agreement is governed by the laws of [JURISDICTION].");
    doc.clause("12.2", "Entire Agreement", "This Agreement, together with its Exhibits, constitutes the entire agreement between the parties.");

    doc.signature([], { unsigned: true });
    return doc.toBuffer();
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Write and verify
 * ────────────────────────────────────────────────────────────────────────── */

function sha256(bytes) {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const manifest = [];
  for (const entry of FIXTURES) {
    const bytes = entry.build();

    // Every fixture is checked for the two things that would make it useless:
    // a header a reader will reject, and a page tree the review's own page
    // count cannot see. A corpus that silently produces unopenable files makes
    // the whole pipeline pass on nothing.
    const head = bytes.subarray(0, 5).toString("latin1");
    if (head !== "%PDF-") throw new Error(`${entry.filename}: not a PDF (starts ${head}).`);
    const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page(?![sA-Za-z])/g) ?? []).length;
    if (pages < 1) throw new Error(`${entry.filename}: no page objects.`);

    await writeFile(path.join(OUT, entry.filename), new Uint8Array(bytes));

    manifest.push({
      filename: entry.filename,
      title: entry.title,
      contractType: entry.contractType,
      position: entry.position,
      pages,
      bytes: bytes.length,
      sha256: sha256(bytes),
      contains: entry.contains,
    });

    console.log(
      `  ${entry.filename.padEnd(38)} ${String(pages).padStart(2)}p  ` +
        `${(bytes.length / 1024).toFixed(0).padStart(3)}KB  ${entry.contains.length} known issues`,
    );
  }

  await writeFile(
    path.join(HERE, "..", "fixtures", "manifest.json"),
    JSON.stringify({ contracts: manifest }, null, 2),
    "utf8",
  );

  console.log(`\n${manifest.length} contracts written to fixtures/contracts/`);
  console.log("The manifest records what each was built to contain — that is what makes it a test.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
