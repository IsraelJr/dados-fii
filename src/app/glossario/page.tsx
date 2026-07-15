import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "../components/PageHeader";

export const metadata: Metadata = {
  title: "Glossário de FIIs",
  description: "Entenda em linguagem simples termos como DY, P/VP, IFIX, CDI, Selic, liquidez, heat map, stress test e tail risk em FIIs.",
  alternates: { canonical: "/glossario" },
};

const groups = [
  {
    title: "Fundamentos do fundo",
    intro: "Conceitos básicos para entender o que está sendo consultado.",
    items: [
      { id: "fii", term: "FII", text: "Fundo de Investimento Imobiliário. Reúne investidores para aplicar em imóveis, recebíveis imobiliários ou uma mistura dos dois. Na bolsa, o investidor compra cotas do fundo." },
      { id: "preco-cota", term: "Preço da cota", text: "É o valor negociado de uma cota na bolsa. O preço muda conforme oferta, demanda, juros, risco percebido e expectativa de renda futura." },
      { id: "cotas", term: "Total de cotas emitidas", text: "Mostra quantas cotas existem no fundo. Esse número não é a quantidade que o investidor tem; é o total de cotas do fundo no mercado." },
      { id: "p-vp", term: "P/VP", text: "Relação entre preço de mercado e valor patrimonial por cota. Abaixo de 1 pode indicar desconto; acima de 1 pode indicar prêmio. Não deve ser usado sozinho." },
      { id: "agio-desconto", term: "Ágio / desconto", text: "Compara o preço atual com o valor patrimonial por cota: (preço ÷ VP por cota − 1) × 100. Resultado acima de 0% é ágio; no Dados FII aparece em vermelho porque a cota está mais cara em relação ao patrimônio. Resultado abaixo de 0% é desconto; aparece em verde. Em 0%, preço e VP por cota estão em paridade. A cor ajuda na leitura, mas ágio não significa automaticamente investimento ruim e desconto não garante oportunidade." },
      { id: "valor-patrimonial", term: "Valor patrimonial", text: "Estimativa contábil do patrimônio do fundo. Ajuda na leitura de preço, mas depende da qualidade e atualização das avaliações dos ativos." },
      { id: "vp-cota-nav", term: "VP por cota (ou NAV por cota)", text: "É o patrimônio líquido do fundo dividido pelo número de cotas. NAV é a sigla em inglês para valor patrimonial líquido. No Dados FII usamos VP por cota, que é a forma mais simples em português. Ele não é a cotação da bolsa e pode ter uma data de referência diferente do preço atual." },
      { id: "valor-mercado", term: "Valor de mercado", text: "É o preço atual da cota multiplicado pelo total de cotas emitidas. Não é a mesma coisa que patrimônio líquido." },
    ],
  },
  {
    title: "Renda e dividendos",
    intro: "Indicadores ligados ao dinheiro que o cotista pode receber.",
    items: [
      { id: "dividendos-dy", term: "Dividendos e DY", text: "Dividendos são os rendimentos distribuídos pelo fundo. DY, ou dividend yield, compara esses rendimentos com o preço da cota. DY alto pode ser oportunidade ou sinal de risco." },
      { id: "data-com-data-ex", term: "Data com e data ex", text: "Data com é o último dia para ter direito ao próximo rendimento. Na data ex, quem compra a cota já não recebe aquele pagamento específico." },
      { id: "yield-data-com", term: "Yield na data-com", text: "Divide o rendimento anunciado pela cotação-base da data-com. Mostra a taxa daquele evento no momento em que o direito ao pagamento foi definido e permite uma comparação histórica mais coerente." },
      { id: "yield-preco-atual", term: "Yield sobre o preço atual", text: "Divide o último rendimento pelo preço atual da cota. É uma referência para quem olha o ativo hoje, mas varia com a cotação e não representa exatamente a taxa obtida na data em que o dividendo foi anunciado." },
      { id: "recorrencia", term: "Recorrência dos rendimentos", text: "Avalia se o fundo distribui renda de forma estável ou irregular. Para renda passiva, consistência costuma ser tão importante quanto DY alto." },
      { id: "risco-corte", term: "Risco de corte de dividendos", text: "É o risco de o fundo reduzir a renda paga por cota. Pode acontecer por vacância, inadimplência, queda de resultado, renegociação de contratos ou eventos de crédito." },
      { id: "concentracao-renda", term: "Concentração da renda", text: "Mostra se poucos FIIs respondem por grande parte dos dividendos da carteira. Quando a renda é concentrada, um corte em um ativo pesa mais no bolso do investidor." },
    ],
  },
  {
    title: "Segmentos e imóveis",
    intro: "Aqui entram os tipos de fundo e os riscos operacionais de cada setor.",
    items: [
      { id: "segmentos", term: "Segmento", text: "Classificação do fundo conforme sua estratégia ou tipo de ativo. Exemplos: shoppings, galpões logísticos, lajes corporativas, renda urbana, hospitais, híbridos e papel." },
      { id: "vacancia", term: "Vacância", text: "Mede espaços vagos ou perda de receita por imóveis desocupados. É mais relevante em fundos de shoppings, galpões e escritórios. Vacância alta pode pressionar dividendos." },
      { id: "fii-papel", term: "FII de papel", text: "Investe principalmente em recebíveis imobiliários, como CRIs. O foco é crédito, indexadores, garantias e inadimplência, não vacância física de imóveis." },
      { id: "fiagro", term: "Fiagro", text: "Fundo ligado ao agronegócio. Pode investir em crédito do agro, imóveis rurais, cadeias produtivas ou outros ativos do setor. O risco pode envolver clima, crédito, garantias e preço das commodities." },
      { id: "fi-infra", term: "FI-Infra", text: "Fundo de infraestrutura. Pode ter exposição a projetos, debêntures incentivadas e fluxos de longo prazo. Juros, liquidez e qualidade dos emissores são pontos importantes." },
    ],
  },
  {
    title: "Índices, mercado e liquidez",
    intro: "Conceitos para entender se o fundo é acompanhado pelo mercado e fácil de negociar.",
    items: [
      {
        id: "ifix",
        term: "IFIX",
        text: "Principal índice de fundos imobiliários da B3. Ele funciona como um termômetro do mercado de FIIs, parecido com o Ibovespa para ações. O IFIX é composto por uma carteira teórica com mais de 100 FIIs, e essa quantidade pode mudar nas revisões periódicas da B3. Quando um FII faz parte do IFIX, o Dados FII mostra essa marcação na consulta do ativo. Estar no IFIX costuma indicar maior relevância e liquidez, mas não significa que o fundo seja automaticamente bom, seguro ou adequado para compra.",
      },
      { id: "liquidez", term: "Liquidez", text: "Mostra a facilidade de comprar ou vender cotas sem afetar muito o preço. Fundos com baixa liquidez podem dificultar saída em momentos ruins." },
      { id: "dias-zerar", term: "Dias para zerar", text: "Estimativa de quantos dias seriam necessários para vender a posição usando a liquidez diária disponível. Em crise, esse prazo pode piorar." },
      { id: "cotistas", term: "Número de cotistas", text: "Indica quantas pessoas ou instituições têm cotas do fundo. Uma base mais ampla pode indicar maior pulverização, mas não garante menor risco." },
    ],
  },
  {
    title: "Juros e cenário macro",
    intro: "Indicadores que ajudam a entender o ambiente em que os FIIs estão inseridos.",
    items: [
      { id: "cdi", term: "CDI", text: "Referência muito usada para investimentos conservadores no Brasil. Quando o CDI está alto, FIIs precisam oferecer uma relação risco-retorno mais atrativa para competir." },
      { id: "selic", term: "Selic", text: "Taxa básica de juros da economia. Selic alta costuma pressionar o preço dos FIIs e aumentar a exigência de retorno dos investidores." },
      { id: "ipca", term: "IPCA", text: "Índice oficial de inflação. Ajuda a entender perda do poder de compra e impacto de contratos ou títulos indexados à inflação." },
      { id: "custo-oportunidade", term: "Custo de oportunidade", text: "É a comparação com alternativas. Se a renda fixa paga muito com baixo risco, o investidor exige mais dos FIIs para aceitar volatilidade e incerteza." },
    ],
  },
  {
    title: "Relatório de risco",
    intro: "Termos que aparecem no relatório profissional da carteira.",
    items: [
      { id: "heat-map", term: "Heat map", text: "É um painel de semáforo dos riscos. Mostra rapidamente quais FIIs ou fatores estão em risco baixo, moderado, alto ou muito alto." },
      { id: "stress-test", term: "Stress test", text: "É uma simulação de cenário ruim. Ele tenta mostrar o que poderia acontecer com patrimônio, dividendos e liquidez se juros, crédito, IFIX ou renda piorarem." },
      { id: "pares-comparaveis", term: "Pares ou fundos comparáveis", text: "São fundos usados como referência por terem categoria e, quando possível, segmento semelhantes. A comparação ajuda a dar contexto, mas fundos do mesmo grupo ainda podem ter estratégias e riscos diferentes." },
      { id: "percentil-pares", term: "Percentil entre pares", text: "Mostra a posição da nota composta diante dos fundos comparáveis. Percentil 100% significa que a nota ficou igual ou acima de todos os pares da amostra; não significa maior retorno, menor risco ou garantia de ser o melhor investimento. O Dados FII só mostra o percentil quando há pelo menos cinco pares com confiança suficiente." },
      { id: "sensibilidade-positiva", term: "Sensibilidade positiva", text: "Simulação em que preço e dividendos melhoram. Serve para enxergar o possível efeito favorável sobre a posição e a renda, mas não é uma previsão." },
      { id: "base-estatica", term: "Base estática", text: "Cenário de referência que mantém preço e dividendos nos valores atuais. Ele facilita a comparação com os outros cenários, mas não afirma que o fundo ficará parado." },
      { id: "sensibilidade-adversa", term: "Sensibilidade adversa", text: "Simulação em que preço e dividendos pioram ao mesmo tempo. Ajuda a visualizar quanto a posição e a renda da carteira poderiam cair no teste." },
      { id: "impacto-carteira", term: "Impacto na carteira", text: "Traduz um cenário do fundo para a quantidade de cotas do usuário. Mostra a mudança estimada em reais no valor da posição e na renda mensal, mantendo as demais posições constantes." },
      { id: "tail-risk", term: "Tail risk", text: "É um risco raro, mas pesado. Não acontece sempre, mas quando acontece pode causar impacto relevante na carteira." },
      { id: "red-team", term: "Red team", text: "É uma análise crítica que pergunta: o que pode dar errado? A ideia é evitar otimismo excessivo e mapear sinais de alerta antes do problema crescer." },
      { id: "bull-bear-case", term: "Bull case e bear case", text: "Bull case é o cenário positivo para o ativo. Bear case é o cenário negativo. Juntos, ajudam a ver oportunidade e risco sem olhar só um lado." },
      { id: "core-satelite", term: "Core e satélite", text: "Core são posições mais centrais e estáveis na estratégia. Satélite são posições menores, mais específicas ou com risco maior, que não deveriam dominar a carteira." },
    ],
  },
];

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function GlossarioPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Glossário de FIIs" subtitle="Termos de fundos imobiliários, renda, risco e relatório explicados em linguagem simples." />

      <section className="rounded-3xl bg-gray-900 p-6 text-gray-100 shadow-lg ring-1 ring-white/10 md:p-8">
        <p className="inline-flex rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-200">Para consultar sem travar</p>
        <h2 className="mt-4 text-2xl font-black text-white md:text-3xl">Entenda antes de interpretar</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">Use este glossário para traduzir os principais termos que aparecem nas consultas, na carteira e no relatório de risco.</p>
      </section>

      <nav className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-extrabold text-slate-900">Temas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <a key={group.title} href={`#${slug(group.title)}`} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{group.title}</a>
          ))}
        </div>
      </nav>

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <section key={group.title} id={slug(group.title)} className="scroll-mt-24 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h2 className="text-2xl font-black text-slate-900">{group.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{group.intro}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {group.items.map((item) => (
                <article key={item.id} id={item.id} className="scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <h3 className="text-base font-extrabold text-slate-900">{item.term}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-2xl bg-indigo-50 p-5 text-sm leading-6 text-indigo-950 ring-1 ring-indigo-100">
        <strong>Nota:</strong> os conceitos ajudam na leitura dos dados, mas não substituem análise individual, objetivos pessoais, diversificação e gestão de risco.
        <Link href="/metodologia" className="ml-1 font-extrabold text-indigo-700 hover:underline">Veja também a metodologia.</Link>
      </section>
    </main>
  );
}
