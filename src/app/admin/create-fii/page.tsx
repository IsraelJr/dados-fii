'use client';

import { useState } from "react";
import PageHeader from "../../components/PageHeader";

type Result = {
  success?: boolean;
  ticker?: string;
  collection?: string;
  totalFields?: number;
  fields?: string[];
  error?: string;
};

export default function CreateFiiAdminPage() {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [socialReason, setSocialReason] = useState("");
  const [segment, setSegment] = useState("");
  const [segmentNew, setSegmentNew] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [modelTicker, setModelTicker] = useState("TGAR11");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/create-fii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          name,
          socialReason,
          segment,
          segmentNew,
          cnpj,
          modelTicker,
        }),
      });

      const json = await response.json();
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || "Erro ao criar fundo." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Cadastrar Fundo"
        subtitle="Crie um novo documento na coleção Fiis usando a estrutura de campos de um fundo modelo."
        backLabel="← Voltar para consulta"
      />

      <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ticker" value={ticker} onChange={(value) => setTicker(value.toUpperCase())} placeholder="Ex: BODB11" />
          <Field label="Fundo modelo" value={modelTicker} onChange={(value) => setModelTicker(value.toUpperCase())} placeholder="Ex: TGAR11" />
          <Field label="Nome" value={name} onChange={setName} placeholder="Ex: BODB11" />
          <Field label="Razão social" value={socialReason} onChange={setSocialReason} placeholder="Razão social do fundo" />
          <Field label="Segmento" value={segment} onChange={setSegment} placeholder="Ex: Papel, Tijolo, Fiagro" />
          <Field label="Segmento novo" value={segmentNew} onChange={setSegmentNew} placeholder="Pode repetir o segmento" />
          <Field label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0001-00" />
        </div>

        <div className="mt-5 rounded-xl bg-gray-800 p-4 text-sm font-medium text-gray-300">
          O cadastro copia a estrutura de campos do fundo modelo, limpa os valores e grava o novo documento em <strong className="text-white">Fiis/{ticker.trim().toUpperCase() || "TICKER"}</strong>.
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading || !ticker.trim()}
          className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        >
          {loading ? "Criando..." : "Criar fundo"}
        </button>

        {result && (
          <div className={`mt-5 rounded-xl p-4 text-sm font-medium ${result.success ? "bg-green-500/10 text-green-200" : "bg-red-500/10 text-red-200"}`}>
            {result.success ? (
              <div>
                <p className="font-bold">{result.ticker} criado em {result.collection}.</p>
                <p className="mt-1">Campos criados: {result.totalFields}</p>
                {!!result.fields?.length && (
                  <p className="mt-2 text-xs text-green-100/80">{result.fields.join(", ")}</p>
                )}
              </div>
            ) : (
              <p>{result.error}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-gray-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
      />
    </label>
  );
}
