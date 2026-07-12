"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, BellRing, CheckCheck, ChevronRight, CircleDollarSign, Info, Loader2, ShieldAlert, X } from "lucide-react";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const HIDDEN_TOASTS_KEY = "dados-fii-notification-toast-hidden-v1";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

type NotificationSeverity = "info" | "success" | "warning" | "critical";
type NotificationItem = {
  id: string;
  type: string;
  ticker?: string | null;
  title: string;
  message: string;
  severity: NotificationSeverity;
  actionUrl: string;
  createdAt?: string | null;
  readAt?: string | null;
  emailSentAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Agora";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Agora";
  }
}

function readHiddenToastIds() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(HIDDEN_TOASTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function hideToastForSession(id: string) {
  try {
    const next = Array.from(new Set([id, ...readHiddenToastIds()])).slice(0, 50);
    window.sessionStorage.setItem(HIDDEN_TOASTS_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function severityClasses(severity: NotificationSeverity) {
  if (severity === "critical") return "border-red-300 bg-red-50 text-red-950";
  if (severity === "warning") return "border-amber-300 bg-amber-50 text-amber-950";
  if (severity === "success") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  return "border-indigo-200 bg-indigo-50 text-indigo-950";
}

function severityIcon(severity: NotificationSeverity) {
  if (severity === "critical") return <ShieldAlert size={18} className="text-red-600" />;
  if (severity === "warning") return <AlertTriangle size={18} className="text-amber-600" />;
  if (severity === "success") return <CircleDollarSign size={18} className="text-emerald-600" />;
  return <Info size={18} className="text-indigo-600" />;
}

export default function UserNotificationCenter() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [toastItem, setToastItem] = useState<NotificationItem | null>(null);
  const [error, setError] = useState("");

  const request = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!email || !sessionToken) throw new Error("Sessão da carteira não encontrada.");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action, email, sessionToken, ...payload }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível consultar notificações.");
    return json;
  }, [email, sessionToken]);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!email || !sessionToken) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const json = await request("list", { limit: 60 });
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setUnreadCount(Number(json.unreadCount || 0));
      setReady(true);

      const hidden = readHiddenToastIds();
      const newestUnread = nextItems.find((item: NotificationItem) => !item.readAt && !hidden.includes(item.id));
      setToastItem((current) => {
        if (current && nextItems.some((item: NotificationItem) => item.id === current.id && !item.readAt)) return current;
        return newestUnread || null;
      });
    } catch (err: any) {
      const message = err.message || "Não foi possível consultar notificações.";
      if (message.toLowerCase().includes("sessão expirada")) {
        setReady(false);
        setItems([]);
        setUnreadCount(0);
        setToastItem(null);
      } else {
        setError(message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [email, sessionToken, request]);

  useEffect(() => {
    const storedEmail = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const storedToken = String(window.localStorage.getItem(TOKEN_KEY) || "");
    setEmail(storedEmail);
    setSessionToken(storedToken);
  }, []);

  useEffect(() => {
    if (!email || !sessionToken) return;
    loadNotifications();

    const interval = window.setInterval(() => loadNotifications(true), POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadNotifications(true);
    };
    const onWalletSessionChanged = () => {
      const storedEmail = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
      const storedToken = String(window.localStorage.getItem(TOKEN_KEY) || "");
      setEmail(storedEmail);
      setSessionToken(storedToken);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onWalletSessionChanged);
    window.addEventListener("wallet-session-updated", onWalletSessionChanged);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onWalletSessionChanged);
      window.removeEventListener("wallet-session-updated", onWalletSessionChanged);
    };
  }, [email, sessionToken, loadNotifications]);

  const unreadItems = useMemo(() => items.filter((item) => !item.readAt), [items]);

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt } : entry));
    setUnreadCount((current) => Math.max(current - 1, 0));
    if (toastItem?.id === item.id) setToastItem(null);
    request("mark-read", { id: item.id }).catch(() => loadNotifications(true));
  }

  async function openNotification(item: NotificationItem) {
    await markRead(item);
    setOpen(false);
    router.push(item.actionUrl || "/carteira");
  }

  async function dismissNotification(item: NotificationItem) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (!item.readAt) setUnreadCount((current) => Math.max(current - 1, 0));
    if (toastItem?.id === item.id) setToastItem(null);
    try {
      await request("dismiss", { id: item.id });
    } catch {
      loadNotifications(true);
    }
  }

  async function markAllRead() {
    if (!unreadItems.length) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    setUnreadCount(0);
    setToastItem(null);
    try {
      await request("mark-all-read");
    } catch {
      loadNotifications(true);
    }
  }

  function closeToast() {
    if (toastItem) hideToastForSession(toastItem.id);
    setToastItem(null);
  }

  if (!email || !sessionToken || (!ready && !loading)) return null;

  return (
    <>
      {toastItem && !open && (
        <aside className={`fixed right-3 top-20 z-[70] w-[calc(100%-1.5rem)] max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${severityClasses(toastItem.severity)}`} role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 p-4">
            <div className="mt-0.5 shrink-0">{severityIcon(toastItem.severity)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wide opacity-70">Nova notificação</p>
              <p className="mt-1 text-sm font-black">{toastItem.title}</p>
              <p className="mt-1 line-clamp-3 text-xs font-medium leading-5 opacity-80">{toastItem.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openNotification(toastItem)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800">Ver detalhes</button>
                <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/70 px-3 py-2 text-xs font-extrabold ring-1 ring-black/10 hover:bg-white">Abrir central</button>
              </div>
            </div>
            <button type="button" onClick={closeToast} className="shrink-0 rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100" aria-label="Fechar aviso"><X size={17} /></button>
          </div>
        </aside>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-4 right-4 z-[65] inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl ring-4 ring-white hover:bg-indigo-700"
        aria-label={open ? "Fechar central de notificações" : "Abrir central de notificações"}
        aria-expanded={open}
      >
        {unreadCount > 0 ? <BellRing size={24} /> : <Bell size={24} />}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <aside className="fixed bottom-20 left-3 right-3 z-[64] flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:left-auto sm:w-[430px]" aria-label="Central de notificações">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 p-4 text-white">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-200">Sua carteira</p>
              <h2 className="mt-1 text-xl font-black">Notificações</h2>
              <p className="mt-1 text-xs font-medium text-slate-300">{unreadCount ? `${unreadCount} não lida(s)` : "Tudo em dia"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={markAllRead} disabled={!unreadItems.length} className="rounded-full p-2 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" title="Marcar todas como lidas" aria-label="Marcar todas como lidas"><CheckCheck size={19} /></button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-200 hover:bg-white/10" aria-label="Fechar central"><X size={19} /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
            {loading && !items.length && <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-500"><Loader2 size={18} className="animate-spin" /> Carregando notificações...</div>}
            {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{error}</p>}
            {!loading && !error && !items.length && (
              <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
                <Bell className="mx-auto text-indigo-600" />
                <p className="mt-3 text-sm font-black text-slate-900">Nenhuma notificação ainda</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Dividendos, resumos e alertas de risco da sua carteira aparecerão aqui.</p>
              </div>
            )}

            <div className="space-y-2">
              {items.map((item) => (
                <article key={item.id} className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${item.readAt ? "border-slate-200 opacity-80" : "border-indigo-300 ring-1 ring-indigo-100"}`}>
                  {!item.readAt && <span className="absolute left-0 top-0 h-full w-1 bg-indigo-600" />}
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 shrink-0 rounded-xl p-2 ${severityClasses(item.severity)}`}>{severityIcon(item.severity)}</div>
                    <button type="button" onClick={() => openNotification(item)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{item.title}</p>
                        <ChevronRight size={16} className="shrink-0 text-slate-400" />
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs font-medium leading-5 text-slate-600">{item.message}</p>
                      <p className="mt-2 text-[11px] font-bold text-slate-400">{formatDate(item.createdAt)}</p>
                    </button>
                    <button type="button" onClick={() => dismissNotification(item)} className="shrink-0 rounded-full p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label={`Remover notificação ${item.title}`}><X size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
