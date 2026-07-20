"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import {
  executeSegmentedCohortBacktest,
  getCohortBacktestStatus,
} from "@/app/admin/risk-lab/cohortBacktestClient";
import type { PublicRiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

function statusLabel(evidence: PublicRiskLabCohortBacktestEvidence | null) {
  if (!evidence) return "Pendente";
  if (evidence.status === "passed") return "Aprovado";
  if (evidence.status === "failed") return "Com blockers";
  return "Em execução";
}

export default function AdminSprint35QuickAction() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [evidence, setEvidence] = useState<PublicRiskLabCohortBacktestEvidence | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await getCohortBacktestStatus();
      if (!response.ok) return;
      setVisible(true);
      setEnabled(response.enabled);
      setEvidence(response.evidence);
      setError("");
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), visible ? 10_000 : 3_000);
    return () => window.clearInterval(timer);
  }, [load, visible]);

  async function execute() {
    setRunning(true);
    setMessage("");
    setError("");
    try {
      const response = await executeSegmentedCohortBacktest((label) => setProgress(label));
      if (!response.ok && response.evidence?.status !== "failed") {
        throw new Error(response.error || "Falha ao consolidar a execução segmentada.");
      }
      setEnabled(response.enabled);
      setEvidence(response.evidence);
      setMessage(
        response.evidence?.status === "passed"
          ? "Execução concluída: todos os gates metodológicos foram aprovados."
          : "Execução concluída com blockers estruturados registrados.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível executar as pendências.");
      await load();
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  if (!visible) return null;

  const blockers = evidence?.blockers.length || 0;

  return (
    <aside className="border-b border-violet-800 bg-violet-950 px-4 py-4 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-violet-200">
            <ShieldCheck size={15} /> Sprint 3.5 · ação pendente
          </p>
          <h2 className="mt-1 text-xl font-black">Backtest externo da coorte</h2>
          <p className="mt-1 text-sm text-violet-100">
            Status: <strong>{statusLabel(evidence)}</strong> · fundos persistidos {evidence?.cases.length ?? 0}/6 · cobertura {evidence?.metrics.coveragePercent ?? 0}% · blockers {blockers}.
          </p>
          {running && <p className="mt-2 text-xs font-extrabold text-violet-200">{progress || "Preparando execução segmentada…"}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void execute()}
            disabled={!enabled || running}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-violet-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 className="animate-spin" size={17} /> : evidence?.status === "passed" ? <CheckCircle2 size={17} /> : <PlayCircle size={17} />}
            {running ? "Executando etapas…" : "Executar pendências automaticamente"}
          </button>
          <Link
            href="/admin/risk-lab/cohort-backtest"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-800 px-5 py-3 text-sm font-extrabold text-white ring-1 ring-violet-600"
          >
            Ver detalhes <ExternalLink size={15} />
          </Link>
        </div>
      </div>

      {message && <p className="mx-auto mt-3 max-w-7xl rounded-xl bg-emerald-400/15 px-4 py-3 text-sm font-bold text-emerald-100 ring-1 ring-emerald-300/30">{message}</p>}
      {error && <p className="mx-auto mt-3 max-w-7xl rounded-xl bg-red-400/15 px-4 py-3 text-sm font-bold text-red-100 ring-1 ring-red-300/30"><AlertTriangle className="mr-2 inline" size={16} />{error}</p>}
    </aside>
  );
}
