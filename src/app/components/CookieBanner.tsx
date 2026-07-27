"use client";
import { useState, useEffect } from "react";

export default function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const accepted = localStorage.getItem("cookie-consent");
        if (!accepted) setVisible(true);
    }, []);

    function acceptCookies() {
        localStorage.setItem("cookie-consent", "true");
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 w-full bg-gray-900 text-white p-4 flex justify-between items-center">
            <p>Usamos cookies para melhorar sua experiência no site.</p>
            <button
                onClick={acceptCookies}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
                Aceitar
            </button>
        </div>
    );
}
