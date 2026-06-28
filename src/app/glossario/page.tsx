import Link from "next/link";

const groups = [
    {
        title: "Fundamentos do fundo",
        intro: "Conceitos básicos para entender o que está sendo consultado.",
        items: [
            {
                id: "fii",
                term: "FII",
                text: "Fundo de Investimento Imobiliário. Reúne investidores para aplicar em imóveis, recebíveis imobiliários ou uma mistura dos dois. Na bolsa, o investidor compra cotas do fundo.",
            },
            {
                id: "preco-cota",
                term: "Preço da cota",
                text: "É o valor negociado de uma cota na bolsa. O preço muda conforme oferta, demanda, juros, risco percebido e expectativa de renda futura.",
            },
            {
                id: "cotas",
                term: "Total de cotas",
                text: "Mostra quantas cotas existem no fundo. Esse número ajuda a entender o tamanho da base de investidores e a divisão dos resultados entre cotistas.",
            },
            {
                id: "p-vp",
                term: "P/VP",
                text: "Relação entre preço de mercado e valor patrimonial. Abaixo de 1 pode indicar desconto; acima de 1 pode indicar prêmio. Não deve ser usado sozinho.",
            },
        ],
    },
    {
        title: "Renda e dividendos",
        intro: "Indicadores ligados ao dinheiro que o cotista pode receber.",
        items: [
            {
                id: "dividendos-dy",
                term: "Dividendos e DY",
                text: "Dividendos são os rendimentos distribuídos pelo fundo. DY, ou dividend yield, compara esses rendimentos com o preço da cota. DY alto pode ser oportunidade ou sinal de risco.",
            },
            {
                id: "data-com-data-ex",
                term: "Data com e data ex",
                text: "Data com é o último dia para ter direito ao próximo rendimento. Na data ex, quem compra a cota já não recebe aquele pagamento específico.",
            },
            {
                id: "recorrencia",
                term: "Recorrência dos rendimentos",
                text: "Avalia se o fundo distribui renda de forma estável ou irregular. Para renda passiva, consistência costuma ser tão importante quanto DY alto.",
            },
        ],
    },
    {
        title: "Segmentos e imóveis",
        intro: "Aqui entram os tipos de fundo e os riscos operacionais de cada setor.",
        items: [
            {
                id: "segmentos",
                term: "Segmento",
                text: "Classificação do fundo conforme sua estratégia ou tipo de ativo. Exemplos: shoppings, galpões logísticos, lajes corporativas, renda urbana, hospitais, híbridos e papel.",
            },
            {
                id: "vacancia",
                term: "Vacância",
                text: "Mede espaços vagos ou perda de receita por imóveis desocupados. É mais relevante em fundos de shoppings, galpões e escritórios. Vacância alta pode pressionar dividendos.",
            },
            {
                id: "shoppings",
                term: "Shoppings",
                text: "Fundos de shoppings dependem de aluguel mínimo, vendas dos lojistas, fluxo de consumidores e ocupação das lojas. Vacância e inadimplência são pontos de atenção.",
            },
            {
                id: "logistica",
                term: "Galpões logísticos",
                text: "Fundos de galpões dependem de localização, padrão construtivo, contratos e qualidade dos inquilinos. Vacância pode pesar bastante quando há poucos imóveis ou poucos locatários.",
            },
            {
                id: "escritorios",
                term: "Escritórios e lajes corporativas",
                text: "Fundos de escritórios são sensíveis à demanda por espaços corporativos, região, padrão dos edifícios e ciclo econômico. Vacância costuma ser um dos indicadores centrais.",
            },
            {
                id: "papel",
                term: "FII de papel",
                text: "Investe principalmente em recebíveis imobiliários, como CRIs. O foco é crédito, indexadores, garantias e inadimplência, não vacância física de imóveis.",
            },
        ],
    },
    {
        title: "Índices, mercado e liquidez",
        intro: "Conceitos para entender se o fundo é acompanhado pelo mercado e fácil de negociar.",
        items: [
            {
                id: "ifix",
                term: "IFIX",
                text: "Índice de referência dos fundos imobiliários listados na B3. Quando um fundo participa do IFIX, ele tende a ter mais visibilidade, mas isso não significa recomendação de compra.",
            },
            {
                id: "liquidez",
                term: "Liquidez",
                text: "Mostra a facilidade de comprar ou vender cotas sem afetar muito o preço. Fundos com baixa liquidez podem dificultar entradas e saídas.",
            },
            {
                id: "risco-mercado",
                term: "Risco de mercado",
                text: "Mesmo um bom fundo pode cair se juros subirem, se o setor piorar ou se investidores reduzirem apetite por risco. Preço e qualidade nem sempre andam juntos no curto prazo.",
            },
        ],
    },
    {
        title: "Riscos de análise",
        intro: "Pontos que evitam conclusões apressadas ao olhar um indicador isolado.",
        items: [
            {
                id: "dy-alto",
                term: "DY alto demais",
                text: "Pode parecer atrativo, mas às vezes ocorre porque o preço caiu muito ou porque houve rendimento extraordinário. Sempre compare com qualidade, recorrência e risco.",
            },
            {
                id: "concentracao",
                term: "Concentração",
                text: "Fundos com poucos imóveis ou poucos inquilinos podem sofrer mais se um contrato for encerrado. Diversificação reduz esse risco, mas não elimina.",
            },
            {
                id: "gestao",
                term: "Gestão",
                text: "A qualidade da gestão influencia compras, vendas, renegociações, alavancagem e comunicação com cotistas. Um bom ativo mal administrado pode entregar resultado ruim.",
            },
        ],
    },
];

export default function GlossarioPage() {
    return (
        <main className="min-h-screen bg-white px-4 py-12 text-gray-900">
            <div className="mx-auto max-w-4xl">
                <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
                    ← Voltar para consulta
                </Link>

                <header className="mt-6 mb-10">
                    <h1 className="text-3xl font-bold">Glossário de FIIs</h1>
                    <p className="mt-3 text-gray-600">
                        Entenda os principais termos usados na análise de fundos imobiliários, agrupados por temas relacionados.
                    </p>
                </header>

                <nav className="mb-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <h2 className="mb-3 text-lg font-semibold">Temas</h2>
                    <div className="flex flex-wrap gap-2">
                        {groups.map((group) => (
                            <a
                                key={group.title}
                                href={`#${group.title.toLowerCase().replaceAll(" ", "-")}`}
                                className="rounded-full bg-white px-3 py-1 text-sm text-gray-700 shadow-sm hover:text-indigo-600"
                            >
                                {group.title}
                            </a>
                        ))}
                    </div>
                </nav>

                <div className="space-y-10">
                    {groups.map((group) => (
                        <section
                            key={group.title}
                            id={group.title.toLowerCase().replaceAll(" ", "-")}
                            className="rounded-2xl border border-gray-200 p-6 shadow-sm"
                        >
                            <h2 className="text-2xl font-bold">{group.title}</h2>
                            <p className="mt-2 text-gray-600">{group.intro}</p>

                            <div className="mt-6 space-y-5">
                                {group.items.map((item) => (
                                    <article key={item.id} id={item.id} className="scroll-mt-24">
                                        <h3 className="text-lg font-semibold text-gray-900">{item.term}</h3>
                                        <p className="mt-1 text-gray-700">{item.text}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <footer className="mt-12 rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-950">
                    Este glossário tem finalidade educativa e não é recomendação de compra ou venda.
                </footer>
            </div>
        </main>
    );
}
