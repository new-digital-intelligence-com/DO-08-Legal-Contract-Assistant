"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import { ContractsPanel } from "@/components/panels/ContractsPanel";
import { SignOffPanel } from "@/components/panels/SignOffPanel";
import { StandardsPanel } from "@/components/panels/StandardsPanel";
import { DraftPanel } from "@/components/panels/DraftPanel";
import { AskPanel } from "@/components/panels/AskPanel";
import { AuditPanel } from "@/components/panels/AuditPanel";
import { useApi } from "@/components/api";
import type { WorkspaceStatus } from "@/lib/types";

/**
 * The console: a shell, a section switch, and panels that own their own data.
 *
 * The one piece of state that lives up here is the status counts, because the
 * left rail renders them from every screen — the number of positions still
 * waiting for a lawyer has to stay visible while somebody works somewhere else.
 * Everything else a panel needs, the panel fetches.
 */
export default function Console() {
  const [section, setSection] = useState("overview");
  const [contractId, setContractId] = useState<string>();

  const status = useApi<{ workspace: WorkspaceStatus }>("/api/status");

  // The section lives in the hash so a review can be linked to and survives a
  // reload — a lawyer sent "look at the Acme cap" should land on it.
  useEffect(() => {
    const apply = () => {
      const [id, contract] = window.location.hash.replace(/^#/, "").split("/");
      if (id) setSection(id);
      setContractId(contract || undefined);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const navigate = useCallback((id: string, contract?: string) => {
    setSection(id);
    setContractId(contract);
    window.location.hash = contract ? `${id}/${contract}` : id;
  }, []);

  const selectContract = useCallback(
    (id?: string) => navigate("contracts", id),
    [navigate],
  );

  const counts = {
    contracts: status.data?.workspace.contracts,
    awaitingSignOff: status.data?.workspace.awaitingSignOff,
  };

  return (
    <Shell
      active={section}
      onNavigate={(id) => navigate(id)}
      counts={counts}
      status={
        status.data && (
          <div className="space-y-0.5">
            <div>{status.data.workspace.model.name}</div>
            <div>
              Drive:{" "}
              {status.data.workspace.drive.state === "ready" ? "connected" : "not connected"}
            </div>
          </div>
        )
      }
    >
      {section === "overview" && <OverviewPanel onOpen={navigate} />}
      {section === "contracts" && (
        <ContractsPanel
          selected={contractId}
          onSelect={selectContract}
          onChanged={status.reload}
        />
      )}
      {section === "signoff" && (
        <SignOffPanel onOpenReview={(id) => navigate("contracts", id)} />
      )}
      {section === "standards" && <StandardsPanel />}
      {section === "draft" && <DraftPanel />}
      {section === "ask" && <AskPanel />}
      {section === "audit" && <AuditPanel />}
    </Shell>
  );
}
