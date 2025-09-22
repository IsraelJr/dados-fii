"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const GoogleAd = dynamic(() => import("./GoogleAd"), { ssr: false });

interface GoogleAdsBlockProps {
    onClose: () => void;
}

export default function GoogleAdsBlock({ onClose }: GoogleAdsBlockProps) {
    const [countdown, setCountdown] = useState(15);

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onClose]);

    const closeDisabled = countdown > 10; // bloqueado nos primeiros 5 segundos

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-transparent z-50">
            <div
                className="border rounded-lg shadow-md bg-white p-2 flex flex-col items-center justify-center"
                style={{ width: "10cm", height: "10cm" }}
            >
                <p className="text-xs text-gray-500 mb-1">Publicidade</p>

                {/* Google Ad */}
                <GoogleAd />

                <p className="mt-2 text-sm text-gray-700">
                    Liberando em {countdown}s
                </p>

                <button
                    onClick={onClose}
                    disabled={closeDisabled}
                    className={`mt-1 px-2 py-1 rounded text-xs ${closeDisabled
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
