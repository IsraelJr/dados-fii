"use client";

import { useEffect, useRef, useState } from "react";

type AdsWindow = Window & {
    adsbygoogle: Array<Record<string, unknown>>;
};

const ADSENSE_CLIENT =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT ||
    process.env.NEXT_PUBLIC_ADS_OPEN ||
    "ca-pub-3245357129779122";

const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "4266399988";

export default function GoogleAd() {
    const adRef = useRef<HTMLModElement | null>(null);
    const [adError, setAdError] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!adRef.current) return;

        const timeout = window.setTimeout(() => {
            try {
                const adsWindow = window as AdsWindow;
                adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
                adsWindow.adsbygoogle.push({});
            } catch (err) {
                console.error("AdSense error:", err);
                setAdError("Publicidade indisponível no momento.");
            }
        }, 800);

        return () => window.clearTimeout(timeout);
    }, []);

    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) {
        return (
            <div className="flex h-[250px] w-[300px] items-center justify-center rounded bg-gray-100 p-4 text-center text-xs text-gray-500">
                Configure NEXT_PUBLIC_ADSENSE_CLIENT e NEXT_PUBLIC_ADSENSE_SLOT.
            </div>
        );
    }

    return (
        <div className="flex min-h-[250px] w-full items-center justify-center">
            <ins
                ref={adRef}
                className="adsbygoogle"
                style={{ display: "block", width: "300px", height: "250px" }}
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={ADSENSE_SLOT}
                data-adtest={process.env.NODE_ENV !== "production" ? "on" : undefined}
            />

            {adError && (
                <p className="mt-2 text-center text-xs text-gray-500">
                    {adError}
                </p>
            )}
        </div>
    );
}
