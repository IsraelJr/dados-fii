import type { Metadata } from "next";
import Link from "next/link";
import CookieSettingsButton from "../components/CookieSettingsButton";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Política de privacidade do Dados FII sobre dados, cookies, publicidade, Google AdSense, carteira, relatórios e direitos do usuário.",
  alternates: { canonical: "/politica-de-privacidade" },
};

const GOOGLE_ADS_SETTINGS = "https://adssettings.google.com/";
const ABOUT_ADS = "https://www.aboutads.info/choices/";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Privacidade e LGPD</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Política de privacidade</h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">Esta política explica quais dados podem ser tratados, por que são usados, como publicidade e cookies funcionam e quais controles estão disponíveis ao usuário.</p>
        <p className="mt-4 text-sm font-bold text-slate-500">Última revisão: 27/07/2026</p>
      </header>

      <div className="mt-8 space-y-5">
        <PolicySection title="Dados fornecidos e dados de uso">
          <p>O usuário pode informar ticker, quantidade de cotas, preço médio, e-mail e preferências necessárias para consulta, carteira, autenticação, alertas e relatórios. Evite inserir dados sensíveis que não sejam necessários ao serviço.</p>
          <p>Também podem ser tratados dados técnicos como página acessada, busca, tipo de dispositivo, endereço IP, identificadores, falhas e eventos de segurança. Essas informações apoiam funcionamento, prevenção de abuso, métricas agregadas e melhoria da experiência.</p>
        </PolicySection>
        <PolicySection title="Carteira e relatórios">
          <p>Dados da carteira podem ser usados para calcular concentração, renda estimada, liquidez, cenários e relatórios educacionais. Áreas personalizadas e relatórios privados não são disponibilizados para indexação por mecanismos de busca nem recebem anúncios.</p>
        </PolicySection>
        <PolicySection title="Cookies essenciais e opcionais">
          <p>Cookies essenciais e armazenamento local mantêm sessão, preferências, segurança, carteira local e cache. Cookies opcionais só são autorizados após a escolha do usuário e podem apoiar métricas e publicidade.</p>
          <p>Recusar cookies opcionais não impede o acesso ao conteúdo público. A escolha pode ser alterada a qualquer momento.</p>
          <div className="mt-4"><CookieSettingsButton /></div>
        </PolicySection>
        <PolicySection title="Google AdSense e publicidade">
          <p>O Dados FII pode usar o Google AdSense. O Google, como fornecedor de terceiros, pode usar cookies, web beacons, endereço IP e outros identificadores para medir anúncios, prevenir fraude e, quando autorizado e aplicável, exibir publicidade baseada em visitas anteriores a este e a outros sites.</p>
          <p>O uso de cookies de publicidade depende da escolha registrada no banner. O Google e seus parceiros podem combinar informações conforme suas próprias políticas. O Dados FII não vende dados pessoais a anunciantes e não permite que publicidade altere cálculos, fontes ou conclusões editoriais.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={GOOGLE_ADS_SETTINGS} target="_blank" rel="noopener noreferrer" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Configurações de anúncios do Google</a>
            <a href={ABOUT_ADS} target="_blank" rel="noopener noreferrer" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Opções de publicidade de terceiros</a>
          </div>
        </PolicySection>
        <PolicySection title="Fornecedores e compartilhamento necessário">
          <p>Dados podem ser processados por serviços de hospedagem, autenticação, banco de dados, observabilidade, envio de mensagens, inteligência artificial e publicidade, apenas na medida necessária para executar a função contratada, proteger o serviço ou cumprir obrigação legal.</p>
          <p>Provedores técnicos podem operar fora do Brasil e aplicar mecanismos próprios de proteção e transferência internacional. Sempre que possível, o produto minimiza os dados enviados e separa informações pessoais de conteúdo público.</p>
        </PolicySection>
        <PolicySection title="Retenção, segurança e direitos">
          <p>Os dados são mantidos pelo período necessário para operação, segurança, auditoria e cumprimento de obrigações. O usuário pode solicitar acesso, correção, confirmação de tratamento ou exclusão quando aplicável, usando os canais de feedback do produto.</p>
          <p>Nenhum sistema é isento de risco. O Dados FII aplica controles técnicos e organizacionais, limita privilégios e registra eventos relevantes, mas o usuário também deve proteger credenciais e evitar compartilhar informações desnecessárias.</p>
        </PolicySection>
        <PolicySection title="Atualizações desta política">
          <p>Esta página será revisada quando houver mudança relevante em fornecedores, finalidades, cookies, publicidade ou legislação. Alterações materiais terão data de revisão atualizada.</p>
        </PolicySection>
      </div>

      <aside className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">
        <h2 className="text-xl font-extrabold">Documentos relacionados</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/termos-de-uso" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">Termos de uso</Link>
          <Link href="/politica-editorial" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Política editorial</Link>
          <Link href="/como-usamos-ia" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Uso de IA</Link>
        </div>
      </aside>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}
