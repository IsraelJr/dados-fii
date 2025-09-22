"use client";

import { useEffect } from "react";

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
        <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={process.env.NEXT_PUBLIC_ADS_OPEN!}
            data-ad-slot="4266399988"
            data-ad-format="auto"
            data-full-width-responsive="true"
        />
    );
}
