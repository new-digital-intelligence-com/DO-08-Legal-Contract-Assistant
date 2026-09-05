"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Empty, ErrorNote, Loading } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ReviewView } from "@/components/Review";
import { useApi, when } from "@/components/api";
import { POSITIONS } from "@/lib/types";
import type { Contract, Review } from "@/lib/types";

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

  const detail = useApi<{ contract: Contract; reviews: Review[] }>(
    id ? `/api/contracts/${id}` : undefined,
  );

  const contract = detail.data?.contract;
  const reviews = detail.data?.reviews ?? [];

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

      {contract && contract.status === "failed" && (
        <ErrorNote>
          <strong>The review of {contract.filename} failed.</strong> {contract.error}
          <p className="mt-2">
            This contract has not been reviewed. That is not the same as a review that found
            nothing.
          </p>
        </ErrorNote>
      )}

      {contract && !contract.latestReviewId && contract.status !== "failed" && (
        <Empty
          title="This contract has not been reviewed yet."
          hint="Uploading files the document; reviewing is a separate step."
        />
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
        </>
      )}
    </div>
  );
}
