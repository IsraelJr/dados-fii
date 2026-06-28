"use client";

import { useEffect, useRef, useState } from "react";

type AdsWindow = Window & {
    adsbygoogle?: Array<Record<string, unknown>>;
};

type GoogleAdProps = {
    slot?: string;
    className?: string;
    minHeight?: number;
};

const ADSENSE_CLIENT =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT ||
    process.env.NEXT_PUBLIC_ADS_OPEN ||
    "ca-pub-3245357129779122";

const DEFAULT_ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "4266399988";

export default function GoogleAd({
    slot = DEFAULT_ADSENSE_SLOT,
    className = "",
    minHeight = 280,
}: GoogleAdProps) {
    const adRef = useRef<HTMLModElement | null>(null);
    const pushedRef = useRef(false);
    const [adError, setAdError] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!adRef.current) return;
        if (pushedRef.current) return;

        const timeout = window.setTimeout(() => {
            try {
                const adsWindow = window as AdsWindow;
                adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
                adsWindow.adsbygoogle.push({});
                pushedRef.current = true;
            } catch (err) {
                console.error("AdSense error:", err);
                setAdError("Publicidade indisponível no momento.");
            }
        }, 800);

        return () => window.clearTimeout(timeout);
    }, []);

    if (!ADSENSE_CLIENT || !slot) {
        return null;
    }

    return (
        <aside
            className={`my-8 flex w-full justify-center px-2 ${className}`}
            aria-label="Publicidade"
        >
            <div className="w-full max-w-3xl rounded-xl border border-gray-100 bg-white p-3">
                <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Publicidade
                </p>

                <div
                    className="mx-auto flex w-full items-center justify-center overflow-hidden"
                    style={{ minHeight }}
                >
                    <ins
                        ref={adRef}
                        className="adsbygoogle"
                        style={{ display: "block", width: "100%" }}
                        data-ad-client={ADSENSE_CLIENT}
                        data-ad-slot={slot}
                        data-ad-format="auto"
                        data-full-width-responsive="true"
                        data-adtest={process.env.NODE_ENV !== "production" ? "on" : undefined}
                    />
                </div>

                {adError && (
                    <p className="mt-2 text-center text-xs text-gray-400">
                        {adError}
                    </p>
                )}
            </div>
        </aside>
    );
}
