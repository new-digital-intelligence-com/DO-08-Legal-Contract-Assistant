"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Note } from "@/components/ui";
import { Icon } from "@/components/icons";
import { UploadContract } from "@/components/UploadContract";
import { ReviewView } from "@/components/Review";
import { useApi, when } from "@/components/api";
import type { Contract, ContractStatus, WorkspaceStatus } from "@/lib/types";

/**
 * The whole console: upload a contract, read the review, pick a previous one.
 *
 * There is no navigation because there is nowhere else to go. Everything this
 * app does for a person happens on this page, and a rail with one destination
 * on it is furniture.
 *
 * The selected contract lives in the hash, so a review can be linked to and
 * survives a reload — somebody told to "look at the Helix cap" lands on it.
 */

type StatusPayload = {
  workspace: WorkspaceStatus | null;
  /** Present exactly when `workspace` is null, saying why. */
  unreachable?: string;
  config: { org: string; model: { configured: boolean } };
};

const STATUS_TONE: Record<ContractStatus, "ok" | "warn" | "crit" | "neutral"> = {
  reviewed: "ok",
  reviewing: "warn",
  uploaded: "neutral",
  failed: "crit",
};

export default function Console() {
  const status = useApi<StatusPayload>("/api/status");
  const contracts = useApi<{ contracts: Contract[] }>(
    status.data?.workspace ? "/api/contracts" : undefined,
  );

  const [selected, setSelected] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : window.location.hash.slice(1) || undefined,
  );

  const select = useCallback((id?: string) => {
    setSelected(id);
    window.location.hash = id ?? "";
  }, []);

  const refresh = useCallback(() => {
    status.reload();
    contracts.reload();
  }, [status, contracts]);

  const list = contracts.data?.contracts ?? [];
  const current = list.find((entry) => entry.id === selected) ?? list[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
      <header className="mb-6 flex items-center gap-3">
        <Image src="/logo.png" alt="" width={30} height={30} className="logo" priority />
        <div>
          <h1 className="text-[19px] font-semibold">
            DO-08 <span className="text-ink-3">—</span> Legal Contract Assistant
          </h1>
          <p className="text-[12.5px] text-ink-3">
            Upload an agreement and read what it costs you. A lawyer signs off every position.
          </p>
        </div>
      </header>

      {status.loading && !status.data && <Loading rows={3} label="Starting up…" />}

      {status.error && (
        <ErrorNote>
          The workspace could not be read: {status.error}
          <div className="mt-3">
            <Button size="sm" onClick={status.reload}>
              Try again
            </Button>
          </div>
        </ErrorNote>
      )}

      {/* Drive is the whole storage layer, so nothing works without it. */}
      {status.data && !status.data.workspace && (
        <Note>
          <strong>Google Drive is not connected, so there is nothing to show.</strong>
          <p className="mt-2">{status.data.unreachable}</p>
          <p className="mt-2">
            Every contract and every review lives in the shared Drive folder — nothing is kept on
            this machine. Putting zeros here would say your queue is clear when nobody has looked.
          </p>
          <div className="mt-3">
            <a
              href="/api/drive/connect"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-solid px-3.5 text-[13px] font-medium text-solid-ink transition hover:bg-solid-hover"
            >
              <Icon name="drive" className="size-4" />
              Connect Google Drive
            </a>
          </div>
        </Note>
      )}

      {status.data?.workspace && (
        <div className="space-y-8">
          {!status.data.config.model.configured && (
            <ErrorNote>
              <strong>The Anthropic API key is not set.</strong> Contracts can be uploaded but
              nothing can be reviewed. Add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code>{" "}
              and restart.
            </ErrorNote>
          )}

          {/* ── Upload ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Upload a contract</h2>
            <UploadContract
              onDone={refresh}
              onReviewed={(contractId) => {
                refresh();
                select(contractId);
              }}
            />
          </section>

          {/* ── The result ─────────────────────────────────────────────── */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">
                {current && selected && selected !== list[0]?.id ? "Review" : "Latest review"}
              </h2>
              {current && (
                <span className="text-[12.5px] text-ink-3">
                  {current.title || current.filename} · uploaded {when(current.uploadedAt)}
                </span>
              )}
            </div>

            {contracts.loading && !contracts.data ? (
              <Loading rows={4} />
            ) : contracts.error ? (
              <ErrorNote>{contracts.error}</ErrorNote>
            ) : !current ? (
              <Empty
                title="Nothing uploaded yet."
                hint="Drop a PDF above. The review takes a minute or two and appears here."
              />
            ) : current.status === "failed" ? (
              <ErrorNote>
                <strong>The review of {current.filename} failed.</strong> {current.error}
                <p className="mt-2">
                  This contract has not been reviewed. That is not the same as a review that found
                  nothing.
                </p>
              </ErrorNote>
            ) : !current.latestReviewId ? (
              <Empty
                title={`${current.filename} has not been reviewed yet.`}
                hint="Uploading files the document; reviewing is a separate step."
              />
            ) : (
              <ReviewView reviewId={current.latestReviewId} onChanged={refresh} />
            )}
          </section>

          {/* ── Previous ───────────────────────────────────────────────── */}
          {list.length > 1 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Previous contracts</h2>
              <div className="space-y-2">
                {list.map((entry) => {
                  const isCurrent = entry.id === current?.id;
                  return (
                    <Card key={entry.id} padded={false}>
                      <button
                        type="button"
                        onClick={() => select(entry.id)}
                        className={`flex w-full items-center justify-between gap-3 p-3 text-left transition ${
                          isCurrent ? "bg-sunken" : "hover:bg-sunken"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">
                            {entry.title || entry.filename}
                          </div>
                          <div className="truncate text-[11.5px] text-ink-3">
                            {entry.counterparty ? `${entry.counterparty} · ` : ""}
                            we are the {entry.position} · {when(entry.uploadedAt)}
                          </div>
                        </div>
                        <Badge tone={STATUS_TONE[entry.status]} label={entry.status} dot />
                      </button>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          <p className="border-t border-border pt-4 text-[12px] text-ink-3">
            Every position here is a proposal awaiting sign-off by qualified counsel. This is not
            legal advice, and nothing is signed or sent. Contracts and reviews are filed in the
            shared Drive folder.
          </p>
        </div>
      )}
    </div>
  );
}
