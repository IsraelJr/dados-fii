'use client';

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type AppToastProps = {
  message: string;
  variant?: "success" | "error" | "warning" | "info";
  onClose: () => void;
  durationMs?: number;
};

const variantClasses: Record<NonNullable<AppToastProps["variant"]>, string> = {
  success: "border-green-200 bg-white text-slate-900 shadow-green-900/10",
  error: "border-red-200 bg-white text-slate-900 shadow-red-900/10",
  warning: "border-yellow-200 bg-white text-slate-900 shadow-yellow-900/10",
  info: "border-indigo-200 bg-white text-slate-900 shadow-indigo-900/10",
};

const iconClasses: Record<NonNullable<AppToastProps["variant"]>, string> = {
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-yellow-600",
  info: "text-indigo-600",
};

function ToastIcon({ variant }: { variant: NonNullable<AppToastProps["variant"]> }) {
  const className = iconClasses[variant];

  if (variant === "success") return <CheckCircle2 className={className} size={20} />;
  if (variant === "error") return <AlertCircle className={className} size={20} />;
  if (variant === "warning") return <AlertCircle className={className} size={20} />;
  return <Info className={className} size={20} />;
}

export default function AppToast({ message, variant = "info", onClose, durationMs = 3000 }: AppToastProps) {
  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timeout);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  return (
    <div className="fixed left-0 right-0 top-4 z-[100] flex justify-center px-4 pt-[env(safe-area-inset-top)] pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur animate-[toastIn_180ms_ease-out] ${variantClasses[variant]}`}
      >
        <div className="mt-0.5 shrink-0">
          <ToastIcon variant={variant} />
        </div>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fechar aviso"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
