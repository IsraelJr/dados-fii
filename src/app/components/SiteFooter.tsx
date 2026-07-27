import Link from "next/link";
import CookieSettingsButton from "./CookieSettingsButton";

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 md:grid-cols-4">
        <div>
          <p className="text-base font-extrabold text-slate-900">Dados FII</p>
          <p className="mt-2 leading-6">
            Ferramenta independente para consulta e acompanhamento de fundos imobiliários, dividendos, carteira e educação financeira.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Conteúdo informativo. Não representa recomendação individual de compra ou venda nem promessa de rentabilidade.
          </p>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Aprender e acompanhar</p>
          <div className="mt-3 grid gap-2">
            <Link href="/guias" className="hover:text-indigo-700">Guias de FIIs</Link>
            <Link href="/calendario-dividendos-fiis" className="hover:text-indigo-700">Calendário</Link>
            <Link href="/educacao" className="hover:text-indigo-700">Educação</Link>
            <Link href="/glossario" className="hover:text-indigo-700">Glossário</Link>
            <Link href="/carteira" className="hover:text-indigo-700">Minha carteira</Link>
          </div>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Confiança editorial</p>
          <div className="mt-3 grid gap-2">
            <Link href="/sobre" className="hover:text-indigo-700">Sobre o Dados FII</Link>
            <Link href="/autores/israel-alves" className="hover:text-indigo-700">Autor e responsável</Link>
            <Link href="/politica-editorial" className="hover:text-indigo-700">Política editorial</Link>
            <Link href="/politica-de-correcoes" className="hover:text-indigo-700">Política de correções</Link>
            <Link href="/como-usamos-ia" className="hover:text-indigo-700">Como usamos IA</Link>
          </div>
        </div>

        <div>
          <p className="font-extrabold text-slate-800">Transparência e privacidade</p>
          <div className="mt-3 grid gap-2">
            <Link href="/fontes-dos-dados" className="hover:text-indigo-700">Fontes dos dados</Link>
            <Link href="/metodologia" className="hover:text-indigo-700">Metodologia</Link>
            <Link href="/termos-de-uso" className="hover:text-indigo-700">Termos de uso</Link>
            <Link href="/politica-de-privacidade" className="hover:text-indigo-700">Privacidade</Link>
            <CookieSettingsButton />
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-100">
            FIIs têm riscos de mercado, liquidez, crédito, vacância e corte de dividendos.
          </p>
        </div>
      </div>
    </footer>
  );
}
