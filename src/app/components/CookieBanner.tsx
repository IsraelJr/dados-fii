"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "dados-fii-consent-v2";
type ConsentChoice = "accepted" | "rejected";

function persistConsent(choice: ConsentChoice) {
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ choice, updatedAt: new Date().toISOString(), version: 2 }),
  );
  window.dispatchEvent(new Event("dados-fii:consent-updated"));
}

export default function CookieBanner({ global = false }: { global?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!global) return;
    setVisible(!window.localStorage.getItem(CONSENT_STORAGE_KEY));
    const openPreferences = () => setVisible(true);
    window.addEventListener("dados-fii:open-consent", openPreferences);
    return () => window.removeEventListener("dados-fii:open-consent", openPreferences);
  }, [global]);

  const choose = (choice: ConsentChoice) => {
    persistConsent(choice);
    setVisible(false);
  };

  if (!global || !visible) return null;

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl bg-slate-950 p-5 text-white shadow-2xl ring-1 ring-white/15"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <h2 id="cookie-consent-title" className="text-lg font-extrabold">Privacidade e cookies</h2>
      <p id="cookie-consent-description" className="mt-2 text-sm leading-6 text-slate-300">
        Cookies essenciais mantêm o site funcionando. Com sua autorização, Google e parceiros também podem usar cookies e identificadores para métricas e publicidade. Recusar não bloqueia o acesso ao conteúdo.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={() => choose("accepted")} className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-400">
          Aceitar opcionais
        </button>
        <button type="button" onClick={() => choose("rejected")} className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900 hover:bg-slate-100">
          Recusar opcionais
        </button>
        <Link href="/politica-de-privacidade" className="px-2 py-2 text-sm font-bold text-indigo-200 underline underline-offset-4 hover:text-white">
          Ler política de privacidade
        </Link>
      </div>
    </section>
  );
}
