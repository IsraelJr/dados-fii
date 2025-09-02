'use client';

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";

interface Props {
    fiiCode: string;
    isPremium?: boolean;
}

export default function FiiAlert({ fiiCode, isPremium = true }: Props) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [open, setOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const emailRef = useRef<HTMLInputElement>(null);

    // Gerencia barra de progresso e fechamento automático
    useEffect(() => {
        let timer: NodeJS.Timeout;
        let interval: NodeJS.Timeout;

        if (success) {
            setProgress(0);

            const totalTime = 2500; // 2.5 segundos
            const intervalTime = 40;
            const increment = 100 / (totalTime / intervalTime);

            interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + increment;
                });
            }, intervalTime);

            timer = setTimeout(() => {
                setOpen(false);
                setSuccess(false);
                setProgress(0);
                setEmail("");
                setMessage("");
            }, totalTime);
        }

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [success]);

    const handleSubmit = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !emailRegex.test(email)) {
            setMessage("Por favor, informe um email válido.");

            // Efeito de vibração caso email inválido
            if (emailRef.current) {
                emailRef.current.classList.add("shake");
                setTimeout(() => emailRef.current?.classList.remove("shake"), 500);
            }

            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const res = await fetch("/api/add-alert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, fiiCode, isPremium }),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setMessage("✅ Alerta programado com sucesso!");
                setSuccess(true);
            } else {
                setMessage(`❌ Falha ao configurar alerta: ${json.error || "Erro desconhecido"}`);
            }
        } catch (err: any) {
            console.error(err);
            setMessage("❌ Falha ao configurar alerta. Tente novamente mais tarde.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative inline-block">
            {/* Botão do sino */}
            <button
                onClick={() => setOpen(!open)}
                className="rounded-full p-2 hover:bg-gray-700 transition-colors"
            >
                <Bell className="h-5 w-5 text-yellow-400" />
            </button>

            {/* Popover tipo balão */}
            <div
                className={`absolute right-0 mt-2 w-80 bg-gray-900 text-white rounded-xl shadow-xl border border-gray-700 p-4 z-50 transform transition-all duration-300 origin-top-right ${open ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    }`}
            >
                <h3 className="text-lg font-bold mb-2">Alerta {fiiCode}</h3>
                <p className="text-gray-300 mb-3 text-sm">
                    O alerta dispara ao variar 3%.
                    {isPremium && "\nComo usuário premium, você pode alterar os percentuais."}
                </p>

                <label className="block text-left mb-1 text-gray-300 text-sm">Email:</label>
                <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-800 text-white mb-3 transition-all"
                    disabled={success}
                />

                <button
                    onClick={handleSubmit}
                    disabled={loading || success}
                    className={`w-full py-2 rounded-lg font-bold ${loading || success
                        ? "bg-gray-600 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                        } text-white`}
                >
                    {loading ? "Salvando..." : success ? "Enviado" : "Enviar"}
                </button>

                {message && <p className="mt-3 text-center text-sm">{message}</p>}

                {/* Barra de progresso */}
                {success && (
                    <div className="w-full h-1 bg-gray-700 rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-1 bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>

            {/* CSS para vibração */}
            <style jsx>{`
                @keyframes shake {
                    0% { transform: translateX(0); }
                    20% { transform: translateX(-5px); }
                    40% { transform: translateX(5px); }
                    60% { transform: translateX(-5px); }
                    80% { transform: translateX(5px); }
                    100% { transform: translateX(0); }
                }
                .shake {
                    animation: shake 0.5s;
                }
            `}</style>
        </div>
    );
}
