import Link from "next/link";
import { BookOpen, Database, FileText, ShieldCheck } from "lucide-react";

const trustLinks = [
  {
    href: "/fontes-dos-dados",
    title: "Fontes dos dados",
    description: "Veja de onde vêm preços, dividendos, benchmarks e dados usados nas análises.",
    icon: Database,
  },
  {
    href: "/metodologia",
    title: "Metodologia",
    description: "Entenda como calculamos concentração, renda, liquidez, valuation e risco.",
    icon: ShieldCheck,
  },
  {
    href: "/glossario",
    title: "Glossário",
    description: "Traduza termos como DY, IFIX, liquidez, stress test e tail risk.",
    icon: BookOpen,
  },
  {
    href: "/termos-de-uso",
    title: "Uso responsável",
    description: "Leia os limites do produto e o aviso de que o conteúdo é educacional.",
    icon: FileText,
  },
];

export default function TrustLinksPanel() {
  return (
    <section className="rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
            Transparência e confiança
          </p>
          <h2 className="mt-3 text-xl font-extrabold text-slate-800">Entenda os dados antes de usar a análise</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Produto financeiro precisa ser claro. Por isso, o Dados FII separa fontes, metodologia, termos e explicações para leigos em páginas próprias.
          </p>
        </div>
        <Link href="/fontes-dos-dados" className="inline-flex justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800">
          Ver transparência
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {trustLinks.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:ring-indigo-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200">
              <Icon size={18} />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
