import type { MarketArticle } from "@/lib/editorial/marketContent";
import { getMarketArticle } from "@/lib/editorial/marketContent";

const COPOM_SOURCE = Object.freeze({
  name: "Copom reduz a taxa Selic para 14,00% a.a. — 280ª reunião",
  publisher: "Banco Central do Brasil",
  url: "https://www.bcb.gov.br/controleinflacao/comunicadoscopom",
  publishedAt: "2026-08-05",
  accessedAt: "2026-08-05",
});

const COPOM_CALENDAR_SOURCE = Object.freeze({
  name: "Calendário das reuniões do Copom em 2026",
  publisher: "Banco Central do Brasil",
  url: "https://www.bcb.gov.br/detalhenoticia/20739/nota",
  publishedAt: "2025-06-24",
  accessedAt: "2026-08-05",
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
      "O Copom reduziu a Selic em 0,25 ponto percentual, para 14,00% ao ano, mas manteve comunicação cautelosa e dependente de dados. Para os FIIs, o corte melhora marginalmente a direção do custo de capital, sem eliminar o prêmio elevado exigido pelo mercado nem os riscos específicos de crédito, vacância, alavancagem e qualidade dos ativos.",
    asOf: "2026-08-05",
    signals: [
      {
        label: "Meta Selic",
        value: "14,00% ao ano",
        interpretation:
          "Fato: o Copom reduziu a taxa em 0,25 ponto percentual. Interpretação: o sentido é favorável aos FIIs, mas o nível absoluto ainda é fortemente restritivo.",
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
          "Fato: o Banco Central não ofereceu uma trajetória automática para as próximas reuniões e condicionou os passos seguintes à evolução da inflação, das expectativas, da atividade, do mercado de trabalho, do cenário fiscal e do ambiente externo.",
          "Interpretação editorial: o tom foi cauteloso, próximo de neutro-hawkish. O corte confirma flexibilização, mas a ausência de promessa para setembro impede tratar a decisão como aceleração do ciclo.",
        ],
        watch: [
          "Curva de juros e taxas reais, não apenas a Selic corrente.",
          "Expectativas de inflação de médio e longo prazo.",
          "Sinais fiscais e comportamento do câmbio.",
          "Ata do Copom, prevista para a terça-feira seguinte à reunião.",
        ],
      },
      {
        title: "Balanço de riscos",
        paragraphs: [
          "Fato: o comunicado manteve riscos relevantes nas duas direções. Entre os riscos de alta para a inflação estão a desancoragem das expectativas, a persistência da inflação de serviços, pressões cambiais e fiscais e uma demanda mais resistente do que o esperado.",
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
          "Fato: a decisão altera a direção da política monetária, mas não garante alta do IFIX. O índice responde também à curva de juros, prêmio de risco, fluxo, resultados dos fundos e eventos específicos.",
          "Interpretação editorial: o cenário ficou um pouco menos adverso para FIIs de tijolo e estruturas alavancadas, mas ainda não é um ambiente de dinheiro barato. A seleção por qualidade permanece mais importante do que uma aposta indiscriminada na classe.",
          "Conclusão: os maiores beneficiados potenciais são fundos de tijolo de alta qualidade, com baixa alavancagem e contratos defensivos. Fundos de papel devem ser avaliados pela transição entre menor receita indexada e melhora do risco de crédito. Fundos frágeis não se tornam bons apenas porque a Selic caiu 0,25 ponto percentual.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: [
          "A ata da reunião ainda trará maior detalhamento do debate interno. Esta análise separa fatos do comunicado, interpretação editorial e inferências sobre FIIs; não prevê cotação, dividendo ou retorno do IFIX.",
          "Os efeitos por segmento são condicionais. A análise final exige dados de cada fundo, incluindo dívida, vacância, contratos, devedores, garantias, liquidez e qualidade da gestão.",
        ],
      },
    ],
    sources: [
      COPOM_SOURCE,
      COPOM_CALENDAR_SOURCE,
      ...base.sources.filter((source) => source.publisher !== "Banco Central do Brasil"),
    ],
  };
}

export function applyAugust2026CopomUpdate(article: MarketArticle): MarketArticle {
  return article.slug === "mercado-de-fiis" ? getAugust2026MarketArticle() : article;
}
