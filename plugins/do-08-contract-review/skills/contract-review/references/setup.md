# Installing the plugin, and how it relates to the console

There are two ways to use DO-08, and they are independent. Neither needs the
other.

## 1. The skills, in Claude

Attach a contract to the conversation and ask for it to be reviewed. The skill
reads the PDF you attached and does the review itself — there is no server to
run, no key to configure, and nothing to upload anywhere.

```
Review this NDA — I'm the receiving party.
Draft a mutual NDA, three-year term, Delaware law.
What's our position on uncapped indemnities?
```

### Installing

From the repository root:

```bash
claude plugin marketplace add .
claude plugin install do-08-contract-review@ndi-legal
```

Or clone the skills straight into your skills directory:

```bash
cp -r plugins/do-08-contract-review/skills/* ~/.claude/skills/
```

Restart the session afterwards — skills are bound when a session starts.

### What you get

One skill, `contract-review`, covering three things:

| Ask | What it does |
|---|---|
| "review this contract", "what are the risks" | Reads the attached document and reports risks with the clause reference and the quote |
| "draft an NDA", "give me replacement wording for this clause" | Drafts to the house playbook, or redlines someone else's paper |
| "what's our position on…", "does this comply with our standards" | Answers from the playbook, and says plainly when the playbook is silent |

It carries its own reference material — the risk taxonomy, the market
benchmarks, the per-document-type checklists, the jurisdiction notes, the
fallback language and the house playbook. That is why it works with no
configuration: everything it needs to judge a contract is in the plugin.

## 2. The console, at localhost:3000

The Next.js app does the same review through the Anthropic API, and adds the
things a conversation cannot keep: a register of every contract, a sign-off
queue, an audit trail, an editable playbook, and filing to a shared Google Drive
folder.

```bash
cp .env.example .env.local     # then fill in ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>, choose which party you are, and drop a PDF in.
Every uploaded contract lands in the Drive folder's `input/`, and every review
lands in `output/` as both Markdown and JSON.

### Google Drive

Filing needs a one-time consent at <http://localhost:3000/api/drive/connect>.

It asks for the full `drive` scope rather than the narrower `drive.file`, and
the reason is worth knowing: `drive.file` only ever reaches files the app itself
created, so it cannot see a folder a person made — and it fails silently,
listing that folder's contents as an empty array with a `200`. An unreachable
folder and an empty one would be indistinguishable.

Until that consent is granted the app still works. Contracts are stored and
reviewed locally, and the console says plainly that nothing has reached Drive
rather than showing a tick over an empty folder. **Push local files to Drive**
on the Overview screen sends the backlog up once access is granted.

## Which to use

Use the skills when you are reading one contract and want an answer now.

Use the console when the answer has to be kept — when a lawyer has to sign off
on each position, when somebody will ask in six months who accepted a clause, or
when the contracts and reviews need to live in a folder the rest of the team can
open.

## Keeping the playbook in step

The two hold separate copies of the house positions, and they have different
jobs. The console's copy is editable at runtime and is what its reviews are
judged against. The plugin's copy at
`skills/contract-review/references/playbook.md` is what the skills read.

Change a position in the console, and update that file too, or the two surfaces
will quietly answer the same question differently.
