"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, InfoNote, inputClass } from "./ui";
import { Icon } from "./icons";
import { request } from "./api";
import { CONTRACT_TYPES, POSITIONS } from "@/lib/types";
import type { ContractType, Position, ReviewProgress, ReviewStep } from "@/lib/types";

/**
 * Upload, then review each file one at a time, showing every stage as it lands.
 *
 * Three decisions shape this component.
 *
 * **The position is asked before the upload, and it is required.** It is the
 * one input that inverts the whole review — a three-month liability cap is a
 * serious problem for a customer and a win for a vendor — so a default here
 * would silently produce backwards reviews that read exactly as confidently as
 * correct ones. There is no "unknown" option offered: if somebody genuinely
 * does not know, the right move is to find out, not to run the review twice.
 *
 * **Each stage is reported as it completes.** The review route streams
 * Server-Sent Events and this reads them into a checklist. A review takes
 * minutes, and a spinner held for minutes is indistinguishable from a hang —
 * people re-click, re-upload, or abandon a request that was working. The stage
 * *details* matter more than the ticks: seeing "Mutual NDA · Acme Corp ·
 * Delaware law" thirty seconds in tells somebody the app is reading the right
 * document, and lets them stop a review that has already gone wrong instead of
 * waiting four minutes to find out.
 *
 * **Files are reviewed sequentially.** Each review is several model calls, and
 * firing five at once is how a workspace hits a rate limit.
 */

type Accepted = {
  id: string;
  filename: string;
  duplicateOfId?: string;
  duplicateOfName?: string;
};

type FileState = {
  filename: string;
  state: "queued" | "uploading" | "reviewing" | "done" | "failed";
  detail?: string;
  /** The stages reported so far, in the order they started. */
  steps: ReviewProgress[];
};

const STEP_COUNT: ReviewStep[] = ["fetching", "intake", "risk", "standards", "report", "filing"];

