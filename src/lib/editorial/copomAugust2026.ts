import type { MarketArticle } from "@/lib/editorial/marketContent";
import { getMarketArticle, MARKET_ARTICLES } from "@/lib/editorial/marketContent";

const COPOM_SOURCE = Object.freeze({
  name: "Copom reduz a taxa Selic para 14,00% a.a. — 280ª reunião",
  publisher: "Banco Central do Brasil",
  url: "https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados_detalhes?nro_reuniao=280",
  publishedAt: "2026-08-05",
  accessedAt: "2026-08-17",
});

const COPOM_MINUTES_SOURCE = Object.freeze({
  name: "Ata da 280ª reunião do Copom",
  publisher: "Banco Central do Brasil",
  url: "https://www.bcb.gov.br/content/copom/atascopom/Copom280-not20260805280.pdf",
  publishedAt: "2026-08-11",
  accessedAt: "2026-08-17",
});

const COPOM_CALENDAR_SOURCE = Object.freeze({
  name: "Calendário das reuniões do Copom em 2026",
  publisher: "Banco Central do Brasil",
  url: "https://www.bcb.gov.br/detalhenoticia/20739/nota",
  publishedAt: "2025-06-24",
  accessedAt: "2026-08-17",
});

export function getAugust2026MarketArticle(): MarketArticle {
  const base = getMarketArticle("mercado-de-fiis");
  if (!base) {
    throw new Error("Artigo-base de mercado não encontrado.");
  }

  return {
    ...base,
    title: "Fundos Imobiliários em agosto de 2026: juros, inflação, IFIX e impactos por segmento",
    description:
      "Análise atualizada após a reunião do Copom de 4 e 5 de agosto de 2026, com nova Selic, tom do comunicado, balanço de riscos e efeitos por segmento de FIIs.",
    summary:
      "O Copom reduziu a Selic em 0,25 ponto percentual, para 14,00% ao ano, dando continuidade à trajetória de flexibilização com comunicação cautelosa e dependente de dados. Para os FIIs, o corte reduz marginalmente o custo de capital, sem eliminar o prêmio elevado exigido pelo mercado nem os riscos específicos de crédito, vacância, alavancagem e qualidade dos ativos.",
    asOf: "2026-08-05",
    datePublished: "2026-08-05",
    dateModified: "2026-08-17",
    signals: [
      {
        label: "Meta Selic",
        value: "14,00% ao ano",
        interpretation:
          "Fato: o Copom reduziu a taxa em 0,25 ponto percentual. Interpretação editorial: o movimento reduz marginalmente o custo de capital, mas o nível absoluto ainda é fortemente restritivo.",
        sourceName: COPOM_SOURCE.name,
      },
      {
        label: "Sentido da decisão",
        value: "Quarto corte consecutivo, decisão unânime",
        interpretation:
          "Fato: o ciclo de redução continuou. Inferência: a velocidade segue deliberadamente lenta, o que limita uma reprecificação generalizada e imediata das cotas.",
        sourceName: COPOM_SOURCE.name,
      },
      {
        label: "Próxima reunião",
        value: "15 e 16 de setembro de 2026",
        interpretation:
          "Fato: a próxima decisão ordinária está prevista para 16 de setembro. O comunicado não transformou novo corte em compromisso automático.",
        sourceName: COPOM_CALENDAR_SOURCE.name,
      },
      base.signals.find((signal) => signal.label === "IPCA em 12 meses") ?? base.signals[1],
    ],
    sections: [
      {
        title: "Decisão oficial e tom do comunicado",
        paragraphs: [
          "Fato: na reunião concluída em 5 de agosto de 2026, o Copom reduziu por unanimidade a meta Selic de 14,25% para 14,00% ao ano, corte de 0,25 ponto percentual.",
          "Fato: o Banco Central afirmou que a magnitude do ciclo de calibração será ajustada à luz da evolução do cenário e reiterou a necessidade de manter restrição suficiente para convergir a inflação à meta.",
          "Interpretação editorial: o tom permaneceu cauteloso. O corte mantém a trajetória de flexibilização, mas não constitui promessa de novo corte nem aceleração automática do ciclo.",
        ],
        watch: [
          "Curva de juros e taxas reais, não apenas a Selic corrente.",
          "Expectativas de inflação de médio e longo prazo.",
          "Sinais fiscais e comportamento do câmbio.",
          "Novas leituras de inflação, expectativas e atividade antes da próxima decisão.",
        ],
      },
      {
        title: "Balanço de riscos",
        paragraphs: [
          "Fato: o comunicado manteve riscos relevantes nas duas direções, com assimetria altista. Entre os riscos de alta para a inflação estão a desancoragem das expectativas, a persistência da inflação de serviços, pressões cambiais e fiscais e uma demanda mais resistente do que o esperado.",
          "Fato: entre os riscos de baixa estão uma desaceleração doméstica ou global mais forte, efeitos mais intensos do aperto monetário já acumulado e recuo de commodities.",
          "Interpretação editorial: o Copom reconhece melhora suficiente para cortar, mas não suficiente para declarar a inflação dominada. Para FIIs, isso significa que a queda dos juros pode continuar irregular e sujeita a reversões na curva longa.",
        ],
      },
      {
        title: "Impactos por segmento de FIIs",
        paragraphs: [
          "Inferência — logística, renda urbana e escritórios prime: o corte reduz marginalmente a taxa de desconto e o custo de financiamento. O benefício tende a ser maior em fundos com ativos líquidos, contratos fortes, baixa vacância e pouca necessidade de refinanciamento.",
          "Inferência — shoppings: juros menores ajudam crédito e renda disponível com defasagem, mas a Selic em 14,00% ainda restringe consumo. Vendas, NOI, inadimplência e custo de ocupação continuam mais importantes que a decisão isolada.",
          "Inferência — recebíveis e papel: fundos atrelados ao CDI podem ter redução gradual da receita nominal. Em contrapartida, menor custo financeiro pode aliviar devedores. A qualidade do crédito, as garantias, o LTV e o caixa efetivamente recebido devem prevalecer sobre o dividend yield corrente.",
          "Inferência — desenvolvimento e fundos alavancados: são os mais sensíveis à queda do custo de capital, mas também os mais expostos caso a curva longa permaneça alta ou o ciclo pare. O corte de 0,25 ponto não corrige projetos ruins, vendas lentas ou dívida mal estruturada.",
          "Inferência — FIAGROs: ativos a CDI perdem parte do carregamento se os cortes continuarem, enquanto devedores ganham alívio marginal. Clima, preços agrícolas, garantias e concentração por devedor continuam dominando o risco.",
        ],
      },
      {
        title: "IFIX e conclusão editorial",
        paragraphs: [
          "Fato: a decisão mantém a trajetória de flexibilização iniciada em março de 2026; não representa mudança de direção nem garante alta do IFIX. O índice responde também à curva de juros, prêmio de risco, fluxo, resultados dos fundos e eventos específicos.",
          "Interpretação editorial: o cenário ficou um pouco menos adverso para FIIs de tijolo e estruturas alavancadas, mas ainda não é um ambiente de dinheiro barato. A seleção por qualidade permanece mais importante do que uma aposta indiscriminada na classe.",
          "Conclusão editorial: o mecanismo tende a ser mais favorável a fundos de tijolo com baixa alavancagem e contratos defensivos. Em fundos de papel, a análise precisa separar a redução da receita indexada da possível melhora do risco de crédito. O corte isolado não corrige ativos, contratos ou estruturas de dívida frágeis.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: [
          "A ata da 280ª reunião, publicada em 11 de agosto de 2026, detalha o debate interno e confirma o caráter ainda restritivo da política monetária. Esta análise separa fatos oficiais, interpretação editorial e inferências sobre FIIs; não prevê cotação, dividendo ou retorno do IFIX.",
          "Os efeitos por segmento são condicionais. A análise final exige dados de cada fundo, incluindo dívida, vacância, contratos, devedores, garantias, liquidez e qualidade da gestão.",
        ],
      },
    ],
    sources: [
      COPOM_SOURCE,
      COPOM_MINUTES_SOURCE,
      COPOM_CALENDAR_SOURCE,
      ...base.sources,
    ],
  };
}

export function applyAugust2026CopomUpdate(article: MarketArticle): MarketArticle {
  return article.slug === "mercado-de-fiis" ? getAugust2026MarketArticle() : article;
}

export const PUBLISHED_MARKET_ARTICLES: readonly MarketArticle[] = Object.freeze(
  MARKET_ARTICLES.map(applyAugust2026CopomUpdate),
);

export function getPublishedMarketArticle(slug: string): MarketArticle | undefined {
  return PUBLISHED_MARKET_ARTICLES.find((article) => article.slug === slug);
}
