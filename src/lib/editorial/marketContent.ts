export type MarketSource = Readonly<{
  name: string;
  publisher: string;
  url: string;
  publishedAt: string;
  accessedAt: string;
}>;

export type MarketSignal = Readonly<{
  label: string;
  value: string;
  interpretation: string;
  sourceName: string;
}>;

export type MarketSection = Readonly<{
  title: string;
  paragraphs: readonly string[];
  watch?: readonly string[];
}>;

export type MarketArticleSlug =
  | "mercado-de-fiis"
  | "fiagro-agronegocio"
  | "galpoes-logistica"
  | "shoppings"
  | "escritorios-lajes-corporativas"
  | "recebiveis-papel"
  | "renda-urbana";

export type MarketArticle = Readonly<{
  slug: MarketArticleSlug;
  title: string;
  description: string;
  summary: string;
  asOf: string;
  datePublished: string;
  dateModified: string;
  reviewPolicy: string;
  indexable: true;
  signals: readonly MarketSignal[];
  sections: readonly MarketSection[];
  sources: readonly MarketSource[];
  related: readonly { href: string; label: string; destination: "fund" | "portfolio" | "premium" | "editorial" }[];
}>;

const ACCESSED_AT = "2026-08-04";

export const MARKET_SOURCES = Object.freeze({
  bcbSelic: {
    name: "Histórico das taxas de juros básicas",
    publisher: "Banco Central do Brasil",
    url: "https://www.bcb.gov.br/controleinflacao/historicotaxasjuros",
    publishedAt: "2026-06-17",
    accessedAt: ACCESSED_AT,
  },
  ibgeIpca: {
    name: "IPCA fica em 0,16% em junho",
    publisher: "IBGE",
    url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/47534-ipca-fica-em-0-16-em-junho",
    publishedAt: "2026-07-10",
    accessedAt: ACCESSED_AT,
  },
  ibgePib: {
    name: "PIB cresce 1,1% no primeiro trimestre de 2026",
    publisher: "IBGE",
    url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/46917-pib-cresce-1-1-no-primeiro-trimestre-de-2026",
    publishedAt: "2026-05-29",
    accessedAt: ACCESSED_AT,
  },
  ibgeRetail: {
    name: "Em maio, vendas no varejo variam 0,1%",
    publisher: "IBGE",
    url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa.html?ano=0&editoria=economicas&mes=7",
    publishedAt: "2026-07-16",
    accessedAt: ACCESSED_AT,
  },
  ibgeServices: {
    name: "Volume de serviços recua 0,4% em maio",
    publisher: "IBGE",
    url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/47570-volume-de-servicos-recua-0-4-em-maio",
    publishedAt: "2026-07-15",
    accessedAt: ACCESSED_AT,
  },
  b3Market: {
    name: "Mercado de fundos imobiliários",
    publisher: "B3",
    url: "https://www.b3.com.br/pt_br/noticias/mercado-de-fundos-imobiliarios.htm",
    publishedAt: "2026-03-17",
    accessedAt: ACCESSED_AT,
  },
  conabHarvest: {
    name: "Safra de grãos é estimada em 360,1 milhões de toneladas no ciclo 2025/26",
    publisher: "Conab",
    url: "https://cast.conab.gov.br/",
    publishedAt: "2026-07-14",
    accessedAt: ACCESSED_AT,
  },
  cvmFii: {
    name: "Fundos de Investimento Imobiliários — calendário e informações regulatórias",
    publisher: "CVM",
    url: "https://www.gov.br/cvm/pt-br/assuntos/regulados/envio-de-informacoes-a-cvm-calendario/sse/fundos-de-investimento-imobiliarios-fiis",
    publishedAt: "2025-12-15",
    accessedAt: ACCESSED_AT,
  },
} satisfies Record<string, MarketSource>);

