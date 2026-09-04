# DO-08 — Legal Contract Assistant

Reviews and drafts contracts. Flags risky and non-standard clauses against a
house playbook. Answers policy and compliance questions. Suggests fallback
language and redlines.

**A lawyer signs off every contract position.** That is the product, not a
disclaimer on it. Every finding this app produces starts `pending` and there is
exactly one path out — a named person, with a note, written to the audit trail.
Nothing here files, signs or sends anything.

---

## Two ways to use it

They are independent. Neither needs the other.

### 1. The skills, in Claude

Attach a contract and ask. The skill reads the PDF you attached and reviews it
there — no server, no key, no connector.

```bash
claude plugin marketplace add .
claude plugin install do-08-contract-review@ndi-legal
```

Then, in a fresh session:

```
Review this NDA — I'm the receiving party.
Draft a mutual NDA, three-year term, Delaware law.
What's our position on uncapped indemnities?
```

One skill ships in the plugin — `contract-review` — covering three things:

| Ask | What it does |
|---|---|
| "review this contract", "what are the risks" | Reads the attached document and reports risks with the clause reference and the quote |
| "draft an NDA", "give me replacement wording for this clause" | Drafts to the house playbook, or redlines someone else's paper |
| "what's our position on…", "does this comply with our standards" | Answers from the playbook, and says plainly when the playbook is silent |

It carries its own reference material — the CUAD-derived risk taxonomy, market
benchmarks, per-document-type checklists, jurisdiction notes, fallback language
and the house playbook. That is why it needs no configuration.

### 2. The console, at localhost:3000

One page. Upload a contract, read the review, click back through previous ones.
No navigation, because there is nowhere else to go.

Same review as the skills, through the Anthropic API, plus the two things a
conversation cannot keep: the contracts and reviews filed in a shared Drive
folder, and a sign-off recorded against a named person.

```bash
cp .env.example .env.local     # fill in ANTHROPIC_API_KEY and the GOOGLE_* values
npm install
npm run dev                    # then connect Drive once, see below
```

**The console stores nothing on this machine.** Contracts, reviews and the
register all live in the Drive folder, so the app cannot read or write anything
until Drive is connected — it says exactly that rather than showing an empty
workspace.

Use the skills when you are reading one contract and want an answer now — they
also do the drafting and the policy questions. Use the console when the answer
has to be kept: when a lawyer signs off each position, or when somebody will ask
in six months who accepted a clause.

---

## Setup

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) → API keys. Required. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` by default. `claude-opus-5` for deeper review — nothing else changes. |
| `REVIEWER_EMAIL` | Who the app acts as. Every audit row is attributed to it. |
| `LEGAL_EMAIL` | Counsel who signs off. Should not be the same person as the reviewer. |
| `ORG_NAME` | Appears on every review header. |
| `GOOGLE_*` | The Drive workspace. **Required** — it is the only storage. See below. |

Check it before you start:

```bash
npm run smoke
```

That makes a live model call rather than only checking that a key is set. Every
parameter this app sends is model-dependent, so "the key is present" tells you
almost nothing about whether a review will run.

---

## Google Drive

Every uploaded contract goes to `input/`, and every review to `output/` as both
Markdown and JSON:

```
<GOOGLE_DRIVE_FOLDER_ID>/
  input/     the contract PDFs, exactly as uploaded
  output/    <name>-review.md and .json, one pair per review
  state/     the register — contracts, reviews, standards, drafts, audit
```

Filing needs a one-time consent at <http://localhost:3000/api/drive/connect>.
The refresh token is written back to `.env.local`, so it is needed once.

### Why the full `drive` scope

The app asks for `https://www.googleapis.com/auth/drive`, not the narrower
`drive.file`. That is forced by the folder being configuration: `drive.file`
only ever reaches files the app itself created, so it cannot see a folder a
person made.

The failure mode is why this is called out rather than buried. Under
`drive.file`, a request for an unreachable folder does not come back forbidden —
a `GET` 404s, and, far worse, a **list of its children returns `200` with an
empty array**. "This folder holds no contracts" and "this token cannot see the
folder" are opposite facts, and Drive reports them identically. An app that
treated the second as the first would tell a lawyer their review queue was
clear.

So `probeFolder()` resolves the ambiguity explicitly before anything downstream
is allowed to believe an empty result.

**Until consent is granted the console does nothing**, and says so. There is no
local store to fall back on: that was a deliberate change, because two copies of
a register drift, and a lawyer opening the shared folder and a lawyer opening
this console have to be reading the same thing. The only way to guarantee that
is to have one copy.

The same principle governs the failure case. When the folder cannot be reached
the Overview shows the register as **unknown**, never as zero — "no contracts"
and "I cannot see the folder" are different claims, and only one of them means
the queue is clear.

---

## How a review works

Three model passes, in a fixed order, then a report rendered in code.

1. **Intake** — what the document is: type, parties, governing law, draft or
   executed, blank fields, missing exhibits, and whether it was legible at all.
   Cheap and factual, run without reasoning.
2. **Risk** — the substantive review, from a stated side of the table. Findings
   with the clause reference and a verbatim quote, the full red-flag scan, key
   terms against market benchmarks, missing provisions, internal consistency,
   and ranked redlines.
3. **Standards** — where the document departs from the house playbook. Skipped
   when the playbook is empty, because asking a model to compare against nothing
   returns invented deviations rather than none.

