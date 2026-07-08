'use client';

import { useState } from "react";
import { Loader2, MessageSquare, Send, Star } from "lucide-react";

export default function SiteFeedback() {
    const [rating, setRating] = useState(0);
    const [kind, setKind] = useState("Sugestão");
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
            setKind("Sugestão");
        } catch (err: any) {
            setError(err.message || "Não foi possível enviar o feedback agora.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                        <MessageSquare size={14} /> Ajude a melhorar
                    </p>
                    <h2 className="mt-3 text-xl font-extrabold text-slate-800">Sua opinião ajuda o Dados FII a evoluir</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Envie uma crítica, elogio ou sugestão rápida sobre o site.
                    </p>
                </div>

                <div className="grid min-w-0 gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {["Sugestão", "Crítica", "Elogio"].map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setKind(option)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === option ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2" aria-label="Nota do site">
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setRating(value)}
                                    className={value <= rating ? "text-yellow-500" : "text-slate-300 hover:text-yellow-400"}
                                    aria-label={`Dar nota ${value}`}
                                >
                                    <Star size={20} fill={value <= rating ? "currentColor" : "none"} />
                                </button>
                            ))}
                        </div>
                        <span className="text-xs font-bold text-slate-500">{rating ? `${rating}/5` : "Nota opcional"}</span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <textarea
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder="Escreva um comentário curto..."
                            rows={2}
                            maxLength={700}
                            className="min-h-20 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-50"
                        />

                        <button
                            type="button"
                            onClick={submitFeedback}
                            disabled={loading}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:self-end"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            Enviar
                        </button>
                    </div>

                    {(status || error) && (
                        <p className={`rounded-xl p-3 text-sm font-bold ${status ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {status || error}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
