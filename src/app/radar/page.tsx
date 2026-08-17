import type { Metadata } from "next";
import FundRadarPanel from "@/app/components/FundRadarPanel";

export const metadata: Metadata = {
  title: "Radar de fundos",
  description: "Acompanhe mudanças em fundos que ainda não fazem parte da sua carteira, sem recomendação de compra ou venda.",
  alternates: { canonical: "/radar" },
};

export default function FundRadarPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-200">PV-5 · Acompanhamento</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Radar de fundos</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">Acompanhe fundos que você ainda não possui e veja somente mudanças novas em dividendos, fatos regulatórios, cobertura e sinais determinísticos. O Radar apoia sua análise; não recomenda comprar ou vender.</p>
      </header>
      <FundRadarPanel />
    </main>
  );
}
