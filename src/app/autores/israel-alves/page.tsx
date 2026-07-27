import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Israel Alves — responsável pelo Dados FII", description: "Perfil do criador e responsável técnico e editorial pelo Dados FII.", alternates: { canonical: "/autores/israel-alves" } };

export default function AuthorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Autor e responsável</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">Israel Alves</h1>
        <p className="mt-2 text-lg font-bold text-slate-600">Analista de Sistemas · criador do Dados FII</p>
        <div className="mt-6 space-y-4 text-base leading-8 text-slate-700">
          <p>Israel Alves é responsável pelo produto, arquitetura, automações, integração de dados, controles de qualidade e direção editorial do Dados FII.</p>
          <p>Sua experiência declarada é em análise de sistemas. O perfil não apresenta certificação financeira inexistente nem se identifica como analista credenciado de valores mobiliários. O conteúdo publicado é informativo e procura apoiar a leitura crítica de dados e documentos oficiais.</p>
          <p>O trabalho editorial combina regras determinísticas, testes automatizados, revisão de fontes, política de correções e transparência sobre uso de inteligência artificial.</p>
        </div>
        <section className="mt-8 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <h2 className="text-xl font-extrabold text-slate-900">Áreas de responsabilidade</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2"><li>Arquitetura e segurança do produto</li><li>Qualidade e normalização dos dados</li><li>Metodologia e automação de cálculos</li><li>Política editorial e de correções</li><li>Experiência do usuário</li><li>Revisão técnica do conteúdo</li></ul>
        </section>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/sobre" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Sobre o projeto</Link><Link href="/politica-editorial" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Política editorial</Link></div>
      </article>
    </main>
  );
}
