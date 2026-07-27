"use client";

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("dados-fii:open-consent"))}
      className="text-left hover:text-indigo-700"
    >
      Preferências de cookies
    </button>
  );
}
