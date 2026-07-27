"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ADSENSE_PUBLISHER_ID } from "@/lib/site";

const CONSENT_STORAGE_KEY = "dados-fii-consent-v2";
const ELIGIBLE_EXACT_PATHS = new Set([
  "/",
  "/educacao",
  "/glossario",
  "/metodologia",
  "/fontes-dos-dados",
  "/termos-de-uso",
  "/sobre",
  "/politica-de-correcoes",
  "/como-usamos-ia",
  "/guias",
]);
const ELIGIBLE_PREFIXES = ["/guias/"];
const BLOCKED_PREFIXES = ["/admin", "/api", "/carteira", "/fii", "/login", "/configuracoes"];

type ConsentChoice = "accepted" | "rejected" | null;

function isEligiblePath(pathname: string) {
  if (BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  return ELIGIBLE_EXACT_PATHS.has(pathname) || ELIGIBLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function readConsent(): ConsentChoice {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { choice?: ConsentChoice };
    return parsed.choice === "accepted" || parsed.choice === "rejected" ? parsed.choice : null;
  } catch {
    return null;
  }
}

function updateGoogleConsent(choice: ConsentChoice) {
  const granted = choice === "accepted" ? "granted" : "denied";
  const globalWindow = window as typeof window & { dataLayer?: unknown[][] };
  globalWindow.dataLayer = globalWindow.dataLayer || [];
  globalWindow.dataLayer.push([
    "consent",
    "update",
    {
      ad_storage: granted,
      ad_user_data: granted,
      ad_personalization: granted,
      analytics_storage: granted,
    },
  ]);
}

export default function AdSenseLoader() {
  const pathname = usePathname() || "/";
  const [productionHost, setProductionHost] = useState(false);
  const eligiblePath = useMemo(() => isEligiblePath(pathname), [pathname]);

  useEffect(() => {
    setProductionHost(window.location.hostname === "www.dadosfii.com.br");
    updateGoogleConsent(readConsent());

    const handleConsent = () => updateGoogleConsent(readConsent());
    window.addEventListener("dados-fii:consent-updated", handleConsent);
    return () => window.removeEventListener("dados-fii:consent-updated", handleConsent);
  }, []);

  if (!productionHost || !eligiblePath) return null;

  return (
    <Script
      id="dados-fii-adsense"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
      crossOrigin="anonymous"
    />
  );
}
