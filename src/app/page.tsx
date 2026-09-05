"use client";

import Image from "next/image";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, ErrorNote, Loading, Note } from "@/components/ui";
import { Icon } from "@/components/icons";
import { UploadContract } from "@/components/UploadContract";
import { ReviewCard } from "@/components/ReviewCard";
import { useApi } from "@/components/api";
import type { Contract, Review, WorkspaceStatus } from "@/lib/types";

/**
 * Upload a contract, see the last one at a glance, click through for the rest.
 *
 * No navigation, because there is nowhere else to go — the only other screen is
 * one contract's review, and that is reached by clicking the contract.
 *
 * The reviews are fetched whole rather than through a summary endpoint. At this
 * volume that is the right trade: one request instead of two, and the cards can
 * show the actual finding titles rather than counts alone. If a workspace ever
 * holds hundreds of contracts this becomes the thing to fix.
 */

type StatusPayload = {
  workspace: WorkspaceStatus | null;
  /** Present exactly when `workspace` is null, saying why. */
  unreachable?: string;
  config: { org: string; model: { configured: boolean } };
};

export default function Console() {
  const router = useRouter();
  const status = useApi<StatusPayload>("/api/status");

  const connected = Boolean(status.data?.workspace);
  const contracts = useApi<{ contracts: Contract[] }>(connected ? "/api/contracts" : undefined);
  const reviews = useApi<{ reviews: Review[] }>(connected ? "/api/reviews?limit=40" : undefined);

  const refresh = useCallback(() => {
    status.reload();
    contracts.reload();
    reviews.reload();
  }, [status, contracts, reviews]);

  const list = contracts.data?.contracts ?? [];
  const byId = new Map((reviews.data?.reviews ?? []).map((review) => [review.id, review]));
  const reviewFor = (contract: Contract) =>
    contract.latestReviewId ? byId.get(contract.latestReviewId) : undefined;

  const [latest, ...previous] = list;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
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

      {connected && (
        <div className="space-y-8">
          {!status.data?.config.model.configured && (
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
              // Straight to the finished review — the person who just waited
              // three minutes for it should not have to go and find it.
              onReviewed={(contractId) => router.push(`/contract/${contractId}`)}
            />
          </section>

          {/* ── The last one through ───────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Latest review</h2>

            {contracts.loading && !contracts.data ? (
              <Loading rows={3} />
            ) : contracts.error ? (
              <ErrorNote>{contracts.error}</ErrorNote>
            ) : !latest ? (
              <Empty
                title="Nothing uploaded yet."
                hint="Drop a PDF above. The review takes a minute or two and appears here."
              />
            ) : (
              <ReviewCard contract={latest} review={reviewFor(latest)} featured />
            )}
          </section>

          {/* ── Everything before it ───────────────────────────────────── */}
          {previous.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">
                Previous contracts ({previous.length})
              </h2>
              <div className="space-y-2">
                {previous.map((contract) => (
                  <ReviewCard
                    key={contract.id}
                    contract={contract}
                    review={reviewFor(contract)}
                  />
                ))}
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
