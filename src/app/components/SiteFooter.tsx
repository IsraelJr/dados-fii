import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 md:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr]">
        <div>
          <p className="text-base font-extrabold text-slate-900">Dados FII</p>
          <p className="mt-2 leading-6">
            Ferramenta independente para consulta e acompanhamento de fundos imobiliários, dividendos, carteira, educação financeira e relatórios educacionais de risco.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            As informações exibidas servem para acompanhamento e estudo. Elas não representam recomendação individual definitiva de compra ou venda.
          </p>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Navegação</p>
          <div className="mt-3 grid gap-2">
            <Link href="/" className="hover:text-indigo-700">Início</Link>
            <Link href="/carteira" className="hover:text-indigo-700">Minha carteira</Link>
            <Link href="/calendario-dividendos-fiis" className="hover:text-indigo-700">Calendário</Link>
            <Link href="/educacao" className="hover:text-indigo-700">Educação</Link>
            <Link href="/glossario" className="hover:text-indigo-700">Glossário</Link>
          </div>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Transparência</p>
          <div className="mt-3 grid gap-2">
            <Link href="/fontes-dos-dados" className="hover:text-indigo-700">Fontes dos dados</Link>
            <Link href="/metodologia" className="hover:text-indigo-700">Metodologia</Link>
            <Link href="/termos-de-uso" className="hover:text-indigo-700">Termos de uso</Link>
            <Link href="/politica-de-privacidade" className="hover:text-indigo-700">Privacidade</Link>
          </div>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Uso consciente</p>
          <p className="mt-3 leading-6">
            Dados relevantes são acompanhados de origem, data-base e limitações para permitir rastreabilidade aos documentos oficiais.
          </p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-100">
            FIIs têm risco de mercado, liquidez, crédito, vacância e corte de dividendos.
          </p>
        </div>
      </div>
    </footer>
  );
}
