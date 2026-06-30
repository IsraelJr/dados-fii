import Link from "next/link";
import { BookOpen, ExternalLink, PiggyBank } from "lucide-react";
import PageHeader from "../components/PageHeader";

const books = [
  {
    title: "A Moedinha de Léo",
    author: "Israel Alves",
    category: "Educação financeira infantil",
    status: "Disponível na Amazon",
    description:
      "Uma história infantil sobre escolhas, paciência e o primeiro contato da criança com o dinheiro, feita para aproximar pais e filhos de conversas simples sobre educação financeira.",
    audience: "Crianças, pais e educadores",
    href: "https://www.amazon.com.br/dp/B0H6Y7VS9C?dplnkId=077632c1-bf54-456d-8e9f-607a32bff63b&nodl=1",
  },
];

export default function BooksPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Cantinho da Leitura"
        subtitle="Livros e materiais para aprender sobre dinheiro, escolhas e investimentos com linguagem simples."
      />

      <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-200">
              <PiggyBank size={14} /> Educação financeira
            </p>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Leitura para formar bons hábitos</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium text-gray-300">
              Este espaço reúne obras autorais e indicações de leitura que combinam com a proposta do Dados FII: entender dinheiro com clareza, sem complicar.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          >
            Voltar para consulta
          </Link>
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
                <p className="mt-1 text-sm font-medium text-gray-300">Autor: {book.author}</p>
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

            {book.href ? (
              <a
                href={book.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Ver na Amazon <ExternalLink size={14} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-5 inline-flex cursor-not-allowed items-center justify-center rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-gray-300 ring-1 ring-white/10"
              >
                Link da Amazon em breve
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
