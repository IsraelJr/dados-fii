import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-base font-extrabold text-slate-900">Dados FII</p>
          <p className="mt-2 leading-6">
            Ferramenta independente para consulta e acompanhamento de fundos imobiliários, dividendos, carteira e educação financeira.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            As informações exibidas servem para acompanhamento e estudo. Elas não representam recomendação de compra ou venda.
          </p>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Navegação</p>
          <div className="mt-3 grid gap-2">
            <Link href="/" className="hover:text-indigo-700">Início</Link>
            <Link href="/carteira" className="hover:text-indigo-700">Minha carteira</Link>
            <Link href="/calendario-dividendos-fiis" className="hover:text-indigo-700">Calendário de dividendos</Link>
            <Link href="/educacao" className="hover:text-indigo-700">Educação financeira</Link>
          </div>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Uso consciente</p>
          <p className="mt-3 leading-6">
            Confirme dados relevantes nos comunicados oficiais, relatórios gerenciais e páginas da administradora do fundo.
          </p>
        </div>
      </div>
    </footer>
  );
}
