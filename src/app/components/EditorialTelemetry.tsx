'use client';

import { useEffect } from "react";
import type { EditorialDestination, EditorialEntryClass, EditorialEventName, EditorialPage } from "@/lib/editorial/EditorialEvent";

function classifyEntry(): EditorialEntryClass {
  if (typeof document === "undefined" || !document.referrer) return "direct";
  try {
    const referrer = new URL(document.referrer);
    if (referrer.hostname === window.location.hostname) return "internal";
    const host = referrer.hostname.toLowerCase();
    if (["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia."].some((domainPattern) => host.includes(domainPattern))) return "search";
    if (["facebook.", "instagram.", "linkedin.", "twitter.", "t.co", "whatsapp.", "telegram."].some((domainPattern) => host.includes(domainPattern))) return "social";
    return "other";
  } catch {
    return "other";
  }
}

function sendEvent(name: EditorialEventName, page: EditorialPage, entryClass: EditorialEntryClass, destination?: EditorialDestination) {
  void fetch("/api/editorial/events", {
    method: "POST",
    keepalive: true,
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, page, entryClass, ...(destination ? { destination } : {}) }),
  }).catch(() => undefined);
}

export default function EditorialTelemetry({ page }: { page: EditorialPage }) {
  useEffect(() => {
    const entryClass = classifyEntry();
    sendEvent(page === "hub" ? "market_hub_viewed" : "market_article_viewed", page, entryClass);

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-editorial-destination]") : null;
      const destination = target?.dataset.editorialDestination as EditorialDestination | undefined;
      if (!destination) return;
      sendEvent("market_continuation_clicked", page, entryClass, destination);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [page]);

  return null;
}
