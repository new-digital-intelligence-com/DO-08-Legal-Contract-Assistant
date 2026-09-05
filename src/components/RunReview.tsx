"use client";

import { useState } from "react";
import { Button, ErrorNote } from "./ui";
import { Icon } from "./icons";
import { POSITIONS } from "@/lib/types";
import type { Position, ReviewProgress, ReviewStep } from "@/lib/types";

/**
 * Running a review, and showing every stage of it as it happens.
 *
 * Shared by the uploader and the contract page, because a review has to be
 * startable from both. It was previously only reachable through an upload,
 * which meant a contract whose review was interrupted — the server restarted,
 * the tab was closed, the model rate-limited — became a dead end: the page said
 * "not reviewed yet" and offered nothing to do about it. The only way out was
 * to upload the same file again.
 */

export const REVIEW_STEPS: ReviewStep[] = [
  "fetching",
  "intake",
  "risk",
  "standards",
  "report",
  "filing",
];

function seconds(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

/**
 * Stream one review, calling `onEvent` for each stage.
 *
 * Resolves when the review finishes and rejects with the failure the server
 * reported. Reads Server-Sent Events by hand rather than with `EventSource`,
 * which cannot POST.
 */
export async function runReview(
  contractId: string,
  options: { position?: Position; onEvent: (event: ReviewProgress) => void },
): Promise<void> {
  const response = await fetch(`/api/contracts/${contractId}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options.position ? { position: options.position } : {}),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let message = `The review failed (${response.status}).`;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? message;
    } catch {
      /* not JSON — keep the status message */
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    // The last chunk may be a partial event; keep it for the next read.
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) continue;

      let event: ReviewProgress;
      try {
        event = JSON.parse(line.slice(6)) as ReviewProgress;
      } catch {
        continue;
      }

      if (event.step === "failed") failure = event.error ?? "The review failed.";
      options.onEvent(event);
    }
  }

  if (failure) throw new Error(failure);
}

/** One stage line: a tick when finished, a spinner while it is the current one. */
export function Stage({ event, running }: { event: ReviewProgress; running: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-[3px] shrink-0">
        {running ? (
          <span className="block size-3 animate-spin rounded-full border-[1.5px] border-ink-3 border-t-transparent" />
        ) : (
          <Icon name="check" className="size-3.5 text-ok-ink" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={running ? "text-ink" : "text-ink-2"}>{event.label}</span>
        {event.detail && <span className="block text-ink-3">{event.detail}</span>}
      </span>
      <span className="tnum shrink-0 text-[11px] text-ink-3">{seconds(event.elapsedMs)}</span>
    </li>
  );
}

/** Fold an event into a stage list, replacing a stage rather than repeating it. */
export function foldStep(steps: ReviewProgress[], event: ReviewProgress): ReviewProgress[] {
  if (event.step === "done" || event.step === "failed") return steps;
  const next = [...steps];
  const at = next.findIndex((step) => step.step === event.step);
  if (at === -1) next.push(event);
  else next[at] = event;
  return next;
}

/**
 * The button, plus the live stage list underneath it.
 *
 * `position` is passed through so a re-run can correct the side of the table
 * we are on — the one input that inverts the whole review.
 */
export function RunReview({
  contractId,
  position,
  label = "Review this contract",
  onDone,
}: {
  contractId: string;
  position?: Position;
  label?: string;
  onDone: () => void;
}) {
  const [steps, setSteps] = useState<ReviewProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [chosen, setChosen] = useState<Position | "">(position && position !== "unknown" ? position : "");

  async function go() {
    setBusy(true);
    setError(undefined);
    setSteps([]);
    try {
      await runReview(contractId, {
        position: chosen || undefined,
        onEvent: (event) => setSteps((current) => foldStep(current, event)),
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const last = steps[steps.length - 1];
  const running = busy && last && !last.detail ? last.step : undefined;
  const complete = steps.filter((step) => step.detail).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" busy={busy} onClick={go}>
          {busy ? `Reviewing — step ${Math.min(complete + 1, REVIEW_STEPS.length)} of ${REVIEW_STEPS.length}` : label}
        </Button>

        {!busy && (
          <select
            value={chosen}
            onChange={(event) => setChosen(event.target.value as Position)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-[12.5px] text-ink outline-none transition hover:border-border-strong focus:border-brand"
            title="Which party are we? This inverts most of the review."
          >
            <option value="">Position: as stored</option>
            {POSITIONS.filter((entry) => entry.id !== "unknown").map((entry) => (
              <option key={entry.id} value={entry.id}>
                as the {entry.label}
              </option>
            ))}
          </select>
        )}

        {busy && <span className="text-[12px] text-ink-3">This takes a minute or two.</span>}
      </div>

      {steps.length > 0 && (
        <ul className="ml-[7px] space-y-1 border-l border-border pl-3.5 text-[12.5px]">
          {steps.map((step) => (
            <Stage key={step.step} event={step} running={step.step === running} />
          ))}
        </ul>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