The Markdown report is then rendered **in code** from the structured findings,
never by a fourth model call. A model asked to write up a review it produced a
moment ago writes from its memory of the document rather than from the findings,
and the two drift — the JSON says three months and the prose says six, and the
prose is the half somebody reads.

### Why the position is asked before anything else

It inverts most of the review. A three-month liability cap is a serious problem
for a customer and a win for a vendor. A broad indemnity is exposure to the
party giving it and protection to the party receiving it.

The console makes it a required choice at upload with no default. When it has to
be inferred, the review records that in its limitations. A review run from the
wrong side is not slightly wrong — it is backwards, and it reads exactly as
confidently as a correct one.

---

## The test corpus

```bash
npm run sample      # one full-length agreement, at sample-contract.pdf
npm run fixtures    # eight short probes, at fixtures/contracts/
```

`npm run sample` writes **`sample-contract.pdf`** to the repository root: a
five-page Master Subscription Agreement of the kind that actually lands in a
legal inbox — recitals, a definitions article, sixteen numbered sections, an
exhibit and a signature block. It is built to contain 22 findable things, and
the script prints the list when it runs. Upload it as the **customer**.

Two of them are the ones that matter: Section 11.4 carves "any breach of this
Agreement by Customer" out of the liability cap, which quietly voids the cap
three clauses above it; and Section 9.4 grants a perpetual licence to train
models on Customer Data, surviving termination. A review that misses those has
missed the point of reading the document.

`npm run fixtures` writes eight shorter, openable contract PDFs to `fixtures/contracts/`, each built
to contain specific known problems that `fixtures/manifest.json` records. That
is what makes it a test corpus rather than eight documents: a review of
`saas-vendor-favourable.pdf` that does not flag the three-month cap is a
regression you can detect without reading the contract.

| Fixture | Built to contain |
|---|---|
| `saas-vendor-favourable.pdf` | 3-month cap, unilateral amendment, 90-day renewal window, no data export |
| `mutual-nda-balanced.pdf` | Mostly clean — so "reviewed and acceptable" has real content |
| `nda-broad-residuals.pdf` | 7-year term, one-way residuals, BVI governing law |
| `msa-uncapped-indemnity.pdf` | Uncapped indemnity, a carve-out that voids the cap, a broken cross-reference |
| `employment-california-noncompete.pdf` | 3-year nationwide non-compete under California law |
| `merchant-rolling-reserve.pdf` | Discretionary rolling reserve, immediate suspension, unlimited chargebacks |
| `purchase-agreement-earnout.pdf` | 36-month survival, 25% escrow, earnout at buyer's sole discretion |
| `draft-incomplete-services.pdf` | Blank fee, TBD term, missing Exhibit B, no signature block |

Measured on the first: 15 findings, all 7 planted issues caught, every finding
carrying a clause reference and a quote, 14 of 15 quotes exactly verbatim in the
source bytes.

---

## Layout

```
sample-contract.pdf   a full agreement to upload by hand and test with

src/app/page.tsx      the whole console — upload, review, previous
src/components/
  UploadContract.tsx  the uploader
  Review.tsx          the review, with the sign-off control

src/lib/
  types.ts        the domain model — everything else agrees on it
  anthropic.ts    the model layer, capability-aware per model family
  drive.ts        Google Drive over REST, with the scope note above
  store.ts        the register, on Drive and nowhere else
  contracts.ts    intake, the register, workspace status
  outputs.ts      the only writer to Drive input/ and output/
  schemas.ts      the Zod shapes the model may answer in
  review.ts       the three-pass pipeline and sign-off
  report.ts       the Markdown report, rendered deterministically
  standards.ts    the house playbook the review is judged against
  audit.ts        the append-only trail, written to Drive

src/app/api/      11 routes
plugins/          the Claude plugin and its skill
scripts/          fixtures, the sample contract, smoke test
```

---

## Limits

- **Not legal advice.** A first-pass review for a qualified lawyer to accept or
  reject. It signs nothing and sends nothing.
- **US-market bias.** The benchmarks are US commercial defaults for mid-market
  deals. Deal size, leverage and industry move all of them, and non-US
  jurisdictions differ substantially.
- **Page and size ceilings.** 100 pages and 20 MB per contract on Haiku 4.5;
  600 pages on the 1M-context models. Checked at upload so a long agreement
  fails with a sentence rather than as an API error after the fact.
- **Drive is a hard dependency.** Nothing is stored locally, so an unreachable
  folder means the console can do nothing at all. That is the cost of having one
  copy of the register rather than two that can disagree.
- **Single-process store.** The write queue in `store.ts` serialises
  read-modify-write within one running server. It cannot protect against a
  second process writing the same folder, and nothing in a
  folder-of-JSON-files design can — Drive offers nothing to build a lock from.
  A hosted deployment with concurrent instances can lose a row. Accepted, not
  solved, and stated here rather than discovered.
- **A round trip per read.** Every page load asks Drive. An eight-second read
  cache keeps one screen from asking the same question four times, but the app
  is slower than a local store would be. That is the trade.
- **The playbook exists in two copies.** `src/lib/standards.ts` seeds the one
  the console's reviews are judged against; the plugin's
  `references/playbook.md` is what the skills read. Change one, change the other.
- **Drafting and policy questions live in the skills, not the console.** The
  console does one thing: upload, review, look back.
- **Reviews are not re-run automatically.** A standard changed today does not
  retroactively flag a contract reviewed last month.
