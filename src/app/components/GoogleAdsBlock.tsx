"use client";

import { useEffect, useMemo, useState } from "react";
import GoogleAd from "./GoogleAd";

interface GoogleAdsBlockProps {
    onClose: () => void;
}

const TOTAL_SECONDS = 15;
const BUTTON_LOCK_SECONDS = 5;

export default function GoogleAdsBlock({ onClose }: GoogleAdsBlockProps) {
    const [countdown, setCountdown] = useState(TOTAL_SECONDS);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const interval = window.setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    window.clearInterval(interval);
                    onClose();
                    return 0;
                }

                return prev - 1;
            });
        }, 1000);

        return () => window.clearInterval(interval);
    }, [mounted, onClose]);

    const closeDisabled = countdown > TOTAL_SECONDS - BUTTON_LOCK_SECONDS;

    const buttonLabel = useMemo(() => {
        if (closeDisabled) {
            return `Fechar em ${countdown - (TOTAL_SECONDS - BUTTON_LOCK_SECONDS)}s`;
        }

        return "Fechar";
    }, [closeDisabled, countdown]);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="flex w-full max-w-[380px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-2xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Publicidade
                </p>

                <div className="flex h-[250px] w-[300px] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <GoogleAd />
                </div>

                <p className="mt-3 text-sm text-gray-700">
                    O conteúdo será liberado automaticamente em {countdown}s.
                </p>

                <button
                    type="button"
                    onClick={onClose}
                    disabled={closeDisabled}
                    className={`mt-3 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${closeDisabled
                        ? "cursor-not-allowed bg-gray-300 text-gray-600"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                >
                    {buttonLabel}
                </button>
            </div>
        </div>
    );
}
