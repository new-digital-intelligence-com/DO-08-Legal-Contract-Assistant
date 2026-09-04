"use client";

import { Badge, Button, Card, ErrorNote, InfoNote, Loading, Note, OkNote, Section, Stat, StatGrid } from "../ui";
import { Icon } from "../icons";
import { useAction, useApi, when, request } from "../api";
import type { Severity, WorkspaceStatus } from "@/lib/types";

/**
 * The screen that answers the standing requirement: whoever opens the console
 * can always see the last contract that went through and what came back.
 *
 * It leads with that rather than with counts. A dashboard of totals tells
 * somebody the workspace is busy; the last contract and its risk level tells
 * them whether they have something to do, which is the question they actually
 * opened the page with.
 */

type StatusPayload = {
  workspace: WorkspaceStatus;
  config: {
    org: string;
    reviewer: string;
    reviewerConfigured: boolean;
    legal: string;
    legalConfigured: boolean;
    selfReview: boolean;
    model: { name: string; configured: boolean; maxPages: number; adaptive: boolean };
    drive: { state: string; detail: string; folderId: string };
  };
  mirror: {
    enabled: boolean;
    lastOk?: { name: string; at: string };
    lastError?: { name: string; at: string; message: string };
  };
};

const RISK_TONE: Record<Severity, "crit" | "warn" | "ok"> = {
  critical: "crit",
  important: "warn",
  acceptable: "ok",
};

const RISK_LABEL: Record<Severity, string> = {
  critical: "Critical risk",
  important: "Needs attention",
  acceptable: "No material risk",
};

