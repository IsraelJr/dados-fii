import type { Metadata } from "next";
import InstitutionalPage from "../components/InstitutionalPage";

export const metadata: Metadata = { title: "Como usamos inteligência artificial", description: "Entenda onde a IA auxilia o Dados FII, quais decisões permanecem determinísticas e como evitamos publicação de informações inventadas.", alternates: { canonical: "/como-usamos-ia" } };

export default function AiPolicyPage() {
  return <InstitutionalPage eyebrow="Transparência de automação" title="Como usamos inteligência artificial" description="A IA auxilia pesquisa, organização e explicação, mas não é fonte de dados e não substitui cálculos financeiros determinísticos." sections={[
    { title: "Onde a IA ajuda", paragraphs: ["Modelos podem apoiar resumo de documentos, classificação de eventos, identificação de lacunas, revisão textual e transformação de dados consolidados em linguagem mais clara."] },
    { title: "O que a IA não pode fazer", paragraphs: ["Uma saída é rejeitada quando tenta preencher lacunas, inventar fonte ou ultrapassar as evidências recebidas."], items: ["Inventar preço, dividendo, indicador, citação, credencial ou probabilidade.", "Calcular P/VP, DY, concentração ou score crítico no lugar do código determinístico.", "Classificar governança como forte apenas porque gestor e administrador foram identificados.", "Transformar desconto patrimonial ou rendimento alto em recomendação de compra.", "Publicar análise sem fonte, data-base, limites e validação estrutural."] },
    { title: "Validação antes da publicação", paragraphs: ["O prompt recebe dados consolidados e versionados. A resposta passa por schema, verificação de números, regras de conteúdo proibido e validação de estrutura. Uma tentativa de reparo controlada pode ocorrer; se continuar inválida, a saída não é publicada.", "Cálculos relevantes permanecem reproduzíveis fora do modelo. A versão do prompt e as evidências usadas ficam disponíveis para auditoria técnica."] },
    { title: "Como reconhecer uma análise", paragraphs: ["O conteúdo deve indicar o que veio de dado determinístico, documento oficial, cálculo ou inferência. Quando faltam informações, a resposta correta é declarar indisponibilidade, não completar o campo por plausibilidade."] },
  ]} />;
}
