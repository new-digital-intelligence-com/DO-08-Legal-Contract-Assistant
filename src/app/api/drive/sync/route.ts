import { syncAll } from "@/lib/outputs";
import { failed, ok } from "@/lib/http";
import { reviewer } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Push everything that is not on Drive yet.
 *
 * The recovery path from the two states that actually happen: the app was used
 * before anybody granted Drive access, and Drive was unreachable for a while
 * and people kept working. Nothing else in the app retries a filing, so without
 * this those contracts stay local forever.
 *
 * Partial success is a success and is reported as one. "Thirty-eight moved, one
 * did not, here is why" is the useful answer; a 500 on the first failure tells
 * the caller nothing about the other thirty-eight.
 */
export async function POST() {
  try {
    const result = await syncAll(reviewer());
    return ok(result, result.errors.length > 0 && result.inputs + result.outputs === 0 ? 207 : 200);
  } catch (error) {
    return failed(error, "The Drive sync could not be completed.");
  }
}
