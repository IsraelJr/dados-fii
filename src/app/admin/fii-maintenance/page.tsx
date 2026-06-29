'use client';

import { useState } from "react";

type Action = "cnpj" | "dividends" | "both";

type LogItem = {
    message: string;
    type?: "info" | "success" | "error";
};

export default function FiiMaintenancePage() {
    const [secret, setSecret] = useState("");
    const [action, setAction] = useState<Action>("both");
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [limit, setLimit] = useState("5");
    const [cursor, setCursor] = useState("");
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<LogItem[]>([]);

    const addLog = (message: string, type: LogItem["type"] = "info") => {
        setLogs((prev) => [{ message, type }, ...prev].slice(0, 80));
    };

    const runBatch = async (currentCursor: string) => {
        const res = await fetch("/api/admin/fii-maintenance", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-secret": secret,
            },
            body: JSON.stringify({
                action,
                year: Number(year),
                limit: Number(limit),
                cursor: currentCursor || undefined,
                secret,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao executar lote.");
        return data;
    };

    const start = async () => {
        if (!secret.trim()) {
            addLog("Informe a senha temporária ADMIN_UPDATE_SECRET.", "error");
            return;
        }

        setRunning(true);
        let currentCursor = cursor;

        try {
            addLog(`Iniciando manutenção: ${action}, ano ${year}, lote ${limit}.`);

            while (true) {
                const data = await runBatch(currentCursor);
                const ok = data.updated || 0;
                const fail = data.failed || 0;

                addLog(
                    `Lote processado. Atualizados: ${ok}. Falhas: ${fail}. Próximo cursor: ${data.nextCursor || "fim"}.`,
                    fail > 0 ? "error" : "success"
                );

                for (const item of data.results || []) {
                    if (item.ok) addLog(`${item.ticker}: OK (${(item.updatedFields || []).join(", ")})`, "success");
                    else addLog(`${item.ticker}: ERRO - ${item.error}`, "error");
                }

                setCursor(data.nextCursor || "");
                currentCursor = data.nextCursor || "";

                if (!data.hasMore) {
                    addLog("Manutenção concluída.", "success");
                    break;
                }
            }
        } catch (err: any) {
            addLog(err.message || "Erro inesperado.", "error");
        } finally {
            setRunning(false);
        }
    };

    const runOneBatch = async () => {
        if (!secret.trim()) {
            addLog("Informe a senha temporária ADMIN_UPDATE_SECRET.", "error");
            return;
        }

        setRunning(true);
        try {
            const data = await runBatch(cursor);
            setCursor(data.nextCursor || "");
            addLog(`Um lote executado. Atualizados: ${data.updated}. Falhas: ${data.failed}.`, data.failed > 0 ? "error" : "success");
        } catch (err: any) {
            addLog(err.message || "Erro inesperado.", "error");
        } finally {
            setRunning(false);
        }
    };

    return (
        <main className="mx-auto max-w-4xl p-6 text-left text-gray-900">
            <h1 className="mb-2 text-2xl font-bold">Manutenção temporária de FIIs</h1>
            <p className="mb-6 text-sm text-gray-600">
                Use apenas enquanto estiver atualizando a base. Depois, remova esta página e a rota temporária.
            </p>

            <div className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2">
                <label className="block">
                    <span className="text-sm font-semibold">Senha ADMIN_UPDATE_SECRET</span>
                    <input
                        type="password"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                        placeholder="Senha temporária"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Ação</span>
                    <select
                        value={action}
                        onChange={(e) => setAction(e.target.value as Action)}
                        className="mt-1 w-full rounded-lg border p-2"
                    >
                        <option value="both">CNPJ + dividendos</option>
                        <option value="cnpj">Somente CNPJ</option>
                        <option value="dividends">Somente dividendos</option>
                    </select>
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Ano</span>
                    <input
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Tamanho do lote</span>
                    <input
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </label>

                <label className="block md:col-span-2">
                    <span className="text-sm font-semibold">Cursor</span>
                    <input
                        value={cursor}
                        onChange={(e) => setCursor(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-lg border p-2"
                        placeholder="Deixe vazio para começar do início"
                    />
                </label>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                    <button
                        type="button"
                        onClick={runOneBatch}
                        disabled={running}
                        className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                        Executar 1 lote
                    </button>
                    <button
                        type="button"
                        onClick={start}
                        disabled={running}
                        className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                    >
                        Executar até o fim
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setCursor("");
                            setLogs([]);
                        }}
                        disabled={running}
                        className="rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-800 disabled:bg-gray-100"
                    >
                        Resetar
                    </button>
                </div>
            </div>

            <section className="mt-6 rounded-2xl bg-gray-950 p-4 text-sm text-gray-100">
                <h2 className="mb-3 font-bold">Logs</h2>
                {logs.length === 0 ? (
                    <p className="text-gray-400">Nenhum log ainda.</p>
                ) : (
                    <ul className="space-y-2">
                        {logs.map((log, index) => (
                            <li
                                key={`${log.message}-${index}`}
                                className={log.type === "error" ? "text-red-300" : log.type === "success" ? "text-green-300" : "text-gray-100"}
                            >
                                {log.message}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
