import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Política de privacidade do Dados FII sobre uso de dados, cookies, carteira, relatórios e contato do usuário.",
  alternates: { canonical: "/politica-de-privacidade" },
};

const privacyItems = [
  {
    title: "Dados informados pelo usuário",
    text: "O usuário pode informar ticker, quantidade de cotas, preço médio, e-mail e outros dados necessários para consulta, carteira, confirmação de acesso ou geração de relatório.",
  },
  {
    title: "Carteira e relatórios",
    text: "Dados da carteira podem ser usados para calcular concentração, renda estimada, riscos e relatórios educacionais. Relatórios podem ficar associados ao e-mail utilizado no fluxo de confirmação.",
  },
  {
    title: "Cookies e armazenamento local",
    text: "O site pode usar cookies e armazenamento no navegador para manter preferências, sessão, carteira local, cache de consultas e experiência de navegação.",
  },
  {
    title: "Dados técnicos de navegação",
    text: "Informações como páginas acessadas, buscas, estatísticas agregadas, erros e uso de funcionalidades podem ser usadas para melhorar estabilidade, segurança e qualidade do produto.",
  },
  {
    title: "Serviços externos",
    text: "O Dados FII pode depender de fornecedores externos para dados de mercado, anúncios, hospedagem, autenticação, envio de mensagens ou processamento de relatórios.",
  },
  {
    title: "Segurança e retenção",
    text: "O produto busca proteger os dados usados no serviço e manter apenas o necessário para funcionamento, histórico, segurança, auditoria e melhoria da experiência.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
          <LockKeyhole size={14} /> Privacidade
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Política de privacidade</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Esta página resume como o Dados FII pode tratar informações usadas para consulta, carteira, relatórios, estatísticas e melhoria do serviço.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {privacyItems.map((item) => (
          <article key={item.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-extrabold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1fr]">
        <article className="rounded-3xl bg-indigo-50 p-6 shadow-sm ring-1 ring-indigo-100">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
            <Cookie size={14} /> Cookies
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Por que usamos cookies?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Cookies e armazenamento local ajudam o site a lembrar preferências, reduzir carregamentos repetidos, manter fluxos de confirmação e melhorar a navegação. O usuário pode limpar dados do navegador quando desejar, sabendo que isso pode apagar informações locais.
          </p>
        </article>

        <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100">
            <ShieldCheck size={14} /> Controle do usuário
          </p>
          <h2 className="mt-4 text-2xl font-black">Uso responsável dos dados</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            O usuário deve evitar inserir informações sensíveis desnecessárias. Para dúvidas, solicitações ou correções relacionadas ao uso do site, utilize os canais de contato disponíveis no próprio produto.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/termos-de-uso" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900 hover:bg-slate-100">
              <Mail size={14} /> Termos de uso
            </Link>
            <Link href="/fontes-dos-dados" className="rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold text-white hover:bg-white/15">
              Fontes dos dados
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
