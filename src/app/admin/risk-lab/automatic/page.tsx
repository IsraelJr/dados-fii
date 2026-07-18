"use client";

import Link from "next/link";
import { useState } from "react";
import type { RiskLabAutomaticScan } from "@/types/riskLabAutomatic";

type Response = { ok: true; scan: RiskLabAutomaticScan } | { ok: false; error: string };

function cnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function AutomaticRiskLabPage() {
  const [ticker, setTicker] = useState("MCCI11");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [scan, setScan] = useState<RiskLabAutomaticScan | null>(null);

  async function execute() {
    setRunning(true);
    setError("");
    setScan(null);
    try {
      const response = await fetch("/api/admin/system/risk-lab/automatic", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", ticker }),
      });
      const payload = await response.json() as Response;
      if (!response.ok || !payload.ok) throw new Error(payload.ok ? `Falha HTTP ${response.status}` : payload.error);
      setScan(payload.scan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pesquisa automática não concluída.");
    } finally {
      setRunning(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-5xl">
      <header className="rounded-3xl bg-slate-950 p-7 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Risk Lab automático</p>
        <h1 className="mt-3 text-4xl font-black">Informe somente o ticker</h1>
        <p className="mt-3 text-sm text-slate-200">O sistema identifica o fundo, pesquisa a CVM e bloqueia sozinho qualquer conclusão insegura.</p>
        <Link href="/admin/risk-lab" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900">Voltar ao Risk Lab</Link>
      </header>

      <section className="mt-5 rounded-2xl bg-emerald-50 p-5 text-emerald-950 ring-1 ring-emerald-200">
        <p className="font-black">Você não precisa validar documentos.</p>
        <p className="mt-1 text-sm">Não há IDs, aprovações ou decisões técnicas. Dados insuficientes resultam em análise interrompida.</p>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200">
        <label htmlFor="ticker" className="text-sm font-black">Ticker do fundo</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="ticker" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="MCCI11" className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-lg font-black uppercase" />
          <button type="button" onClick={execute} disabled={running || !ticker} className="rounded-2xl bg-indigo-700 px-6 py-3 font-black text-white disabled:opacity-40">{running ? "Pesquisando e validando…" : "Pesquisar e validar automaticamente"}</button>
        </div>
      </section>

      {error && <section className="mt-5 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200"><p className="font-black">Pesquisa não concluída</p><p className="mt-1 text-sm">{error}</p></section>}

      {scan && <>
        <section className={`mt-6 rounded-3xl p-6 ring-1 ${scan.status === "validated" ? "bg-emerald-50 text-emerald-950 ring-emerald-200" : "bg-amber-50 text-amber-950 ring-amber-200"}`}>
          <h2 className="text-2xl font-black">{scan.status === "validated" ? "Validado automaticamente" : scan.status === "inconclusive" ? "Inconclusivo — análise interrompida" : "Bloqueado automaticamente"}</h2>
          <p className="mt-2 text-sm">{scan.nextAction}</p>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">Fundo identificado</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3"><Info label="Ticker" value={scan.identity.ticker} /><Info label="Fundo" value={scan.identity.fundName} /><Info label="CNPJ" value={cnpj(scan.identity.cnpj)} /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-4"><Info label="Fontes consultadas" value={String(scan.sources.length)} /><Info label="Fontes disponíveis" value={String(scan.sources.filter((item) => item.fetched).length)} /><Info label="Documentos aceitos" value={String(scan.documents.length)} /><Info label="Validação humana" value="Não exigida" /></div>
        </section>

        {scan.issues.length > 0 && <section className="mt-6 space-y-2">{scan.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200"><strong>{issue.severity === "error" ? "Bloqueio automático" : "Aviso automático"}:</strong> {issue.message}</div>)}</section>}

        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">Documentos oficiais encontrados</h2>
          <div className="mt-4 space-y-3">{scan.documents.slice(0, 25).map((document) => <article key={document.documentId} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="font-black">{document.documentType}</p><p className="mt-1 text-sm text-slate-600">{document.fileName}</p><a href={document.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-black text-indigo-700">Abrir fonte oficial</a></article>)}</div>
        </section>
      </>}
    </div>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 break-words font-black text-slate-900">{value}</p></div>;
}
