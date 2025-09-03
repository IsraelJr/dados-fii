'use client';

import { useState, useEffect, useRef } from "react";
import { Bell, BellRing, ArrowDown, ArrowUp } from "lucide-react";

interface Props {
    fiiCode: string;
}

export default function FiiAlert({ fiiCode }: Props) {
    const ALERT_VALUE = Number(process.env.NEXT_PUBLIC_DEFAULT_ALERT_VALUE);
    const [email, setEmail] = useState("");
    const [percentDown, setPercentDown] = useState(-ALERT_VALUE);
    const [percentUp, setPercentUp] = useState(ALERT_VALUE);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [open, setOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isPremium, setIsPremium] = useState(false);
    const [alertCreated, setAlertCreated] = useState(false);

    const emailRef = useRef<HTMLInputElement>(null);

    // Buscar user do Firebase
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/get-user");
                if (res.ok) {
                    const data = await res.json();
                    setIsPremium(data?.isPremium || false);
                }
            } catch (err) {
                console.error("Erro ao buscar usuário:", err);
            }
        };

        fetchUser();
    }, []);

    // Gerencia barra de progresso
    useEffect(() => {
        let timer: NodeJS.Timeout;
        let interval: NodeJS.Timeout;

        if (success) {
            setProgress(0);

            const totalTime = 2500;
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
                setPercentDown(-ALERT_VALUE);
                setPercentUp(ALERT_VALUE);
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
                body: JSON.stringify({
                    email,
                    fiiCode,
                    isPremium,
                    percentUp,
                    percentDown,
                }),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setMessage("✅ Alerta programado com sucesso!");
                setSuccess(true);
                setAlertCreated(true); // muda o sino
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

    const handleChangeDown = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value <= -1 && value >= -20) {
            setPercentDown(value);
        } else if (e.target.value === "") {
            setPercentDown(0);
        }
    };

    const handleChangeUp = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 20) {
            setPercentUp(value);
        } else if (e.target.value === "") {
            setPercentUp(0);
        }
    };

    return (
        <div className="relative inline-block">
            {/* Botão do sino */}
            <button
                onClick={() => setOpen(!open)}
                className="rounded-full p-2 hover:bg-gray-700 transition-colors"
            >
                {alertCreated ? (
                    <BellRing className="h-5 w-5 text-green-500" />
                ) : (
                    <Bell className="h-5 w-5 text-yellow-400" />
                )}
            </button>

            {/* Popover */}
            <div
                className={`absolute right-0 mt-2 w-80 bg-gray-900 text-white rounded-xl shadow-xl border border-gray-700 p-4 z-50 transform transition-all duration-300 origin-top-right ${open ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    }`}
            >
                <h3 className="text-lg font-bold mb-2">Alerta {fiiCode}</h3>
                <p className="text-gray-300 mb-3 text-sm">
                    O alerta dispara ao variar {ALERT_VALUE}%.
                    {isPremium && " Como usuário premium, você pode alterar o percentual."}
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

                {isPremium && (
                    <div className="flex justify-between gap-3">
                        {/* Campo de baixa */}
                        <div className="flex items-center gap-2">
                            <ArrowDown className="text-red-500 w-5 h-5" />
                            <input
                                type="number"
                                min={-20}
                                max={-1}
                                value={percentDown}
                                onChange={handleChangeDown}
                                className="w-20 text-center p-2 rounded-lg bg-gray-800 text-white"
                                disabled={success}
                            />
                        </div>

                        {/* Campo de alta */}
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={percentUp}
                                onChange={handleChangeUp}
                                className="w-20 text-center p-2 rounded-lg bg-gray-800 text-white"
                                disabled={success}
                            />
                            <ArrowUp className="text-green-500 w-5 h-5" />
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={loading || success}
                    className={`w-full mt-3 py-2 rounded-lg font-bold ${loading || success
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        } text-white`}
                >
                    {loading ? "Salvando..." : success ? "Enviado" : "Enviar"}
                </button>

                {message && <p className="mt-3 text-center text-sm">{message}</p>}

                {success && (
                    <div className="w-full h-1 bg-gray-700 rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-1 bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
