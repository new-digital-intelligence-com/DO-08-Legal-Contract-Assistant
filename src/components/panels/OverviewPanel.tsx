"use client";

import { Badge, Button, Card, ErrorNote, InfoNote, Loading, Note, OkNote, Section, Stat, StatGrid } from "../ui";
import { Icon } from "../icons";
import { useApi, when } from "../api";
import type { Severity, WorkspaceStatus } from "@/lib/types";

/**
 * The screen that answers the standing requirement: whoever opens the console
 * can always see the last contract that went through and what came back.
 *
 * It leads with that rather than with counts. A dashboard of totals tells
 * somebody the workspace is busy; the last contract and its risk level tells
 * them whether they have something to do, which is the question they actually
 * opened the page with.
 *
 * `workspace` is null when Drive cannot be reached, and this panel renders that
 * as a stated unknown rather than as an empty workspace. The app keeps nothing
 * locally, so an unreachable folder means the register cannot be read at all —
 * and a screen of zeros would tell a lawyer their queue was clear when nobody
 * had looked.
 */

type StatusPayload = {
  workspace: WorkspaceStatus | null;
  /** Present exactly when `workspace` is null, saying why. */
  unreachable?: string;
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

/** The consent link is a full-page navigation, so it is an anchor, not a Button. */
function ConnectDrive() {
  return (
    <a
      href="/api/drive/connect"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-solid px-3.5 text-[13px] font-medium text-solid-ink transition hover:bg-solid-hover"
    >
      <Icon name="drive" className="size-4" />
      Connect Google Drive
    </a>
  );
}

function Configuration({
  config,
  showFolder = false,
}: {
  config: StatusPayload["config"];
  showFolder?: boolean;
}) {
  const rows: [string, string][] = [
    ["Organisation", config.org],
    ["Acting as", config.reviewerConfigured ? config.reviewer : "Not set"],
    ["Counsel", config.legalConfigured ? config.legal : "Not set"],
    ["Model", `${config.model.name} · up to ${config.model.maxPages} pages per contract`],
  ];
  if (showFolder) rows.push(["Drive folder", config.drive.folderId || "Not set"]);

  return (
    <Card>
      <dl className="divide-y divide-border text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-40 shrink-0 text-ink-3">{label}</dt>
            <dd className="min-w-0 flex-1">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function OverviewPanel({ onOpen }: { onOpen: (section: string, contractId?: string) => void }) {
  const { data, loading, error, reload } = useApi<StatusPayload>("/api/status");

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

  const { workspace, config, unreachable } = data;

  /* ── Drive is the whole storage layer, so this comes before everything ─── */
  if (!workspace) {
    return (
      <div className="space-y-5">
        <Note>
          <strong>The workspace folder cannot be reached, so the register cannot be read.</strong>
          <p className="mt-2">{unreachable ?? config.drive.detail}</p>
          <p className="mt-2">
            This app stores nothing on this machine — every contract and every review lives in the
            shared Drive folder. Until it is connected there is nothing to show, and putting zeros
            here would say your queue is clear when nobody has looked.
          </p>
          <div className="mt-3">
            <ConnectDrive />
          </div>
        </Note>

        {!config.model.configured && (
          <ErrorNote>
            <strong>ANTHROPIC_API_KEY is not set either.</strong> Add it to <code>.env.local</code>{" "}
            and restart, or nothing can be reviewed once Drive is connected.
          </ErrorNote>
        )}

        <Section title="This workspace">
          <Configuration config={config} showFolder />
        </Section>
      </div>
    );
  }

  const latest = workspace.latest;

  return (
    <div className="space-y-6">
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
                    <Badge tone={RISK_TONE[latest.riskLevel]} label={RISK_LABEL[latest.riskLevel]} dot />
                  ) : (
                    <Badge tone="neutral" label="Not reviewed yet" dot />
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {latest.title ? `${latest.filename} · ` : ""}
                  uploaded {when(latest.at)}
                </p>
              </div>

              <Button size="sm" onClick={() => onOpen("contracts", latest.contractId)}>
                Open review
                <Icon name="chevron" className="size-3.5" />
              </Button>
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
          <Stat label="Failed" value={workspace.failed} tone={workspace.failed > 0 ? "crit" : undefined} />
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

      <Section title="Google Drive" description="The only place anything is stored">
        <OkNote>
          Filing into folder <code>{workspace.drive.folderId}</code>. Contracts go to{" "}
          <code>input/</code>, reviews to <code>output/</code>, and the register to{" "}
          <code>state/</code>.
        </OkNote>
      </Section>

      <Section title="This workspace">
        <Configuration config={config} />
      </Section>

      <InfoNote>
        Every position this app produces is a proposal awaiting sign-off by qualified counsel. It
        signs nothing and sends nothing.
      </InfoNote>
    </div>
  );
}
