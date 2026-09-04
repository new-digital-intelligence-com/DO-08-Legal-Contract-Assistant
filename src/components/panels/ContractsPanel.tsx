"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorNote,
  Loading,
  Mono,
  Section,
  Table,
  Td,
  Toolbar,
  Tr,
} from "../ui";
import { Icon } from "../icons";
import { UploadContract } from "../UploadContract";
import { ReviewPanel } from "./ReviewPanel";
import { request, useAction, useApi, when } from "../api";
import { CONTRACT_TYPES, POSITIONS } from "@/lib/types";
import type { Contract, ContractStatus, Severity } from "@/lib/types";

/**
 * The register, the uploader, and the selected contract's review.
 *
 * Selecting a contract swaps the whole panel rather than opening a drawer. A
 * review is long — findings, quotes, redlines, a sign-off control on each — and
 * a drawer over the list makes it a scrolling column inside a scrolling page.
 */

const STATUS_TONE: Record<ContractStatus, "ok" | "warn" | "crit" | "neutral"> = {
  reviewed: "ok",
  reviewing: "warn",
  uploaded: "neutral",
  failed: "crit",
};

function label(list: { id: string; label: string }[], id: string | undefined) {
  if (!id) return "—";
  return list.find((entry) => entry.id === id)?.label ?? id;
}

export function ContractsPanel({
  selected,
  onSelect,
  onChanged,
}: {
  selected?: string;
  onSelect: (contractId?: string) => void;
  onChanged: () => void;
}) {
  const list = useApi<{ contracts: Contract[] }>("/api/contracts");
  const [confirmRemove, setConfirmRemove] = useState<Contract>();

  const detail = useApi<{ contract: Contract; reviews: { id: string; riskLevel: Severity }[] }>(
    selected ? `/api/contracts/${selected}` : undefined,
  );

  const rerun = useAction(async (contractId: string) => {
    await request(`/api/contracts/${contractId}/review`, { method: "POST", body: JSON.stringify({}) });
    list.reload();
    detail.reload();
    onChanged();
  });

  const remove = useAction(async (contractId: string, note: string) => {
    await request(`/api/contracts/${contractId}`, {
      method: "DELETE",
      body: JSON.stringify({ note }),
    });
    setConfirmRemove(undefined);
    onSelect(undefined);
    list.reload();
    onChanged();
  });

  /* ── One contract ──────────────────────────────────────────────────────── */
  if (selected) {
    if (detail.loading && !detail.data) return <Loading rows={5} label="Reading the contract…" />;
    if (detail.error) {
      return (
        <div className="space-y-3">
          <Button size="sm" onClick={() => onSelect(undefined)}>
            <Icon name="arrow" className="size-3.5 rotate-180" />
            Back to the register
          </Button>
          <ErrorNote>{detail.error}</ErrorNote>
        </div>
      );
    }
    if (!detail.data) return null;

    const { contract } = detail.data;
    const latestReviewId = contract.latestReviewId;

    return (
      <div className="space-y-5">
        <Toolbar>
          <Button size="sm" onClick={() => onSelect(undefined)}>
            <Icon name="arrow" className="size-3.5 rotate-180" />
            Back to the register
          </Button>
          <Button
            size="sm"
            busy={rerun.busy}
            onClick={() => rerun.go(contract.id)}
            title="Runs the review again and keeps both, so a changed position shows as two reviews that disagree."
          >
            <Icon name="refresh" className="size-3.5" />
            {contract.reviewCount > 0 ? "Review again" : "Review now"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmRemove(contract)}>
            Remove
          </Button>
        </Toolbar>

        {rerun.error && <ErrorNote>{rerun.error}</ErrorNote>}

        {contract.status === "failed" && (
          <ErrorNote>
            <strong>The last review of this contract failed.</strong> {contract.error}
            <p className="mt-2">
              This contract has not been reviewed. That is not the same as a review that found
              nothing.
            </p>
          </ErrorNote>
        )}

        {!latestReviewId ? (
          <Empty
            title="This contract has not been reviewed yet."
            hint="Uploading stores and files the document; reviewing is a separate step that takes a minute or two."
            action={
              <Button variant="primary" busy={rerun.busy} onClick={() => rerun.go(contract.id)}>
                Review it now
              </Button>
            }
          />
        ) : (
          <ReviewPanel
            reviewId={latestReviewId}
            onSigned={() => {
              detail.reload();
              list.reload();
              onChanged();
            }}
          />
        )}

        <Confirm
          open={Boolean(confirmRemove)}
          title={`Remove ${confirmRemove?.filename ?? ""}?`}
          consequence="The contract, its reviews and the files in Drive's input/ and output/ folders go. The Drive files are moved to trash, where they remain recoverable."
          confirmLabel="Remove"
          variant="danger"
          requireNote
          notePlaceholder="Why this is being removed. It goes on the audit trail."
          busy={remove.busy}
          onConfirm={(note) => confirmRemove && remove.go(confirmRemove.id, note)}
          onCancel={() => setConfirmRemove(undefined)}
        />
      </div>
    );
  }

  /* ── The register ──────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <Section title="Add a contract" description="It is stored, filed to Drive, then reviewed.">
        <UploadContract
          onDone={() => {
            list.reload();
            onChanged();
          }}
        />
      </Section>

      <Section title="The register">
        {list.loading && !list.data ? (
          <Loading rows={4} />
        ) : list.error ? (
          <ErrorNote>
            The register could not be read: {list.error}
            <div className="mt-3">
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            </div>
          </ErrorNote>
        ) : !list.data || list.data.contracts.length === 0 ? (
          <Empty
            title="No contracts yet."
            hint="Upload one above and the review lands within a couple of minutes."
          />
        ) : (
          <Table
            head={[
              { label: "Contract" },
              { label: "Type", width: "10rem" },
              { label: "Our position", width: "9rem" },
              { label: "Status", width: "8rem" },
              { label: "Drive", width: "7rem" },
              { label: "Uploaded", width: "11rem" },
            ]}
          >
            {list.data.contracts.map((contract) => (
              <Tr key={contract.id} onClick={() => onSelect(contract.id)}>
                <Td>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{contract.title || contract.filename}</div>
                    <div className="truncate text-[11.5px] text-ink-3">
                      {contract.title ? contract.filename : <Mono>{contract.id}</Mono>}
                      {contract.counterparty ? ` · ${contract.counterparty}` : ""}
                      {contract.pages ? ` · ${contract.pages} pages` : ""}
                    </div>
                  </div>
                </Td>
                <Td>{label(CONTRACT_TYPES, contract.contractType)}</Td>
                <Td>{label(POSITIONS, contract.position)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[contract.status]} label={contract.status} dot />
                </Td>
                <Td>
                  {contract.input ? (
                    <span className="text-[12px] text-ok-ink">Filed</span>
                  ) : (
                    // Never rendered as a tick. A contract that is only on this
                    // machine has to look different from one that is safe.
                    <span className="text-[12px] text-warn-ink">Local only</span>
                  )}
                </Td>
                <Td>{when(contract.uploadedAt)}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
