import type { Metadata } from "next";
import { BookOpen, ExternalLink, GraduationCap, PiggyBank } from "lucide-react";
import PageHeader from "../components/PageHeader";

export const metadata: Metadata = {
  title: "Educação Financeira",
  description:
    "Aprenda conceitos básicos sobre dinheiro, FIIs, dividendos, data-com, dividend yield, P/VP e carteira de fundos imobiliários com exemplos simples.",
  alternates: {
    canonical: "/educacao",
  },
};

const articles = [
  {
    title: "O que é data-com em FIIs?",
    tag: "Dividendos",
    intro:
      "Data-com é o último dia em que você precisa ter a cota do fundo na carteira para ter direito ao próximo rendimento anunciado.",
    example:
      "Exemplo: se um FII informa data-com em 10/07 e pagamento em 17/07, quem termina o dia 10/07 com cotas na carteira recebe o rendimento no dia 17/07. Quem comprar no dia 11/07, normalmente não recebe esse pagamento específico.",
    practicalTip:
      "Antes de comprar só por causa do dividendo, veja o preço da cota, a qualidade do fundo e se o rendimento é recorrente. Comprar apenas pela data-com pode gerar uma decisão ruim.",
  },
  {
    title: "O que é dividend yield mensal?",
    tag: "Rendimento",
    intro:
      "Dividend yield mensal é uma forma simples de comparar quanto o rendimento pago representa em relação ao preço da cota.",
    example:
      "Exemplo: se a cota custa R$ 100,00 e o fundo paga R$ 1,00 no mês, o DY mensal é de 1%. Se a cota custa R$ 50,00 e paga R$ 0,50, o DY mensal também é 1%.",
    practicalTip:
      "DY alto não significa automaticamente que o fundo é bom. Pode ser sinal de oportunidade, mas também pode indicar risco, queda da cota ou rendimento não recorrente.",
  },
  {
    title: "O que é P/VP em fundo imobiliário?",
    tag: "Preço e valor",
    intro:
      "P/VP compara o preço da cota no mercado com o valor patrimonial por cota informado pelo fundo.",
    example:
      "Exemplo: se o valor patrimonial por cota é R$ 100,00 e a cota negocia a R$ 80,00, o P/VP é 0,80. Isso indica que o fundo está sendo negociado abaixo do valor patrimonial. Se negocia a R$ 120,00, o P/VP é 1,20.",
    practicalTip:
      "P/VP abaixo de 1 pode indicar desconto, mas não garante boa compra. É preciso entender por que o mercado está pagando menos: risco do fundo, qualidade dos imóveis, vacância, dívida, gestão ou queda dos rendimentos.",
  },
  {
    title: "Como saber quando um FII paga dividendos?",
    tag: "Calendário",
    intro:
      "Os FIIs costumam informar seus pagamentos por meio de comunicados, relatórios, páginas da administradora e dados de mercado.",
    example:
      "Exemplo: um fundo pode anunciar rendimento de R$ 0,80 por cota, com data-com em 28/06 e pagamento em 07/07. Essas datas ajudam o investidor a saber quando terá direito ao rendimento e quando o dinheiro cai na conta da corretora.",
    practicalTip:
      "Use o calendário de dividendos como apoio, mas confirme informações importantes nos comunicados oficiais do fundo ou da administradora.",
  },
  {
    title: "Como montar uma carteira de FIIs?",
    tag: "Carteira",
    intro:
      "Montar uma carteira de FIIs é escolher fundos diferentes para reduzir a dependência de um único ativo, segmento ou gestor.",
    example:
      "Exemplo: uma carteira pode ter fundos de tijolo, fundos de papel, fundos híbridos e FIAGROs. Assim, se um segmento passar por dificuldade, toda a carteira não depende apenas dele.",
    practicalTip:
      "Para começar, evite concentrar tudo em um único FII. Acompanhe segmento, qualidade da gestão, histórico de rendimentos, vacância, inadimplência e riscos antes de aumentar posição.",
  },
  {
    title: "O que significa um FII estar com desconto patrimonial?",
    tag: "Ágio e desconto",
    intro:
      "Um FII está com desconto patrimonial quando o preço da cota no mercado está abaixo do valor patrimonial por cota.",
    example:
      "Exemplo: se o valor patrimonial por cota é R$ 100,00 e a cota está sendo negociada a R$ 70,00, ela está com desconto de aproximadamente 30% em relação ao patrimônio.",
    practicalTip:
      "Desconto não é garantia de lucro. Às vezes o desconto existe porque o mercado vê risco real no fundo, como imóveis problemáticos, queda de renda, alavancagem, vacância alta ou baixa confiança na gestão.",
  },
];

const books = [
  {
    title: "A Moedinha de Léo",
    publisher: "Dados FII",
    category: "Educação financeira infantil",
    status: "Disponível na Amazon",
    description:
      "Uma história infantil sobre escolhas, paciência e o primeiro contato da criança com o dinheiro, feita para aproximar pais e filhos de conversas simples sobre educação financeira.",
    audience: "Crianças, pais e educadores",
    href: "https://www.amazon.com.br/dp/B0H6Y7VS9C?dplnkId=077632c1-bf54-456d-8e9f-607a32bff63b&nodl=1",
  },
];

export default function EducationPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Educação Financeira"
        subtitle="Conceitos simples para entender melhor dinheiro, dividendos e fundos imobiliários antes de investir."
      />

      <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-200">
          <GraduationCap size={14} /> Aprenda sem complicar
        </p>
        <h2 className="mt-3 text-2xl font-extrabold text-white">FIIs explicados para quem está começando</h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-gray-300">
          Esta área reúne explicações curtas, exemplos práticos e materiais de leitura para ajudar você a administrar melhor seu dinheiro, acompanhar rendimentos e tomar decisões com mais consciência.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {articles.map((article) => (
          <article key={article.title} className="rounded-2xl bg-white p-5 text-slate-700 shadow-sm ring-1 ring-slate-200">
            <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              {article.tag}
            </p>
            <h2 className="mt-3 text-xl font-extrabold text-slate-800">{article.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.intro}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Exemplo prático</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{article.example}</p>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Atenção</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">{article.practicalTip}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-200">
            <PiggyBank size={14} /> Leitura
          </p>
          <h2 className="mt-3 text-2xl font-extrabold text-white">Livros sobre dinheiro e bons hábitos</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-gray-300">
            Conteúdos para entender melhor como administrar, guardar e usar o dinheiro com mais consciência no dia a dia.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {books.map((book) => (
          <article key={book.title} className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
                <BookOpen size={26} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-300">{book.category}</p>
                <h3 className="mt-1 text-2xl font-extrabold text-white">{book.title}</h3>
                <p className="mt-1 text-sm font-medium text-gray-300">Publicado por: {book.publisher}</p>
              </div>
            </div>

            <p className="mt-4 text-sm font-medium leading-6 text-gray-200">{book.description}</p>

            <div className="mt-4 grid gap-3 rounded-xl bg-gray-800 p-4 ring-1 ring-white/5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Público</p>
                <p className="mt-1 text-sm font-bold text-gray-100">{book.audience}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Status</p>
                <p className="mt-1 text-sm font-bold text-green-300">{book.status}</p>
              </div>
            </div>

            <a
              href={book.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Ver na Amazon <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