const MACRO_SIGNALS = Object.freeze([
  {
    label: "Selic",
    value: "14,25% ao ano",
    interpretation: "Juros ainda elevados mantêm custo de capital e renda fixa competitivos, embora o ciclo já tenha iniciado redução.",
    sourceName: MARKET_SOURCES.bcbSelic.name,
  },
  {
    label: "IPCA em 12 meses",
    value: "4,64% até junho de 2026",
    interpretation: "A inflação segue relevante para contratos indexados e CRIs, mas o repasse efetivo depende de vacância, crédito e capacidade de pagamento.",
    sourceName: MARKET_SOURCES.ibgeIpca.name,
  },
  {
    label: "Atividade econômica",
    value: "PIB +1,1% no 1º trimestre de 2026",
    interpretation: "A expansão ajuda ocupação e consumo, mas não elimina diferenças entre regiões, imóveis e locatários.",
    sourceName: MARKET_SOURCES.ibgePib.name,
  },
] satisfies readonly MarketSignal[]);

export const MARKET_ARTICLES: readonly MarketArticle[] = Object.freeze([
  {
    slug: "mercado-de-fiis",
    title: "Mercado de fundos imobiliários: cenário, juros e sinais para acompanhar",
    description: "Leitura do mercado brasileiro de FIIs com data-base, fontes oficiais e os canais pelos quais juros, inflação e atividade chegam às cotas e aos dividendos.",
    summary: "O mercado de FIIs combina crescimento estrutural da base de investidores com um ambiente de juros ainda altos. Isso favorece a seleção por qualidade, liquidez e geração de caixa, em vez de uma leitura automática de que toda queda de juros beneficia todos os fundos da mesma forma.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão mensal ou após decisão do Copom, novo IPCA, mudança regulatória material ou atualização relevante da B3.",
    indexable: true,
    signals: [
      ...MACRO_SIGNALS,
      {
        label: "Mercado listado",
        value: "432 FIIs e R$ 200 bilhões em estoque em fevereiro de 2026",
        interpretation: "O crescimento amplia opções, mas também aumenta a necessidade de separar fundos líquidos e transparentes de estruturas pequenas ou difíceis de comparar.",
        sourceName: MARKET_SOURCES.b3Market.name,
      },
    ],
    sections: [
      {
        title: "O que o cenário atual realmente muda",
        paragraphs: [
          "A Selic em 14,25% continua elevada em termos nominais. Para FIIs, isso atua por três canais: aumenta a taxa exigida pelo investidor, encarece dívidas e obras e torna a renda fixa uma alternativa mais competitiva. A redução já iniciada pode aliviar esses canais, mas o efeito não é uniforme nem imediato.",
          "Fundos com ativos de qualidade, contratos defensivos, baixa alavancagem e boa liquidez tendem a atravessar a transição com mais previsibilidade. Fundos dependentes de venda de ativos, refinanciamento ou locatários frágeis podem continuar pressionados mesmo com juros menores.",
        ],
        watch: ["Mudanças na Selic e na curva de juros, não apenas a decisão do Copom.", "Capacidade de geração de caixa recorrente.", "Liquidez real da cota e tamanho da posição.", "Qualidade cadastral, regulatória e editorial dos dados."],
      },
      {
        title: "Como interpretar o crescimento do mercado",
        paragraphs: [
          "A B3 informou 3,076 milhões de investidores e volume médio diário de R$ 475 milhões em fevereiro de 2026. Mais participantes e negociação ajudam a classe, mas os números agregados não garantem liquidez para todos os tickers.",
          "O investidor deve comparar o volume do fundo com o tamanho de sua própria posição. Um mercado maior pode coexistir com fundos específicos de baixa negociação, spreads altos e dificuldade de saída em períodos de estresse.",
        ],
      },
      {
        title: "Juros, inflação e dividendos",
        paragraphs: [
          "Inflação maior pode elevar receitas indexadas, mas também despesas, inadimplência e custo de capital. Em fundos de papel, o indexador influencia a receita; em fundos de tijolo, o reajuste contratual só vira caixa se o locatário permanecer saudável e o imóvel conservar poder de barganha.",
          "Dividendos devem ser ligados à origem do resultado. Pagamento elevado por reserva, venda pontual ou correção extraordinária não deve ser tratado como novo patamar recorrente.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: [
          "Os dados macro são nacionais e não substituem análise por imóvel, devedor, contrato, região e gestor. A página não prevê preço de cota nem indica compra ou venda.",
          "Os dados da B3 usados aqui têm data-base de fevereiro de 2026; números posteriores devem ser conferidos na fonte antes de decisões materiais.",
        ],
      },
    ],
    sources: [MARKET_SOURCES.bcbSelic, MARKET_SOURCES.ibgeIpca, MARKET_SOURCES.ibgePib, MARKET_SOURCES.b3Market, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/guias/fundos-imobiliarios", label: "Entender como FIIs funcionam", destination: "editorial" },
      { href: "/carteira", label: "Analisar minha carteira", destination: "portfolio" },
      { href: "/guias/risco-em-fiis", label: "Revisar os principais riscos", destination: "editorial" },
    ],
  },
  {
    slug: "fiagro-agronegocio",
    title: "FIAGRO e agronegócio: cenário da safra, crédito e riscos",
    description: "Como produção agrícola, preços, clima, crédito e garantias afetam FIAGROs, com data-base e fontes oficiais.",
    summary: "A estimativa de safra recorde é positiva para atividade e logística, mas não elimina risco de crédito. Em FIAGRO, volume produzido, preço recebido, custo, seguro, estrutura da dívida e qualidade das garantias precisam ser analisados em conjunto.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão após cada levantamento relevante da Conab, alteração material de juros ou evento de crédito divulgado pelos fundos.",
    indexable: true,
    signals: [
      {
        label: "Safra 2025/26",
        value: "360,1 milhões de toneladas estimadas",
        interpretation: "A produção recorde favorece fluxo físico e demanda logística, mas maior oferta pode pressionar preços de algumas culturas.",
        sourceName: MARKET_SOURCES.conabHarvest.name,
      },
      MACRO_SIGNALS[0],
      MACRO_SIGNALS[1],
    ],
    sections: [
      {
        title: "Safra grande não significa crédito sem risco",
        paragraphs: [
          "A Conab elevou a estimativa da safra 2025/26 para 360,1 milhões de toneladas. O dado indica escala produtiva, mas a capacidade de pagamento de um devedor depende também do preço da commodity, produtividade individual, câmbio, custo de insumos, seguro e estrutura de capital.",
          "Um produtor pode colher mais e ainda enfrentar margem menor. Por isso, o relatório do FIAGRO deve mostrar devedores, culturas, regiões, garantias, LTV, senioridade, carências, amortizações e eventuais reestruturações.",
        ],
        watch: ["Concentração por devedor, cultura e região.", "Garantias executáveis e atualizadas.", "Atrasos, waivers, carências e renegociações.", "Diferença entre juros reconhecidos e caixa recebido."],
      },
      {
        title: "Juros e indexadores",
        paragraphs: [
          "Selic elevada pode aumentar a remuneração de ativos ligados ao CDI, mas também pressiona o serviço da dívida dos tomadores. Em créditos indexados à inflação, o rendimento nominal pode subir ao mesmo tempo em que a capacidade do devedor se deteriora.",
          "O investidor deve evitar interpretar indexador alto como proteção completa. A proteção depende de adimplência, garantias, diversificação e capacidade de recuperação em caso de problema.",
        ],
      },
      {
        title: "Clima, preço e logística",
        paragraphs: [
          "Risco climático afeta volume e qualidade da produção. Preço afeta receita. Logística afeta custo e prazo de entrega. Esses fatores podem se mover em direções diferentes e devem ser observados por região e cultura.",
          "FIAGROs com imóveis rurais, participação societária ou desenvolvimento têm mecanismos de risco distintos dos fundos predominantemente de crédito. Comparar todos apenas pelo dividend yield apaga essas diferenças.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: [
          "A estimativa da Conab é nacional e agregada. Ela não valida a situação financeira de nenhum devedor específico nem substitui documentos do fundo.",
          "Esta página não estima preço de commodities, perda esperada ou dividendos futuros.",
        ],
      },
    ],
    sources: [MARKET_SOURCES.conabHarvest, MARKET_SOURCES.bcbSelic, MARKET_SOURCES.ibgeIpca, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/guias/risco-em-fiis", label: "Analisar risco de crédito", destination: "editorial" },
      { href: "/carteira", label: "Ver concentração da carteira", destination: "portfolio" },
      { href: "/mercado/recebiveis-papel", label: "Comparar com fundos de recebíveis", destination: "editorial" },
    ],
  },
  {
    slug: "galpoes-logistica",
    title: "FIIs de galpões e logística: demanda, contratos e localização",
    description: "Leitura específica para fundos logísticos: ocupação, concentração, contratos, localização e efeito dos juros no valor dos ativos.",
    summary: "O segmento logístico depende menos de uma narrativa genérica de comércio eletrônico e mais da utilidade concreta do imóvel: acesso, raio de entrega, padrão construtivo, possibilidade de expansão, custo de reposição e força do locatário.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão trimestral ou após divulgação material de vacância, aquisição, venda, revisão de aluguel ou mudança macro relevante.",
    indexable: true,
    signals: [MACRO_SIGNALS[0], MACRO_SIGNALS[2], {
      label: "Serviços",
      value: "-0,4% em maio de 2026 ante abril",
      interpretation: "A oscilação mensal recomenda cautela com extrapolações; demanda logística deve ser observada por locatário, região e cadeia atendida.",
      sourceName: MARKET_SOURCES.ibgeServices.name,
    }],
    sections: [
      {
        title: "Localização é uma variável operacional",
        paragraphs: [
          "Um galpão próximo a grandes centros pode reduzir prazo e custo de entrega, mas também enfrentar terreno caro, restrições urbanas e concentração regional. Ativos distantes podem funcionar bem para armazenagem nacional, indústria ou agronegócio, desde que a malha de transporte seja compatível.",
          "A análise deve ligar localização ao uso do locatário. Distância, pedágio, acesso rodoviário, mão de obra, energia e possibilidade de expansão influenciam ocupação e aluguel.",
        ],
        watch: ["Vacância física e financeira separadas.", "Concentração por locatário e vencimento contratual.", "Aluguel por metro quadrado comparado ao mercado local.", "Capex necessário para recolocação do imóvel."],
      },
      {
        title: "Contratos e poder de barganha",
        paragraphs: [
          "Prazo longo reduz risco de renovação, mas não elimina risco de crédito ou revisão. Contratos atípicos podem oferecer proteção adicional, enquanto contratos típicos permitem mais flexibilidade ao locatário.",
          "Uma concentração alta pode ser aceitável quando o imóvel é essencial, o locatário é forte e o contrato é robusto; ainda assim, o risco precisa aparecer explicitamente na carteira.",
        ],
      },
      {
        title: "Juros e valor patrimonial",
        paragraphs: [
          "Juros elevados aumentam a taxa de desconto usada pelo mercado e podem reduzir valor econômico de imóveis, especialmente quando o aluguel cresce pouco. O efeito é maior em ativos comprados com cap rate comprimido ou financiados com dívida cara.",
          "A queda de juros pode ajudar a reprecificação, mas não corrige galpão mal localizado, vacância persistente ou contrato fraco.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: ["Indicadores nacionais de atividade não substituem dados de absorção e aluguel por microrregião. A análise final deve usar relatórios do fundo, laudos e documentos dos contratos quando disponíveis."],
      },
    ],
    sources: [MARKET_SOURCES.bcbSelic, MARKET_SOURCES.ibgePib, MARKET_SOURCES.ibgeServices, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/carteira", label: "Medir peso de logística na carteira", destination: "portfolio" },
      { href: "/guias/risco-em-fiis", label: "Revisar concentração e liquidez", destination: "editorial" },
      { href: "/mercado/renda-urbana", label: "Comparar com renda urbana", destination: "editorial" },
    ],
  },
  {
    slug: "shoppings",
    title: "FIIs de shoppings: consumo, vendas, ocupação e NOI",
    description: "Como atividade, varejo, inflação, ocupação e estrutura de receitas afetam fundos de shopping centers.",
    summary: "Shopping é uma operação, não apenas um imóvel. Vendas dos lojistas, fluxo, ocupação, aluguel mínimo, aluguel percentual, estacionamento, mídia, inadimplência e despesas determinam a qualidade do resultado.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão após novos dados relevantes de varejo e após resultados trimestrais dos fundos acompanhados.",
    indexable: true,
    signals: [MACRO_SIGNALS[1], MACRO_SIGNALS[2], {
      label: "Varejo",
      value: "+0,1% em maio de 2026 ante abril",
      interpretation: "A estabilidade mensal reforça a necessidade de avaliar vendas mesmas lojas, mix, região e renda do consumidor em cada portfólio.",
      sourceName: MARKET_SOURCES.ibgeRetail.name,
    }],
    sections: [
      {
        title: "Da venda do lojista ao caixa do fundo",
        paragraphs: [
          "O lojista paga aluguel mínimo e, em muitos contratos, aluguel percentual sobre vendas. Estacionamento, mídia e serviços complementam a receita. O fundo recebe sua participação depois de despesas operacionais, investimentos e eventuais incentivos comerciais.",
          "Crescimento de vendas sem avanço de NOI pode indicar aumento de despesas, descontos, obras ou mix pouco rentável. Por isso, vendas, ocupação e NOI devem ser lidos em conjunto.",
        ],
        watch: ["Vendas por metro quadrado e vendas mesmas lojas.", "NOI e margem NOI.", "Ocupação, inadimplência e custo de ocupação dos lojistas.", "Capex, expansões e participações minoritárias."],
      },
      {
        title: "Inflação e renda disponível",
        paragraphs: [
          "A inflação reajusta contratos, mas também comprime orçamento das famílias e custos dos lojistas. O repasse só é sustentável quando vendas e margem permitem absorver o aluguel.",
          "Shoppings dominantes em sua região podem ter maior poder de negociação. Ativos secundários ou dependentes de poucos lojistas enfrentam risco maior de concessões e vacância.",
        ],
      },
      {
        title: "Ciclos e sazonalidade",
        paragraphs: [
          "Datas comemorativas, férias e fim de ano alteram vendas e fluxo. Comparações mensais sem ajuste sazonal podem produzir conclusões erradas.",
          "A análise deve comparar o mesmo período do ano anterior e observar tendências de vários trimestres, não apenas um mês forte ou fraco.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: ["O varejo nacional não representa cada shopping. Região, renda, concorrência, mix e gestão local podem produzir resultados muito diferentes."],
      },
    ],
    sources: [MARKET_SOURCES.ibgeRetail, MARKET_SOURCES.ibgeIpca, MARKET_SOURCES.ibgePib, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/carteira", label: "Ver exposição a shoppings", destination: "portfolio" },
      { href: "/guias/dividendos-de-fiis", label: "Analisar dividendos", destination: "editorial" },
      { href: "/mercado/renda-urbana", label: "Comparar com renda urbana", destination: "editorial" },
    ],
  },
  {
    slug: "escritorios-lajes-corporativas",
    title: "FIIs de escritórios e lajes corporativas: vacância e qualidade",
    description: "Cenário para lajes corporativas com foco em microrregião, padrão do prédio, contratos, absorção e custo de reposição.",
    summary: "Escritórios são altamente locais. A média da cidade pode esconder microrregiões com absorção forte e outras com excesso de oferta. Qualidade do edifício, acesso, eficiência e concentração de inquilinos são decisivos.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão trimestral ou após mudança material de vacância, locação, venda, retrofit ou atividade econômica.",
    indexable: true,
    signals: [MACRO_SIGNALS[0], MACRO_SIGNALS[2], {
      label: "Atividades imobiliárias",
      value: "+1,2% no 1º trimestre de 2026 ante o trimestre anterior",
      interpretation: "A atividade agregada é positiva, mas não substitui absorção líquida, oferta e aluguel por microrregião.",
      sourceName: MARKET_SOURCES.ibgePib.name,
    }],
    sections: [
      {
        title: "Vacância precisa de contexto",
        paragraphs: [
          "Vacância física mede espaço vazio; vacância financeira mede receita perdida. Um prédio parcialmente vazio pode manter boa renda se os contratos ocupados forem fortes, mas a concentração aumenta.",
          "A mesma taxa de vacância tem significados diferentes em um edifício novo de padrão elevado e em um ativo obsoleto com necessidade de retrofit.",
        ],
        watch: ["Vacância física e financeira.", "Prazo médio dos contratos e concentração por inquilino.", "Aluguel atual versus mercado da microrregião.", "Capex de retrofit, condomínio e eficiência do edifício."],
      },
      {
        title: "Trabalho híbrido não produz um único vencedor",
        paragraphs: [
          "Modelos híbridos reduziram demanda de algumas empresas, mas também aumentaram preferência por prédios melhores, eficientes e bem localizados. Isso pode ampliar a diferença entre ativos prime e edifícios secundários.",
          "A tese deve avaliar qualidade e uso do imóvel, não apenas uma narrativa geral sobre retorno ao escritório.",
        ],
      },
      {
        title: "Juros, cap rate e transações",
        paragraphs: [
          "Juros elevados dificultam transações e aumentam cap rates exigidos. Fundos com caixa podem encontrar oportunidades, enquanto fundos alavancados ou pressionados a vender podem aceitar preços desfavoráveis.",
          "Valor patrimonial de laudo não é preço garantido de venda. Liquidez do ativo e condições do mercado importam.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: ["Dados nacionais de PIB e atividades imobiliárias são apenas contexto. A análise de escritórios exige dados locais e documentos de cada ativo."],
      },
    ],
    sources: [MARKET_SOURCES.ibgePib, MARKET_SOURCES.bcbSelic, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/carteira", label: "Analisar exposição a escritórios", destination: "portfolio" },
      { href: "/guias/risco-em-fiis", label: "Revisar vacância e concentração", destination: "editorial" },
      { href: "/mercado/galpoes-logistica", label: "Comparar com logística", destination: "editorial" },
    ],
  },
  {
    slug: "recebiveis-papel",
    title: "FIIs de recebíveis e papel: juros, inflação e risco de crédito",
    description: "Como indexadores, duration, garantias, LTV, inadimplência e estrutura dos CRIs afetam fundos de papel.",
    summary: "Fundos de papel podem ganhar receita nominal com CDI ou inflação elevados, mas o mesmo cenário pressiona devedores. O rendimento só é defensivo quando o crédito, as garantias e a recuperação são compatíveis com o risco assumido.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão após Copom, IPCA ou eventos materiais de crédito, reestruturação e provisão divulgados pelos fundos.",
    indexable: true,
    signals: [MACRO_SIGNALS[0], MACRO_SIGNALS[1], {
      label: "Regulação e informes",
      value: "Calendário CVM 2026 vigente",
      interpretation: "Informes periódicos e fatos relevantes são a base para confirmar carteira, eventos de crédito e mudanças de risco.",
      sourceName: MARKET_SOURCES.cvmFii.name,
    }],
    sections: [
      {
        title: "Indexador não substitui análise de crédito",
        paragraphs: [
          "CRI a CDI tende a gerar receita maior quando a Selic sobe; CRI a IPCA reage à inflação. Porém, a obrigação do devedor também aumenta. A remuneração adicional pode ser apenas compensação por risco maior.",
          "O investidor deve verificar se os juros foram efetivamente recebidos ou apenas reconhecidos contabilmente. Caixa, atraso, provisão e renegociação precisam ser separados.",
        ],
        watch: ["Devedores e grupos econômicos concentrados.", "LTV, senioridade e qualidade das garantias.", "Duration, carência e cronograma de amortização.", "Atrasos, waivers, provisões e reestruturações."],
      },
      {
        title: "High grade e high yield",
        paragraphs: [
          "High grade costuma priorizar devedores e estruturas mais robustas, com spread menor. High yield aceita risco maior em troca de spread maior. Os rótulos não são garantia e devem ser confirmados ativo por ativo.",
          "Uma carteira diversificada em número de CRIs pode continuar concentrada em um mesmo grupo, setor, região ou tipo de garantia.",
        ],
      },
      {
        title: "Preço, P/VP e marcação",
        paragraphs: [
          "P/VP abaixo de 1 pode refletir desconto, mas também expectativa de perda, liquidez baixa ou carteira marcada acima do valor de saída. Em crédito, a qualidade da marcação e a recuperabilidade importam mais do que o múltiplo isolado.",
          "Amortizações reduzem patrimônio e podem alterar o valor distribuído sem representar ganho econômico adicional.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: ["Os indicadores macro não permitem estimar perda esperada de um fundo específico. Essa análise exige carteira detalhada, documentos das operações e eventos posteriores."],
      },
    ],
    sources: [MARKET_SOURCES.bcbSelic, MARKET_SOURCES.ibgeIpca, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/guias/risco-em-fiis", label: "Aprofundar risco de crédito", destination: "editorial" },
      { href: "/carteira", label: "Medir concentração em papel", destination: "portfolio" },
      { href: "/mercado/fiagro-agronegocio", label: "Comparar com FIAGRO", destination: "editorial" },
    ],
  },
  {
    slug: "renda-urbana",
    title: "FIIs de renda urbana: contratos, locatários e imóveis essenciais",
    description: "Análise de renda urbana com foco em concentração, contratos atípicos, revisões, crédito do locatário e uso alternativo do imóvel.",
    summary: "Renda urbana reúne estratégias diferentes, como varejo, educação, saúde e imóveis monousuário. A previsibilidade depende do contrato e do locatário, mas também da capacidade de reutilizar o imóvel se a relação terminar.",
    asOf: "2026-08-04",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    reviewPolicy: "Revisão trimestral ou após renovação, revisional, desocupação, venda, aquisição ou mudança material na saúde do locatário.",
    indexable: true,
    signals: [MACRO_SIGNALS[0], MACRO_SIGNALS[1], {
      label: "Varejo",
      value: "+0,1% em maio de 2026 ante abril",
      interpretation: "A atividade estável não elimina diferenças entre redes, formatos e regiões; o crédito do locatário continua central.",
      sourceName: MARKET_SOURCES.ibgeRetail.name,
    }],
    sections: [
      {
        title: "Contrato longo não elimina risco",
        paragraphs: [
          "Contratos atípicos e multas podem aumentar previsibilidade, mas não impedem renegociação, disputa ou dificuldade financeira do locatário. A qualidade de crédito e a essencialidade do imóvel precisam ser analisadas.",
          "Fundos com poucos locatários podem pagar renda estável por anos e sofrer impacto grande quando um contrato termina. A concentração deve aparecer tanto no patrimônio quanto na renda.",
        ],
        watch: ["Concentração por locatário e grupo econômico.", "Prazo, revisional, multa e garantias contratuais.", "Uso alternativo e custo de adaptação do imóvel.", "Alavancagem e compromissos de aquisição."],
      },
      {
        title: "Imóvel essencial e fungibilidade",
        paragraphs: [
          "Um imóvel pode ser essencial para o locatário atual e, ainda assim, difícil de recolocar. Centros de distribuição urbanos, hospitais, escolas e lojas possuem níveis diferentes de especialização.",
          "Quanto mais específico o ativo, maior a importância da saúde do locatário e da proteção contratual. Quanto mais fungível, maior a importância de localização e aluguel de mercado.",
        ],
      },
      {
        title: "Inflação e revisões",
        paragraphs: [
          "Índices de inflação reajustam contratos, mas revisões e renegociações podem limitar o repasse. A comparação deve considerar aluguel efetivo, incentivos e despesas assumidas pelo fundo.",
          "Inflação e juros altos também pressionam varejistas e prestadores de serviço, o que pode elevar risco de crédito mesmo com receita contratual indexada.",
        ],
      },
      {
        title: "Limitações desta leitura",
        paragraphs: ["Renda urbana não é um segmento homogêneo. Cada uso, contrato e locatário exige análise específica; médias nacionais são apenas contexto."],
      },
    ],
    sources: [MARKET_SOURCES.ibgeRetail, MARKET_SOURCES.ibgeIpca, MARKET_SOURCES.bcbSelic, MARKET_SOURCES.cvmFii],
    related: [
      { href: "/carteira", label: "Ver concentração em renda urbana", destination: "portfolio" },
      { href: "/mercado/shoppings", label: "Comparar com shoppings", destination: "editorial" },
      { href: "/mercado/galpoes-logistica", label: "Comparar com logística", destination: "editorial" },
    ],
  },
]);

export function getMarketArticle(slug: string): MarketArticle | undefined {
  return MARKET_ARTICLES.find((article) => article.slug === slug);
}

export function validateMarketArticle(article: MarketArticle): readonly string[] {
  const errors: string[] = [];
  if (!article.title.trim() || !article.description.trim() || !article.summary.trim()) errors.push("missing-copy");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.asOf)) errors.push("invalid-as-of");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.datePublished)) errors.push("invalid-date-published");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.dateModified)) errors.push("invalid-date-modified");
  if (article.datePublished > article.dateModified) errors.push("published-after-modified");
  if (article.sections.length < 4) errors.push("insufficient-sections");
  if (article.sources.length < 3) errors.push("insufficient-sources");
  if (article.signals.length < 3) errors.push("insufficient-signals");
  if (article.sections.some((section) => section.paragraphs.length === 0)) errors.push("empty-section");
  if (article.sources.some((source) => !source.url.startsWith("https://") || !/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt))) errors.push("invalid-source");
  if (article.related.some((item) => !item.href.startsWith("/"))) errors.push("invalid-related-link");
  return Object.freeze(errors);
}
