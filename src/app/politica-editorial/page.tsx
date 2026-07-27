import type { Metadata } from "next";
import InstitutionalPage from "../components/InstitutionalPage";

export const metadata: Metadata = { title: "Política editorial", description: "Critérios de pesquisa, autoria, fontes, revisão, publicidade e publicação usados pelo Dados FII.", alternates: { canonical: "/politica-editorial" } };

export default function EditorialPolicyPage() {
  return <InstitutionalPage eyebrow="Governança de conteúdo" title="Política editorial" description="Esta política define como o Dados FII pesquisa, calcula, escreve, revisa, publica, atualiza e monetiza conteúdo financeiro." sections={[
    { title: "Princípios", paragraphs: ["O conteúdo deve resolver uma dúvida real, acrescentar análise própria e permitir que o leitor confira a origem das informações."], items: ["Pessoas antes de mecanismos de busca: nenhuma página existe apenas para capturar palavra-chave.", "Cautela em tema financeiro: rendimento alto, desconto patrimonial ou nota isolada não viram recomendação.", "Transparência: separar dado, fato, cálculo, inferência, hipótese e informação indisponível.", "Originalidade: não copiar nem apenas reescrever relatório gerencial ou conteúdo de concorrente."] },
    { title: "Fontes e cálculos", paragraphs: ["A hierarquia prioriza CVM, B3, Fundos.NET, Banco Central, IBGE, administradores, gestores e documentos oficiais. Fontes secundárias servem como apoio, não como base única de afirmações materiais.", "Preço, P/VP, dividend yield, concentração e outros indicadores críticos devem ser calculados por funções testadas. A IA não substitui esse cálculo."] },
    { title: "Autoria, revisão e atualização", paragraphs: ["Conteúdo editorial identifica autor, responsável, publicação ou última revisão e limitações. Não são inventados títulos, certificações ou experiência.", "Guias evergreen são revisados pelo menos semestralmente; páginas dependentes de evento ou regra são atualizadas quando a fonte muda. Conteúdo vencido pode ser corrigido, consolidado ou retirado do índice."] },
    { title: "Publicidade e conflitos", paragraphs: ["Anunciantes e redes de publicidade não escolhem pautas, fontes, scores ou conclusões. Anúncios não aparecem em áreas privadas, previews, estados vazios ou páginas que não passaram pelo gate de monetização.", "Links comerciais ou relações relevantes devem ser identificados. A remuneração não altera o tratamento editorial de um fundo ou produto."] },
    { title: "Gate de qualidade", paragraphs: ["O score interno usa três marcos: 70 pontos para publicar, 80 para indexar e 85 para monetizar. Erro de cálculo, número sem fonte, conteúdo duplicado, ausência de autoria ou página dominada por placeholder reprovam o conteúdo independentemente da nota."] },
  ]} />;
}
