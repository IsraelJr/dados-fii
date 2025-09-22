"use client";

import { useEffect } from "react";
import Script from "next/script";

export default function GoogleAd() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const timeout = setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (err) {
                console.error("Adsense error:", err);
            }
        }, 500); // aguarda renderização do container

        return () => clearTimeout(timeout);
    }, []);

    return (
        <>
            {/* Script obrigatório do Google AdSense */}
            <Script
                src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3245357129779122"
                strategy="afterInteractive"
                crossOrigin="anonymous"
            />

            {/* Bloco do anúncio */}
            <div style={{ width: "100%", maxWidth: "320px", height: "100px" }}>
                <ins
                    className="adsbygoogle"
                    style={{ display: "block", width: "100%", height: "100%" }}
                    data-ad-client={process.env.NEXT_PUBLIC_ADS_OPEN!}
                    data-ad-slot="4266399988"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />
            </div>
        </>
    );
}
