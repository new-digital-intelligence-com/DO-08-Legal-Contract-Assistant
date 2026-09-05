"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Empty, ErrorNote, Loading, Note } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ReviewView } from "@/components/Review";
import { RunReview } from "@/components/RunReview";
import { useApi, when } from "@/components/api";
import { POSITIONS } from "@/lib/types";
import type { Contract, Review } from "@/lib/types";

type FileState =
  | { state: "present"; name: string }
  | { state: "trashed"; name: string }
  | { state: "missing"; reason: string };

/**
 * One contract in full.
 *
 * A real route rather than a panel swap on the home page, for one reason that
 * matters more than it looks: a review is the thing people send each other.
 * "Look at the Helix cap" needs a URL that survives being pasted into a message
 * and opened by somebody who was not there when it was uploaded.
 */
export default function ContractPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const detail = useApi<{ contract: Contract; reviews: Review[]; input?: FileState }>(
    id ? `/api/contracts/${id}` : undefined,
  );

  const contract = detail.data?.contract;
  const reviews = detail.data?.reviews ?? [];
  const input = detail.data?.input;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
      <header className="mb-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 transition hover:text-ink"
        >
          <Icon name="arrow" className="size-3.5 rotate-180" />
          All contracts
        </Link>

        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={26} height={26} className="logo" priority />
          <div className="min-w-0">
            <h1 className="truncate text-[19px] font-semibold">
              {contract ? contract.title || contract.filename : "Contract"}
            </h1>
            {contract && (
              <p className="text-[12.5px] text-ink-3">
                {contract.filename} · we are the{" "}
                {POSITIONS.find((entry) => entry.id === contract.position)?.label ??
                  contract.position}{" "}
                · uploaded {when(contract.uploadedAt)}
                {reviews.length > 1 && ` · ${reviews.length} reviews`}
              </p>
            )}
          </div>
        </div>
      </header>

      {detail.loading && !detail.data && <Loading rows={6} label="Reading the contract…" />}

      {detail.error && <ErrorNote>The contract could not be read: {detail.error}</ErrorNote>}

      {/*
        * The register points at a Drive file, and that file can be trashed,
        * renamed or moved from the Drive UI without this app being told. Said
        * plainly here rather than left as a mystery: the console showing a
        * document that is not in the folder is exactly the kind of discrepancy
        * that makes somebody distrust the whole register.
        */}
      {input?.state === "trashed" && (
        <Note>
          <strong>This contract&rsquo;s file is in Drive&rsquo;s trash.</strong>
          <p className="mt-2">
            It is still readable here and the review below is unaffected, but it will not appear in
            the workspace folder&rsquo;s <code>input/</code> and it will be deleted for good when
            Drive empties the trash. Nothing in this app moved it — restore it from Drive&rsquo;s
            trash to put it back.
          </p>
        </Note>
      )}

      {input?.state === "missing" && (
        <ErrorNote>
          <strong>This contract&rsquo;s file is no longer on Drive.</strong> {input.reason}
          <p className="mt-2">
            The register still has the row, so the review below — if there is one — is what was
            found when the document could still be read. It cannot be re-reviewed until the file is
            uploaded again.
          </p>
        </ErrorNote>
      )}

      {contract && contract.status === "failed" && (
        <div className="mb-4 space-y-3">
          <ErrorNote>
            <strong>The last review of {contract.filename} failed.</strong> {contract.error}
            <p className="mt-2">
              This contract has not been reviewed. That is not the same as a review that found
              nothing.
            </p>
          </ErrorNote>
          <RunReview
            contractId={contract.id}
            position={contract.position}
            label="Try the review again"
            onDone={detail.reload}
          />
        </div>
      )}

      {/*
        * A contract left in `reviewing` with nothing to show for it.
        *
        * This happens for real: the server restarted, the tab was closed, or
        * the model call was cut off mid-run. Nothing resets the flag, so the
        * row sits there forever. It used to render as "not reviewed yet" with
        * no explanation and no way out — the only escape was to upload the
        * same file again. Say what actually happened, and offer the button.
        */}
      {contract && !contract.latestReviewId && contract.status === "reviewing" && (
        <div className="mb-4 space-y-3">
          <Note>
            <strong>A review was started but never finished.</strong>
            <p className="mt-2">
              The run was interrupted — most often the server restarting, or the browser tab being
              closed while it was working. Nothing was saved, so this contract has not been
              reviewed. Start it again below.
            </p>
          </Note>
          <RunReview
            contractId={contract.id}
            position={contract.position}
            label="Run the review"
            onDone={detail.reload}
          />
        </div>
      )}

      {contract && !contract.latestReviewId && contract.status === "uploaded" && (
        <div className="mb-4 space-y-3">
          <Empty
            title="This contract has not been reviewed yet."
            hint="The file is filed on Drive. Reviewing is a separate step and takes a minute or two."
          />
          <RunReview
            contractId={contract.id}
            position={contract.position}
            label="Run the review"
            onDone={detail.reload}
          />
        </div>
      )}

      {contract?.latestReviewId && (
        <>
          {/* Every run is kept rather than replacing the last, so a review run
              from a corrected position shows up as two that disagree rather
              than as one that quietly changed. */}
          {reviews.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <Badge tone="neutral" label={`${reviews.length} reviews of this contract`} />
              <span>Showing the most recent, from {when(reviews[0]?.createdAt)}.</span>
            </div>
          )}

          <ReviewView reviewId={contract.latestReviewId} onChanged={detail.reload} />

          {/* Re-running is a normal act, not an error path: the position is
              routinely got wrong on the first pass, and every run is kept so a
              correction shows as two reviews that disagree. */}
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-2 text-[13px] font-semibold">Review it again</p>
            <p className="mb-3 text-[12.5px] text-ink-3">
              Useful if the side of the table was wrong. The previous review is kept.
            </p>
            <RunReview
              contractId={contract.id}
              position={contract.position}
              label="Run a new review"
              onDone={detail.reload}
            />
          </div>
        </>
      )}
    </div>
  );
}
