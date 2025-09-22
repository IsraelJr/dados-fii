"use client";

import { useEffect } from "react";
import Script from "next/script";

export default function GoogleAd() {
    useEffect(() => {
        try {
            window.adsbygoogle = window.adsbygoogle || [];
            window.adsbygoogle.push({});
        } catch (err) {
            console.error("Adsense error:", err);
        }
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
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={process.env.NEXT_PUBLIC_ADS_OPEN!}
                data-ad-slot="4266399988"
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
        </>
    );
}
