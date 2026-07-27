import type { Metadata } from "next";
import CalendarCopyEnhancer from "../components/CalendarCopyEnhancer";

export const metadata: Metadata = {
  title: "Calendário de Dividendos de FIIs",
  description: "Consulte datas de pagamento, data-com e rendimentos anunciados por fundos imobiliários, com explicação sobre como interpretar cada evento.",
  alternates: { canonical: "/calendario-dividendos-fiis" },
};

export default function CalendarioDividendosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CalendarCopyEnhancer />
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Como usar o calendário</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Entenda as datas antes de usar o calendário</h2>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600">
            A data-com define quem terá direito ao rendimento anunciado; a data de pagamento indica quando o valor será creditado. O calendário organiza esses eventos, mas não transforma um dividendo isolado em sinal de compra. Antes de decidir, avalie recorrência, origem do resultado, preço da cota e riscos do fundo.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><strong className="text-slate-900">Data-com</strong><p className="mt-1 text-sm leading-6 text-slate-600">Último pregão em que a cota precisa estar na carteira para aquele pagamento.</p></div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><strong className="text-slate-900">Pagamento</strong><p className="mt-1 text-sm leading-6 text-slate-600">Data prevista para o crédito do rendimento na corretora.</p></div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><strong className="text-slate-900">Limitação</strong><p className="mt-1 text-sm leading-6 text-slate-600">Datas podem ser corrigidas pelo administrador; confirme eventos materiais na fonte oficial.</p></div>
          </div>
        </div>
      </section>
      {children}
    </>
  );
}