export function OverviewPanel({ onOpen }: { onOpen: (section: string, contractId?: string) => void }) {
  const { data, loading, error, reload } = useApi<StatusPayload>("/api/status");

  const sync = useAction(async () => {
    await request("/api/drive/sync", { method: "POST" });
    reload();
  });

  if (loading && !data) return <Loading rows={4} label="Reading the workspace…" />;
  if (error) {
    return (
      <ErrorNote>
        The workspace could not be read: {error}
        <div className="mt-3">
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      </ErrorNote>
    );
  }
  if (!data) return null;

  const { workspace, config, mirror } = data;
  const latest = workspace.latest;

  return (
    <div className="space-y-6">
      {/* ── Blocking configuration, before anything else ─────────────────── */}
      {!config.model.configured && (
        <ErrorNote>
          <strong>ANTHROPIC_API_KEY is not set.</strong> Contracts can be uploaded but nothing can
          be reviewed. Add it to <code>.env.local</code> and restart.
        </ErrorNote>
      )}
      {config.selfReview && (
        <Note>
          <strong>The same address is configured as reviewer and as counsel</strong> ({config.legal}
          ). Sign-off still works, but nobody independent is taking these positions.
        </Note>
      )}

      {/* ── The last contract through ────────────────────────────────────── */}
      <Section
        title="Last contract through"
        description="What went in most recently, and what came back"
      >
        {!latest ? (
          <Card>
            <div className="px-4 py-8 text-center">
              <p className="text-[14px] font-medium">Nothing has been uploaded yet.</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-3">
                Upload a contract and the review lands here.
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="primary" size="sm" onClick={() => onOpen("contracts")}>
                  <Icon name="upload" className="size-3.5" />
                  Add a contract
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">
                    {latest.title || latest.filename}
                  </span>
                  {latest.riskLevel ? (
                    <Badge
                      tone={RISK_TONE[latest.riskLevel]}
                      label={RISK_LABEL[latest.riskLevel]}
                      dot
                    />
                  ) : (
                    <Badge tone="neutral" label="Not reviewed yet" dot />
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {latest.title ? `${latest.filename} · ` : ""}
                  uploaded {when(latest.at)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => onOpen("contracts", latest.contractId)}>
                  Open review
                  <Icon name="chevron" className="size-3.5" />
                </Button>
              </div>
            </div>

            {!latest.reviewId && (
              <div className="border-t border-border px-4 py-3 text-[12.5px] text-ink-2">
                This contract has been uploaded but not reviewed. That is not the same as a review
                that found nothing.
              </div>
            )}
          </Card>
        )}
      </Section>

      {/* ── Counts ───────────────────────────────────────────────────────── */}
      <Section title="Where things stand">
        <StatGrid>
          <Stat label="Contracts" value={workspace.contracts} />
          <Stat label="Reviewed" value={workspace.reviewed} />
          <Stat
            label="Awaiting review"
            value={workspace.awaitingReview}
            tone={workspace.awaitingReview > 0 ? "warn" : undefined}
          />
          <Stat
            label="Failed"
            value={workspace.failed}
            tone={workspace.failed > 0 ? "crit" : undefined}
          />
          <Stat
            label="Critical findings"
            value={workspace.criticalFindings}
            tone={workspace.criticalFindings > 0 ? "crit" : undefined}
          />
          <Stat
            label="Awaiting sign-off"
            value={workspace.awaitingSignOff}
            tone={workspace.awaitingSignOff > 0 ? "warn" : undefined}
          />
          <Stat label="House standards" value={workspace.standards} />
        </StatGrid>

        {workspace.awaitingSignOff > 0 && (
          <div className="mt-3">
            <Button size="sm" variant="primary" onClick={() => onOpen("signoff")}>
              Review {workspace.awaitingSignOff} pending position
              {workspace.awaitingSignOff === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </Section>

      {/* ── Drive ────────────────────────────────────────────────────────── */}
      <Section title="Google Drive" description="Where contracts and reviews are filed">
        {workspace.drive.state === "ready" ? (
          <OkNote>
            Filing into folder <code>{workspace.drive.folderId}</code>. Contracts go to{" "}
            <code>input/</code>, reviews to <code>output/</code>.
            {mirror.lastError && (
              <div className="mt-2">
                The last mirror of <code>{mirror.lastError.name}</code> failed:{" "}
                {mirror.lastError.message}
              </div>
            )}
          </OkNote>
        ) : (
          <Note>
            <strong>Nothing is reaching Drive.</strong> {workspace.drive.detail}
            <p className="mt-2">
              Contracts are still being stored and reviewed — they are kept on this machine only.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {workspace.drive.state === "needs-consent" && (
                // A plain anchor, not a Button: this is a full-page navigation
                // out to Google's consent screen, and a fetch-driven button
                // cannot follow an OAuth redirect.
                <a
                  href="/api/drive/connect"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg bg-solid px-2.5 text-[12.5px] font-medium text-solid-ink transition hover:bg-solid-hover"
                >
                  Grant Drive access
                </a>
              )}
              <Button size="sm" busy={sync.busy} onClick={() => sync.go()}>
                <Icon name="refresh" className="size-3.5" />
                Push local files to Drive
              </Button>
            </div>
            {sync.error && <div className="mt-2 text-[12.5px] text-crit-ink">{sync.error}</div>}
          </Note>
        )}
      </Section>

      {/* ── Configuration ────────────────────────────────────────────────── */}
      <Section title="This workspace">
        <Card>
          <dl className="divide-y divide-border text-[13px]">
            {[
              ["Organisation", config.org],
              ["Acting as", config.reviewerConfigured ? config.reviewer : "Not set"],
              ["Counsel", config.legalConfigured ? config.legal : "Not set"],
              [
                "Model",
                `${config.model.name} · up to ${config.model.maxPages} pages per contract`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 px-4 py-2.5">
                <dt className="w-40 shrink-0 text-ink-3">{label}</dt>
                <dd className="min-w-0 flex-1">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </Section>

      <InfoNote>
        Every position this app produces is a proposal awaiting sign-off by qualified counsel. It
        signs nothing and sends nothing.
      </InfoNote>
    </div>
  );
}
