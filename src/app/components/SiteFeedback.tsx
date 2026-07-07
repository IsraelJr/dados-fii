'use client';

import { useMemo, useState } from "react";
import { Mail, Star } from "lucide-react";

const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "contato@dadosfii.com.br";

export default function SiteFeedback() {
    const [rating, setRating] = useState(0);
    const [kind, setKind] = useState("Elogio");
    const [message, setMessage] = useState("");

    const mailto = useMemo(() => {
        const subject = `Feedback Dados FII - ${kind} - Nota ${rating || "sem nota"}`;
        const body = [
            "Olá, equipe Dados FII!",
            "",
            `Tipo: ${kind}`,
            `Nota: ${rating || "Não informada"}/5`,
            "",
            "Mensagem:",
            message || "Escreva aqui sua crítica, elogio ou sugestão.",
            "",
            typeof window !== "undefined" ? `Página: ${window.location.href}` : "",
        ].filter(Boolean).join("\n");

        return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }, [kind, rating, message]);

    return (
        <section className="rounded-2xl bg-gray-900 p-5 text-left text-gray-100 shadow-lg ring-1 ring-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                    <p className="text-sm font-bold uppercase tracking-wide text-indigo-300">Ajude a melhorar</p>
                    <h2 className="mt-2 text-xl font-extrabold text-white">O que você achou do Dados FII?</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-300">
                        Envie uma crítica, elogio ou sugestão. Para evitar custo extra no banco agora, o envio abre seu app de e-mail já preenchido.
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
                        className="min-h-28 rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
                    />

                    <a
                        href={mailto}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700"
                    >
                        <Mail size={18} /> Enviar feedback
                    </a>
                </div>
            </div>
        </section>
    );
}
