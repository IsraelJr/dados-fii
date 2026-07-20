import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import CohortBacktestPanel from "@/app/admin/risk-lab/CohortBacktestPanel";

export default function RiskLabCohortBacktestPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-violet-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-violet-200">
                <FlaskConical size={16} /> Risk Lab administrativo
              </p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">Sprint 3.5 · Executar pendências</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                Acionamento de Produção da coorte externa e do backtest sem informação futura.
                A análise, os gates e a decisão de aprovação permanecem integralmente automatizados.
              </p>
            </div>
            <Link
              href="/admin/risk-lab"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900"
            >
              <ArrowLeft size={16} /> Voltar ao Risk Lab
            </Link>
          </div>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-200">
            <ShieldCheck className="mr-2 inline" size={18} /> O clique apenas inicia o executor protegido e idempotente.
          </div>
          <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-950 ring-1 ring-indigo-200">
            <ShieldCheck className="mr-2 inline" size={18} /> Nenhum fundo é aprovado manualmente e nenhum efeito externo é gerado.
          </div>
        </div>

        <div className="mt-6">
          <CohortBacktestPanel />
        </div>
      </div>
    </main>
  );
}