function seconds(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

/** One stage line: a tick when finished, a spinner while it is the current one. */
function Stage({ event, running }: { event: ReviewProgress; running: boolean }) {
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

export function UploadContract({
  onDone,
  onReviewed,
}: {
  onDone: () => void;
  /** Called with each contract id as its review lands, so the page can show it. */
  onReviewed?: (contractId: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState<Position | "">("");
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [counterparty, setCounterparty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<FileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((chosen: FileList | null) => {
    if (!chosen) return;
    setFiles(
      Array.from(chosen).filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      ),
    );
    setError(undefined);
  }, []);

  const patch = useCallback((filename: string, change: (entry: FileState) => FileState) => {
    setProgress((current) =>
      current.map((entry) => (entry.filename === filename ? change(entry) : entry)),
    );
  }, []);

  /**
   * Read the review stream, folding each event into that file's stage list.
   *
   * A repeated step replaces its earlier entry rather than appending, so
   * "Reviewing as the customer" becomes "Reviewing as the customer — 8 critical,
   * 3 important" in place instead of listing the stage twice.
   */
  async function streamReview(contract: Accepted, chosenPosition: Position) {
    const response = await fetch(`/api/contracts/${contract.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ position: chosenPosition }),
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

        if (event.step === "failed") {
          failure = event.error ?? "The review failed.";
          continue;
        }
        if (event.step === "done") {
          patch(contract.filename, (entry) => ({ ...entry, state: "done", detail: event.detail }));
          onReviewed?.(contract.id);
          continue;
        }

        patch(contract.filename, (entry) => {
          const steps = [...entry.steps];
          const at = steps.findIndex((step) => step.step === event.step);
          if (at === -1) steps.push(event);
          else steps[at] = event;
          return { ...entry, steps };
        });
      }
    }

    if (failure) throw new Error(failure);
  }

  async function submit() {
    if (files.length === 0) {
      setError("Choose at least one PDF.");
      return;
    }
    if (!position) {
      setError(
        "Say which party you are before uploading. It inverts most of the review — the same " +
          "clause is a problem for one side and a win for the other.",
      );
      return;
    }

    setBusy(true);
    setError(undefined);
    setProgress(files.map((file) => ({ filename: file.name, state: "uploading", steps: [] })));

    try {
      const form = new FormData();
      for (const file of files) form.append("file", file);
      form.append("position", position);
      if (contractType) form.append("contractType", contractType);
      if (counterparty.trim()) form.append("counterparty", counterparty.trim());

      const uploaded = await request<{
        contracts: Accepted[];
        rejected: { filename: string; reason: string }[];
      }>("/api/contracts", { method: "POST", body: form });

      setProgress([
        ...uploaded.contracts.map((contract) => ({
          filename: contract.filename,
          state: "queued" as const,
          detail: contract.duplicateOfName
            ? `Same content as ${contract.duplicateOfName}, already uploaded.`
            : undefined,
          steps: [],
        })),
        ...uploaded.rejected.map((rejected) => ({
          filename: rejected.filename,
          state: "failed" as const,
          detail: rejected.reason,
          steps: [],
        })),
      ]);
      onDone();

      // One at a time, in order. See the note at the top of this file.
      for (const contract of uploaded.contracts) {
        patch(contract.filename, (entry) => ({ ...entry, state: "reviewing" }));
        try {
          await streamReview(contract, position);
        } catch (caught) {
          patch(contract.filename, (entry) => ({
            ...entry,
            state: "failed",
            detail: caught instanceof Error ? caught.message : String(caught),
          }));
        }
        onDone();
      }

      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
      onDone();
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border border-dashed px-6 py-8 text-center transition ${
            dragging ? "border-brand bg-brand-soft" : "border-border hover:border-border-strong"
          }`}
        >
          <Icon name="upload" className="mx-auto size-5 text-ink-3" />
          <p className="mt-2 text-[13px] font-medium">
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? "" : "s"} ready`
              : "Drop contracts here, or choose files"}
          </p>
          <p className="mt-1 text-[12px] text-ink-3">PDF only.</p>
          {files.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[12px] text-ink-2">
              {files.map((file) => (
                <li key={file.name}>
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => pick(event.target.files)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Which party are we?"
            required
            hint="This inverts most of the review. Do not guess."
          >
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value as Position)}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {POSITIONS.filter((entry) => entry.id !== "unknown").map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type" hint="Optional — inferred if left blank.">
            <select
              value={contractType}
              onChange={(event) => setContractType(event.target.value as ContractType)}
              className={inputClass}
            >
              <option value="">Infer from the document</option>
              {CONTRACT_TYPES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Counterparty"
            hint={files.length > 1 ? "Applied only to single uploads." : "Optional."}
          >
            <input
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              placeholder="Acme Software Inc."
              className={inputClass}
              disabled={files.length > 1}
            />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex items-center gap-2">
          <Button variant="primary" busy={busy} onClick={submit} disabled={files.length === 0}>
            Upload and review
          </Button>
          {files.length > 0 && !busy && (
            <Button variant="ghost" onClick={() => setFiles([])}>
              Clear
            </Button>
          )}
        </div>

        {/* ── What is happening right now ─────────────────────────────────── */}
        {progress.length > 0 && (
          <div className="space-y-3 border-t border-border pt-3">
            {progress.map((entry) => {
              const finished = entry.state === "done" || entry.state === "failed";
              const last = entry.steps[entry.steps.length - 1];
              // A stage with no detail yet is the one currently running.
              const running = !finished && last && !last.detail ? last.step : undefined;
              const complete = entry.steps.filter((step) => step.detail).length;

              return (
                <div key={entry.filename} className="text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.state === "done" && <Icon name="check" className="size-3.5 text-ok-ink" />}
                    {entry.state === "failed" && (
                      <Icon name="alert" className="size-3.5 text-crit-ink" />
                    )}
                    {!finished && (
                      <span className="block size-3 animate-spin rounded-full border-[1.5px] border-ink-3 border-t-transparent" />
                    )}
                    <span className="font-medium">{entry.filename}</span>
                    <span className="text-ink-3">
                      {entry.state === "uploading" && "uploading to Drive"}
                      {entry.state === "queued" && "waiting to review"}
                      {entry.state === "reviewing" &&
                        `reviewing — step ${Math.min(complete + 1, STEP_COUNT.length)} of ${STEP_COUNT.length}`}
                      {entry.state === "done" && "reviewed"}
                      {entry.state === "failed" && "failed"}
                    </span>
                  </div>

                  {entry.steps.length > 0 && (
                    <ul className="mt-1.5 ml-[7px] space-y-1 border-l border-border pl-3.5">
                      {entry.steps.map((step) => (
                        <Stage key={step.step} event={step} running={step.step === running} />
                      ))}
                    </ul>
                  )}

                  {entry.detail && (
                    <p
                      className={`mt-1 ml-[18px] ${
                        entry.state === "failed" ? "text-crit-ink" : "text-ink-3"
                      }`}
                    >
                      {entry.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <InfoNote>
          Every finding comes back awaiting sign-off by a lawyer. Nothing here is legal advice, and
          nothing is signed or sent.
        </InfoNote>
      </div>
    </Card>
  );
}
