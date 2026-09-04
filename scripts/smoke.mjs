/**
 * Preflight: does this workspace actually work?
 *
 * Four checks, in the order they can fail. Each one either passes or says what
 * to do about it, and a failure that is not fatal to the whole app is reported
 * as a warning rather than an exit — an unconnected Drive is a real state this
 * app is built to run in, not a broken install.
 *
 * The model check is deliberately a live call. Every parameter this app sends
 * is model-dependent — Haiku rejects `effort` and adaptive thinking, Opus
 * rejects `temperature` — so "the key is set" tells you almost nothing. One
 * cheap request tells you whether the shape in src/lib/anthropic.ts matches the
 * model in .env.local, which is the thing that actually breaks.
 *
 * Run with: npm run smoke
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let failed = 0;
let warned = 0;

const pass = (label, detail = "") => console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
const warn = (label, detail) => {
  warned += 1;
  console.log(`  warn  ${label} — ${detail}`);
};
const fail = (label, detail) => {
  failed += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
};

/* ── 1. Environment ──────────────────────────────────────────────────────── */

console.log("\nEnvironment");

let env = {};
try {
  env = Object.fromEntries(
    (await readFile(path.join(ROOT, ".env.local"), "utf8"))
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
  pass(".env.local", `${Object.keys(env).length} settings`);
} catch {
  fail(".env.local", "not found. Copy .env.example to .env.local and fill it in.");
}

if (env.ANTHROPIC_API_KEY) pass("ANTHROPIC_API_KEY", "set");
else fail("ANTHROPIC_API_KEY", "not set — nothing can be reviewed without it.");

const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
pass("ANTHROPIC_MODEL", model);

if (env.REVIEWER_EMAIL) pass("REVIEWER_EMAIL", env.REVIEWER_EMAIL);
else warn("REVIEWER_EMAIL", "not set. Audit rows will be attributed to 'Not set'.");

if (env.LEGAL_EMAIL) pass("LEGAL_EMAIL", env.LEGAL_EMAIL);
else warn("LEGAL_EMAIL", "not set. Nothing breaks; the console cannot name who signs off.");

/* ── 2. The model, live ──────────────────────────────────────────────────── */

console.log("\nModel");

if (env.ANTHROPIC_API_KEY) {
  // The same family split src/lib/anthropic.ts makes. Kept in sync by hand
  // because this script must run without importing server-only code.
  const legacy = /haiku-4-5|haiku-3|sonnet-4-5|sonnet-3|opus-4-5|opus-3/.test(model);
  const body = {
    model,
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
    ...(legacy ? { temperature: 0 } : { thinking: { type: "adaptive" }, output_config: { effort: "low" } }),
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (response.ok) {
      pass(
        "live call",
        `${legacy ? "legacy shape (temperature)" : "modern shape (adaptive + effort)"} accepted`,
      );
    } else {
      fail("live call", `${payload?.error?.message ?? response.status}`);
    }
  } catch (error) {
    fail("live call", error instanceof Error ? error.message : String(error));
  }
} else {
  warn("live call", "skipped, no API key.");
}

/* ── 3. Google Drive ─────────────────────────────────────────────────────── */

console.log("\nGoogle Drive");

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_DRIVE_FOLDER_ID) {
  warn("configuration", "incomplete. Contracts are reviewed and kept locally only.");
} else if (!env.GOOGLE_REFRESH_TOKEN) {
  warn("consent", "not granted. Visit /api/drive/connect once. Reviews stay local until then.");
} else {
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const token = await tokenResponse.json();

    if (!token.access_token) {
      fail("token", token.error_description ?? token.error ?? "refresh failed");
    } else {
      pass("token", "refreshed");

      // The scope is the thing that actually decides whether this works. A
      // `drive.file` grant cannot see a folder it did not create, and reports
      // that by listing it as empty with a 200 rather than by failing.
      if (token.scope && !/auth\/drive(\s|$)/.test(token.scope)) {
        warn(
          "scope",
          `granted "${token.scope}". Only the full drive scope can reach a pre-existing folder — ` +
            `re-consent at /api/drive/connect.`,
        );
      }

      const folder = await fetch(
        `https://www.googleapis.com/drive/v3/files/${env.GOOGLE_DRIVE_FOLDER_ID}` +
          `?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`,
        { headers: { authorization: `Bearer ${token.access_token}` } },
      );
      const meta = await folder.json();

      if (!folder.ok) {
        fail(
          "workspace folder",
          `${meta?.error?.message ?? folder.status}. The folder id may be wrong, or this token ` +
            `cannot see it.`,
        );
      } else if (meta.capabilities && meta.capabilities.canAddChildren === false) {
        fail("workspace folder", `"${meta.name}" is readable but not writable by this account.`);
      } else {
        pass("workspace folder", `"${meta.name}" reachable and writable`);
      }
    }
  } catch (error) {
    fail("drive", error instanceof Error ? error.message : String(error));
  }
}

/* ── 4. The fixture corpus ───────────────────────────────────────────────── */

console.log("\nFixtures");

try {
  const manifest = JSON.parse(
    await readFile(path.join(ROOT, "fixtures", "manifest.json"), "utf8"),
  );
  const issues = manifest.contracts.reduce((sum, entry) => sum + entry.contains.length, 0);
  pass("corpus", `${manifest.contracts.length} contracts, ${issues} known issues planted`);
} catch {
  warn("corpus", "not generated. Run `npm run fixtures` to build the test contracts.");
}

/* ── Verdict ─────────────────────────────────────────────────────────────── */

console.log(
  `\n${failed} failure${failed === 1 ? "" : "s"}, ${warned} warning${warned === 1 ? "" : "s"}.` +
    (failed === 0
      ? " The workspace can review contracts.\n"
      : " Fix the failures above before reviewing anything.\n"),
);

process.exit(failed > 0 ? 1 : 0);
