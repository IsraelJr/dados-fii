'use client';

import React, { useEffect, useState } from "react";

type LottieAnimationProps = {
  src: string;
  label?: string;
  className?: string;
};

const SCRIPT_ID = "dados-fii-lottie-player-script";
const SCRIPT_SRC = "https://unpkg.com/@lottiefiles/lottie-player@2.0.8/dist/lottie-player.js";

export default function LottieAnimation({ src, label = "Animação", className = "h-28 w-28" }: LottieAnimationProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (customElements.get("lottie-player")) {
      setReady(true);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  if (!ready) {
    return (
      <div className={`${className} grid place-items-center`} aria-label={label}>
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <span className="absolute inset-3 rounded-full bg-emerald-500/20 animate-pulse" />
          <span className="absolute inset-6 rounded-full bg-indigo-500/50" />
        </div>
      </div>
    );
  }

  return React.createElement("lottie-player", {
    src,
    background: "transparent",
    speed: "1",
    loop: true,
    autoplay: true,
    "aria-label": label,
    class: className,
  });
}
