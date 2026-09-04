<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DO-08 — conventions

## The one rule

**No code path sets a `SignOff` to anything but `pending`.** The only way a
position leaves `pending` is `signOff()` in `src/lib/review.ts`, which requires a
named person and a note and writes both to the audit trail. If you find yourself
adding a second path, you are removing the product.

The same holds in the plugin's skill: it proposes, it never approves, and it
never tells anybody a contract is fine to sign.

## Two surfaces, one set of rules

- **The console** (`src/`) — a Next.js app, one page: upload a contract, read
  the review, pick a previous one. No navigation, and deliberately no screens
  for drafting, policy questions, the playbook or the audit trail — those either
  live in the skills or are backend records. Adding a tab is a product decision,
  not a refactor.
- **The skill** (`plugins/do-08-contract-review/skills/contract-review/`) — one
  self-contained Agent Skill covering review, drafting and policy questions. It
  reads a PDF attached in Claude and works there, with no server, no key and no
  connector. Everything it needs is in its own reference files.

They are independent. Neither calls the other. The house playbook exists in both
(`src/lib/standards.ts` seeds and
`skills/contract-review/references/playbook.md`) and the two must be changed
together — that duplication is deliberate, because the skill has to work with
nothing running, but it is the one place this repo can drift.

## The model layer is capability-aware

`src/lib/anthropic.ts` resolves `MODEL_TRAITS` from the model id and assembles
request parameters from them. This is not defensive coding — the families reject
each other's parameters outright:

| | Haiku 4.5 and older | Opus 5 / the 4.6+ family |
|---|---|---|
| `output_config.effort` | 400 | required for effort control |
| `thinking: {type:"adaptive"}` | 400 | the only on-mode |
| `thinking: {budget_tokens}` | the only on-mode | 400 |
| `temperature` | accepted | 400 |
| PDF pages | 100 (200K context) | 600 |

Never call `anthropic.messages.*` directly from a feature module. Go through
`readDocument`, `readText` or `complete`, which already handle the split.
Switching `ANTHROPIC_MODEL` between Haiku and Opus must stay a one-line edit.

## Drive is the only store

`src/lib/store.ts` reads and writes `state/` on Drive. There is no `.data/`, no
local cache of the register, and no fallback. An earlier version mirrored a
local copy up and it was wrong: two copies drift, and the one a person is
looking at is then not necessarily the one the shared folder holds.

Consequences to hold on to:

- **The app does nothing until Drive is connected.** `readStore` throws rather
  than returning the fallback, so a caller can never mistake an outage for an
  empty register.
- **`/api/status` returns `workspace: null` when Drive is unreachable**, never a
  set of zeros, and the Overview renders that as a stated unknown.
- **A `DriveRef` is only ever built from an id a write returned.** `ingest`
  uploads before it writes the register row and fails the whole operation if the
  upload fails, so a row can never claim a file that is not there.
- The eight-second read cache in `store.ts` is a debounce, not a store. Any
  write from this process drops the entry immediately.

## Absence is never zero

The rule that shapes the error handling throughout. A review that failed, a
document that could not be read, a folder that was never synced and a list that
was truncated are four different states, and none of them is "nothing found".
`failed()` in `src/lib/http.ts` never degrades to an empty success, `useApi` in
`src/components/api.ts` returns error and empty as distinguishable states, and
every panel branches on all three.

## Style

Comments explain *why*, and especially why the obvious approach is wrong. A
file-level block comment on every module. British spelling in prose. Em dashes.
No emoji, no TODOs, no placeholder implementations.

## Checks

```bash
npx tsc --noEmit     # must be clean
npm run build        # must be clean
npm run smoke        # preflight: env, a live model call, Drive, fixtures
npm run fixtures     # rebuild the eight short test contracts
npm run sample       # rebuild sample-contract.pdf, the full agreement
```
