import type { Metadata } from "next";
import Link from "next/link";
import { Database, Info, RefreshCcw, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Fontes dos dados",
  description: "Entenda as fontes, limitações e cuidados no uso dos dados exibidos no Dados FII.",
};

const dataGroups = [
  {
    title: "Dados do FII",
    items: ["Ticker, segmento, tipo de fundo e dados cadastrais quando disponíveis.", "Preço atual, dividend yield, dividendos e histórico de pagamentos quando disponíveis.", "Liquidez, cotas emitidas, participação no IFIX e outros dados de mercado quando disponíveis."],
  },
  {
    title: "Indicadores macro",
    items: ["CDI, IPCA e Selic são usados como contexto de juros, inflação e custo de oportunidade.", "IFIX é usado como referência do mercado de fundos imobiliários quando houver fechamento ou retornos disponíveis."],
  },
  {
    title: "Carteira do usuário",
    items: ["Quantidade de cotas, preço médio e ativos informados ou salvos pelo usuário.", "Peso financeiro por ativo e segmento calculado com base nos valores disponíveis.", "Renda estimada calculada a partir dos dividendos disponíveis na base."],
  },
];

const qualityRules = [
  "Quando um dado está ausente, o site deve informar a limitação em vez de preencher por suposição.",
  "Quando um indicador patrimonial parece incoerente, ele deve ser desconsiderado por prudência.",
  "Valor de mercado e patrimônio líquido não são a mesma coisa e devem ser apresentados separadamente.",
  "Dados de dividendos ajudam a observar renda recente, mas não garantem pagamentos futuros.",
  "Dados de liquidez são úteis, mas podem piorar em momentos de estresse de mercado.",
];

export default function FontesDosDadosPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
          <Database size={14} /> Transparência
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Fontes dos dados</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          O Dados FII organiza dados públicos, dados de mercado, indicadores macroeconômicos e informações da carteira do usuário para facilitar acompanhamento de FIIs. Todo dado deve ser tratado como apoio à análise, não como verdade absoluta para decisão automática.
        </p>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {dataGroups.map((group) => (
          <article key={group.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-extrabold text-slate-900">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
            <RefreshCcw size={14} /> Controle de qualidade
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Como tratamos dados incompletos</h2>
          <div className="mt-5 grid gap-3">
            {qualityRules.map((rule) => (
              <div key={rule} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                {rule}
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-3xl bg-amber-50 p-6 shadow-sm ring-1 ring-amber-200">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">
            <ShieldAlert size={14} /> Uso responsável
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Rastreabilidade para decisões</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Para decisões relevantes, o Dados FII apresenta fontes, datas-base e limitações para que cada informação possa ser rastreada aos relatórios gerenciais, comunicados oficiais, informes e demais documentos públicos dos fundos.
          </p>
          <div className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-amber-200">
            O site ajuda a organizar e interpretar dados. Ele não substitui análise própria, planejamento financeiro ou orientação profissional individualizada.
          </div>
          <Link href="/metodologia" className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800">
            Ver metodologia
          </Link>
        </aside>
      </section>

      <section className="mt-8 rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100">
              <Info size={14} /> Dúvidas comuns
            </p>
            <h2 className="mt-4 text-2xl font-black">Não sabe o que cada indicador significa?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Veja o glossário em linguagem simples antes de interpretar indicadores como DY, P/VP, IFIX, CDI, Selic, liquidez e valor patrimonial.</p>
          </div>
          <Link href="/glossario" className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-100">
            Abrir glossário
          </Link>
        </div>
      </section>
    </main>
  );
}
