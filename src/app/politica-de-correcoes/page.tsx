import type { Metadata } from "next";
import InstitutionalPage from "../components/InstitutionalPage";

export const metadata: Metadata = { title: "Política de correções", description: "Como o Dados FII identifica, corrige e previne erros em dados, cálculos e conteúdo financeiro.", alternates: { canonical: "/politica-de-correcoes" } };

export default function CorrectionsPolicyPage() {
  return <InstitutionalPage eyebrow="Qualidade e prestação de contas" title="Política de correções" description="Erros financeiros precisam ser interrompidos, corrigidos e prevenidos. Esta política descreve o processo aplicado a dados, cálculos, textos e páginas." sections={[
    { title: "Como reportar", paragraphs: ["O leitor pode usar o formulário de feedback disponível no site, indicando página, ticker, valor observado, data e fonte que sustenta a divergência. Não é necessário enviar dados pessoais ou informações da carteira."] },
    { title: "Classificação de severidade", paragraphs: ["A prioridade depende do impacto potencial sobre a interpretação do investidor."], items: ["Crítico: preço, dividendo, P/VP, identidade do fundo ou conclusão material incorreta — contenção imediata.", "Alto: fonte, categoria, competência ou data-base incorreta — correção prioritária.", "Médio: texto ambíguo, link quebrado ou explicação incompleta — correção no ciclo editorial curto.", "Baixo: estilo e formatação sem efeito no entendimento — próximo ciclo de manutenção."] },
    { title: "Fluxo obrigatório", paragraphs: ["A correção não termina ao ajustar um exemplo isolado."], items: ["Interromper distribuição, indexação ou anúncio quando o erro for material.", "Identificar causa raiz no dado, parser, regra, cálculo ou texto.", "Corrigir o pipeline e reprocessar todas as páginas afetadas.", "Testar fundos de categorias diferentes e adicionar regressão automatizada.", "Validar a correção em produção e registrar nota quando a mudança for relevante ao leitor."] },
    { title: "Histórico e transparência", paragraphs: ["Correções materiais devem indicar o que estava errado, o que mudou e a data da atualização. Ajustes menores de redação podem ser aplicados sem nota individual, mas continuam sujeitos a revisão de versão no repositório."] },
  ]} />;
}
