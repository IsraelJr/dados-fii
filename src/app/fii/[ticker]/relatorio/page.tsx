'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

type ReportPayload = Record<string, any> | null;

function number(value: unknown, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Não avaliado";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(numeric);
}

function currency(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Não disponível";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function scoreLabel(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Não avaliado";
  if (numeric >= 80) return "Forte";
  if (numeric >= 60) return "Intermediário";
  return "Atenção";
}

function dateLabel(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    ...(match[3] ? { day: "2-digit" } : {}),
  }).format(date);
}

export default function RegulatoryReportPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = String(params?.ticker || "").toUpperCase();
  const [payload, setPayload] = useState<ReportPayload>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/fii-regulatory-report?ticker=${encodeURIComponent(ticker)}`, {
          cache: "no-store",
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || "Relatório indisponível.");
        if (active) setPayload(json);
      } catch (err: any) {
        if (active) setError(err?.message || "Não foi possível carregar o relatório.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (ticker) load();
    return () => { active = false; };
  }, [ticker]);

  const scoreEntries = useMemo(() => {
    if (!payload?.scores) return [];
    const labels: Record<string, string> = {
      overall: "Nota geral",
      dataQuality: "Qualidade dos dados",
      documentation: "Documentação",
      governanceEvidence: "Evidências de governança",
      investorBase: "Base de cotistas",
      patrimonial: "Patrimônio",
      growth: "Crescimento",
      stability: "Estabilidade",
      liquidity: "Liquidez",
      risk: "Risco observado",
    };
    return Object.entries(payload.scores).map(([key, value]) => ({ key, label: labels[key] || key, value }));
  }, [payload]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <Link href={`/fii/${ticker}`} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-900">
          <ArrowLeft size={17} /> Voltar para {ticker}
        </Link>

        {loading && (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
            <Loader2 className="animate-spin text-indigo-600" /> Carregando relatório regulatório...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-3xl bg-red-50 p-6 text-red-800 ring-1 ring-red-200">
            <strong>Relatório indisponível.</strong> {error}
          </div>
        )}

        {!loading && payload?.reportAvailable === false && (
          <div className="mt-8 rounded-3xl bg-amber-50 p-6 text-amber-900 ring-1 ring-amber-200">
            A base regulatória de {ticker} ainda está em preparação e não será exibida parcialmente.
          </div>
        )}

        {!loading && payload?.reportAvailable && (
          <div className="mt-6 space-y-6">
            <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-300">Relatório regulatório gratuito</p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">{ticker}</h1>
              <p className="mt-2 text-lg font-bold text-slate-300">{payload.fund?.name || "Fundo de investimento"}</p>
              <p className="mt-5 max-w-4xl text-base leading-7 text-slate-200">{payload.report?.headline}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
                <span className="rounded-full bg-white/10 px-4 py-2">Metodologia v{payload.scoreMeta?.methodologyVersion}</span>
                <span className="rounded-full bg-white/10 px-4 py-2">Fonte: {payload.regulatory?.source || "CVM"}</span>
                <span className="rounded-full bg-white/10 px-4 py-2">{payload.regulatory?.documentsCount || 0} documentos oficiais</span>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {scoreEntries.map((score) => (
                <div key={score.key} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{score.label}</p>
                  <div className="mt-3 text-3xl font-black text-slate-900">{score.value === null ? "—" : number(score.value)}</div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{score.value === null ? "Fonte ainda não integrada" : scoreLabel(score.value)}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <Metric icon={<BarChart3 />} label="Patrimônio líquido" value={currency(payload.report?.keyMetrics?.latestNetWorth)} />
              <Metric icon={<TrendingUp />} label="VP por cota" value={currency(payload.report?.keyMetrics?.latestVpCota)} />
              <Metric icon={<ShieldCheck />} label="Cotistas" value={number(payload.report?.keyMetrics?.latestShareholders)} />
              <Metric icon={<Clock3 />} label="Competências" value={number(payload.report?.keyMetrics?.monthsAnalyzed)} />
            </section>

            {!!payload.report?.alerts?.length && (
              <section className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
                <h2 className="flex items-center gap-2 text-xl font-black text-amber-950"><AlertTriangle size={21} /> Pontos de atenção</h2>
                <div className="mt-4 space-y-3">
                  {payload.report.alerts.map((alert: any) => (
                    <div key={alert.code} className="rounded-2xl bg-white p-4 ring-1 ring-amber-200/70">
                      <p className="font-black text-amber-950">{alert.title}</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900/80">{alert.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-600">História do fundo</p>
                  <h2 className="mt-1 text-2xl font-black">Timeline regulatória</h2>
                </div>
                <div className="text-sm font-bold text-slate-500">
                  {payload.timeline?.counts?.total || 0} eventos
                </div>
              </div>

              <div className="mt-6 space-y-7">
                {(payload.timeline?.groups || []).map((group: any) => (
                  <div key={group.month} className="grid gap-3 md:grid-cols-[9rem_1fr]">
                    <h3 className="pt-1 text-sm font-black capitalize text-slate-500">{dateLabel(group.month)}</h3>
                    <div className="space-y-3 border-l-2 border-indigo-100 pl-5">
                      {group.events.map((event: any) => (
                        <div key={event.id} className="relative rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                          <span className="absolute -left-[1.72rem] top-5 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                          <div className="flex flex-wrap items-center gap-2">
                            {event.kind === "official_document" ? <FileText size={16} className="text-indigo-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                            <p className="font-black">{event.title}</p>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">{event.category}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</p>
                          {event.sourceUrl && (
                            <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-indigo-700 hover:text-indigo-900">
                              Abrir documento oficial
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-indigo-950 p-6 text-white">
              <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-300">Próxima camada</p>
              <h2 className="mt-2 text-2xl font-black">Relatório Premium</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100/80">
                A versão Premium adicionará cenários, leitura orientada dos documentos oficiais e interpretação aprofundada, sempre limitada aos dados verificados.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-indigo-600">{icon}<span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span></div>
      <div className="mt-3 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}
