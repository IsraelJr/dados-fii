'use client';

import { useState } from "react";
import { Loader2, Send, Star } from "lucide-react";

export default function SiteFeedback() {
    const [rating, setRating] = useState(0);
    const [kind, setKind] = useState("Elogio");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    async function submitFeedback() {
        setStatus("");
        setError("");

        if (!rating && !message.trim()) {
            setError("Informe uma nota ou comentário antes de enviar.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/site-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind,
                    rating,
                    message: message.trim(),
                    page: window.location.href,
                }),
            });
            const json = await response.json().catch(() => ({}));

            if (!response.ok || !json?.ok) {
                throw new Error(json?.error || "Não foi possível enviar o feedback agora.");
            }

            setStatus("Obrigado! Seu feedback foi enviado.");
            setMessage("");
            setRating(0);
            setKind("Elogio");
        } catch (err: any) {
            setError(err.message || "Não foi possível enviar o feedback agora.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="rounded-2xl bg-gray-900 p-5 text-left text-gray-100 shadow-lg ring-1 ring-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                    <p className="text-sm font-bold uppercase tracking-wide text-indigo-300">Ajude a melhorar</p>
                    <h2 className="mt-2 text-xl font-extrabold text-white">O que você achou do Dados FII?</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-300">
                        Envie uma crítica, elogio ou sugestão.
                    </p>
                </div>

                <div className="grid w-full gap-3 md:max-w-md">
                    <div className="flex flex-wrap gap-2">
                        {["Elogio", "Crítica", "Sugestão"].map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setKind(option)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind === option ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-200 hover:bg-gray-700"}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1" aria-label="Nota do site">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setRating(value)}
                                className={value <= rating ? "text-yellow-300" : "text-gray-600 hover:text-yellow-200"}
                                aria-label={`Dar nota ${value}`}
                            >
                                <Star size={24} fill={value <= rating ? "currentColor" : "none"} />
                            </button>
                        ))}
                        <span className="ml-2 text-sm font-medium text-gray-300">{rating ? `${rating}/5` : "Sem nota"}</span>
                    </div>

                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Escreva seu comentário aqui..."
                        rows={4}
                        maxLength={1200}
                        className="min-h-28 rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
                    />

                    <button
                        type="button"
                        onClick={submitFeedback}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        Enviar feedback
                    </button>

                    {status && <p className="rounded-lg bg-green-950/50 p-3 text-sm font-bold text-green-200">{status}</p>}
                    {error && <p className="rounded-lg bg-red-950/50 p-3 text-sm font-bold text-red-200">{error}</p>}
                </div>
            </div>
        </section>
    );
}
