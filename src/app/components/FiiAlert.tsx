'use client';

import { useState, useEffect, useRef } from "react";
import { Bell, BellRing, ArrowDown, ArrowUp } from "lucide-react";

interface Props {
    fiiCode: string;
}

export default function FiiAlert({ fiiCode }: Props) {
    const ALERT_VALUE = Number(process.env.NEXT_PUBLIC_DEFAULT_ALERT_VALUE || 3);
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
    }, [success, ALERT_VALUE]);

    const handleSubmit = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !emailRegex.test(email)) {
            setMessage("Informe um email válido para receber o alerta.");
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
                setMessage("Alerta criado com sucesso.");
                setSuccess(true);
                setAlertCreated(true);
                window.dispatchEvent(new Event("fiis-updated"));
            } else {
                setMessage(`Falha ao configurar alerta: ${json.error || "erro desconhecido"}`);
            }
        } catch (err: any) {
            console.error(err);
            setMessage("Falha ao configurar alerta. Tente novamente mais tarde.");
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
            <button
                onClick={() => setOpen(!open)}
                className="rounded-full p-2 transition-colors hover:bg-gray-700"
                aria-label={`Criar alerta para ${fiiCode}`}
            >
                {alertCreated ? (
                    <BellRing className="h-5 w-5 text-green-400" />
                ) : (
                    <Bell className="h-5 w-5 text-yellow-400" />
                )}
            </button>

            <div
                className={`absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-2xl border border-gray-700 bg-gray-900 p-4 text-white shadow-xl transition-all duration-300 ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}
            >
                <div className="mb-3 rounded-xl bg-gray-800 p-3 ring-1 ring-white/10">
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-200">Alerta de preço</p>
                    <h3 className="mt-1 text-lg font-extrabold text-white">Receba alertas do {fiiCode}</h3>
                    <p className="mt-2 text-sm font-medium text-gray-300">
                        Plano grátis: avisamos quando o FII subir ou cair {ALERT_VALUE}%.
                    </p>
                </div>

                <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                    <p className="text-sm font-bold text-indigo-100">
                        {isPremium ? "Premium ativo" : "Quer escolher o percentual?"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-300">
                        {isPremium
                            ? "Você pode ajustar os percentuais de queda e alta abaixo."
                            : "No Premium, você poderá personalizar os percentuais de alta e queda."}
                    </p>
                </div>

                <label className="mb-1 block text-left text-sm font-bold text-gray-300">Email para receber o alerta</label>
                <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
                    disabled={success}
                />

                {isPremium && (
                    <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-gray-300">Queda</label>
                            <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-2 py-1">
                                <ArrowDown className="h-5 w-5 text-red-400" />
                                <input
                                    type="number"
                                    min={-20}
                                    max={-1}
                                    value={percentDown}
                                    onChange={handleChangeDown}
                                    className="w-full bg-transparent p-1 text-center text-white outline-none"
                                    disabled={success}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold text-gray-300">Alta</label>
                            <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-2 py-1">
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={percentUp}
                                    onChange={handleChangeUp}
                                    className="w-full bg-transparent p-1 text-center text-white outline-none"
                                    disabled={success}
                                />
                                <ArrowUp className="h-5 w-5 text-green-400" />
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={loading || success}
                    className={`mt-1 w-full rounded-lg py-2 font-bold text-white ${loading || success
                        ? "cursor-not-allowed bg-gray-700 text-gray-400"
                        : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                >
                    {loading ? "Salvando..." : success ? "Alerta criado" : "Criar alerta"}
                </button>

                {message && <p className="mt-3 text-center text-sm font-medium text-gray-300">{message}</p>}

                {success && (
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-gray-700">
                        <div
                            className="h-1 bg-green-400 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
