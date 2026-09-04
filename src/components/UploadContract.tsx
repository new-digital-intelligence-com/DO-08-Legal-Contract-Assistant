"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, InfoNote, inputClass } from "./ui";
import { Icon } from "./icons";
import { request } from "./api";
import { CONTRACT_TYPES, POSITIONS } from "@/lib/types";
import type { ContractType, Position } from "@/lib/types";

/**
 * Upload, then review each file one at a time.
 *
 * Two decisions shape this component.
 *
 * **The position is asked before the upload, and it is required.** It is the
 * one input that inverts the whole review — a three-month liability cap is a
 * serious problem for a customer and a win for a vendor — so a default here
 * would silently produce backwards reviews that read exactly as confidently as
 * correct ones. There is no "unknown" option offered: if somebody genuinely
 * does not know, the right move is to find out, not to run the review twice.
 *
 * **The review is driven from the client, one file at a time.** The upload
 * route answers as soon as the bytes are safe, and this walks each returned id
 * through `/api/contracts/[id]/review` in sequence. Sequentially rather than in
 * parallel because each review is several model calls and firing five at once
 * is how a workspace hits a rate limit — and because a person watching wants to
 * see them land one by one rather than watch a spinner for four minutes.
 */

type Accepted = {
  id: string;
  filename: string;
  onDrive: boolean;
  duplicateOfId?: string;
  duplicateOfName?: string;
};

type Progress = {
  filename: string;
  state: "queued" | "reviewing" | "done" | "failed";
  detail?: string;
};

export function UploadContract({ onDone }: { onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState<Position | "">("");
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [counterparty, setCounterparty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<Progress[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((chosen: FileList | null) => {
    if (!chosen) return;
    setFiles(Array.from(chosen).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")));
    setError(undefined);
  }, []);

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
    setProgress(files.map((file) => ({ filename: file.name, state: "queued" })));

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

      setProgress((current) => [
        ...uploaded.contracts.map((contract) => ({
          filename: contract.filename,
          state: "queued" as const,
          detail: contract.duplicateOfName
            ? `Same content as ${contract.duplicateOfName}, already uploaded.`
            : contract.onDrive
              ? undefined
              : "Kept locally — not filed to Drive.",
        })),
        ...current.filter((entry) =>
          uploaded.rejected.some((rejected) => rejected.filename === entry.filename),
        ),
        ...uploaded.rejected.map((rejected) => ({
          filename: rejected.filename,
          state: "failed" as const,
          detail: rejected.reason,
        })),
      ]);

      // One at a time, in order. See the note at the top of this file.
      for (const contract of uploaded.contracts) {
        setProgress((current) =>
          current.map((entry) =>
            entry.filename === contract.filename && entry.state === "queued"
              ? { ...entry, state: "reviewing" }
              : entry,
          ),
        );
        try {
          await request(`/api/contracts/${contract.id}/review`, {
            method: "POST",
            body: JSON.stringify({ position }),
          });
          setProgress((current) =>
            current.map((entry) =>
              entry.filename === contract.filename && entry.state === "reviewing"
                ? { ...entry, state: "done" }
                : entry,
            ),
          );
        } catch (caught) {
          setProgress((current) =>
            current.map((entry) =>
              entry.filename === contract.filename && entry.state === "reviewing"
                ? {
                    ...entry,
                    state: "failed",
                    detail: caught instanceof Error ? caught.message : String(caught),
                  }
                : entry,
            ),
          );
        }
        // Refresh after each one so the list fills in as they land rather than
        // all at once at the end.
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

          <Field label="Counterparty" hint={files.length > 1 ? "Applied only to single uploads." : "Optional."}>
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

        {progress.length > 0 && (
          <ul className="space-y-1.5 border-t border-border pt-3 text-[12.5px]">
            {progress.map((entry, index) => (
              <li key={`${entry.filename}-${index}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {entry.state === "done" && <Icon name="check" className="size-3.5 text-ok-ink" />}
                  {entry.state === "failed" && (
                    <Icon name="alert" className="size-3.5 text-crit-ink" />
                  )}
                  {entry.state === "reviewing" && (
                    <span className="block size-3 animate-spin rounded-full border-[1.5px] border-ink-3 border-t-transparent" />
                  )}
                  {entry.state === "queued" && (
                    <span className="block size-3 rounded-full border border-border" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{entry.filename}</span>
                  <span className="text-ink-3">
                    {entry.state === "queued" && " · waiting"}
                    {entry.state === "reviewing" && " · reviewing, this takes a minute"}
                    {entry.state === "done" && " · reviewed"}
                  </span>
                  {entry.detail && (
                    <span
                      className={`block ${entry.state === "failed" ? "text-crit-ink" : "text-ink-3"}`}
                    >
                      {entry.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <InfoNote>
          Every finding comes back awaiting sign-off by a lawyer. Nothing here is legal advice, and
          nothing is signed or sent.
        </InfoNote>
      </div>
    </Card>
  );
}
