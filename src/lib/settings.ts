import "server-only";
import { driveEnv, driveStatus } from "./drive";
import { MODEL, MODEL_TRAITS, modelConfigured } from "./anthropic";

/**
 * Configuration, read from the environment and reported honestly.
 *
 * Every getter here has a "not set" answer rather than a plausible default.
 * `REVIEWER_EMAIL` unset does not become "user@example.com" — it becomes a
 * visible gap, because the reviewer's address is what every audit row is
 * attributed to, and a trail attributed to a placeholder is a trail that proves
 * nothing about who did what.
 */

export const UNSET = "Not set";

export function orgName(): string {
  return process.env.ORG_NAME?.trim() || "This organisation";
}

/** Who the app acts as. Attributed on every upload, review and sign-off. */
export function reviewer(): string {
  return process.env.REVIEWER_EMAIL?.trim() || UNSET;
}

export function reviewerConfigured(): boolean {
  return reviewer() !== UNSET;
}

/**
 * Counsel who signs off.
 *
 * Deliberately a separate person from the reviewer. The product's one hard
 * promise is that a qualified human takes every contract position, and a
 * workspace where the same address prepares and approves is one that cannot
 * keep it. The app does not refuse to run in that state — it says so.
 */
export function legal(): string {
  return process.env.LEGAL_EMAIL?.trim() || UNSET;
}

export function legalConfigured(): boolean {
  return legal() !== UNSET;
}

/** True when preparer and approver are the same address, which defeats sign-off. */
export function signOffIsSelfReview(): boolean {
  return reviewerConfigured() && legalConfigured() && reviewer() === legal();
}

/* ────────────────────────────────────────────────────────────────────────────
 * The disclaimer
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The sentence that goes on every review, every draft and every answer.
 *
 * It is a constant rather than a per-call prompt instruction because a
 * disclaimer the model is asked to add is a disclaimer the model can forget,
 * and the one artefact that must never leave this app without it is the one
 * that a person is about to act on.
 */
export const DISCLAIMER =
  "This is a first-pass review by an AI assistant, not legal advice. Every position here " +
  "is a proposal awaiting sign-off by qualified counsel. Material terms must be reviewed " +
  "by a lawyer before this agreement is signed, amended or sent to a counterparty.";

/* ────────────────────────────────────────────────────────────────────────────
 * Status
 * ────────────────────────────────────────────────────────────────────────── */

export function configStatus() {
  const drive = driveStatus();
  return {
    org: orgName(),
    reviewer: reviewer(),
    reviewerConfigured: reviewerConfigured(),
    legal: legal(),
    legalConfigured: legalConfigured(),
    selfReview: signOffIsSelfReview(),
    model: {
      name: MODEL,
      configured: modelConfigured(),
      maxPages: MODEL_TRAITS.maxPages,
      adaptive: MODEL_TRAITS.adaptive,
    },
    drive: { ...drive, folderId: driveEnv().folderId },
  };
}
