import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import DividendStressRunPanel from "@/app/admin/risk-lab/DividendStressRunPanel";

export default function RiskLabStressRunsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-violet-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-violet-200">
                <FlaskConical size={16} /> Risk Lab administrativo
              </p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">Execuções manuais de estresse</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                Área isolada para executar o detector de dividendos sobre séries aprovadas de MCCI11 e RBRY11. Nenhuma ação é disparada automaticamente ao abrir esta página.
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
            <ShieldCheck className="mr-2 inline" size={18} /> A leitura do status não executa o motor.
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-200">
            <ShieldCheck className="mr-2 inline" size={18} /> Resultados permanecem preliminares até revisão dos eventos de crédito.
          </div>
        </div>

        <DividendStressRunPanel />
      </div>
    </main>
  );
}
