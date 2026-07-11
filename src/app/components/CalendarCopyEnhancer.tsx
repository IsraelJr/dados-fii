"use client";

import { useEffect } from "react";

const OLD_TEXT = "Consulte pagamentos da semana, rendimentos anunciados no mês e pagamentos recentes dos fundos imobiliários da base Dados FII.";
const NEW_TEXT = "Consulte pagamentos da semana, rendimentos anunciados no mês e pagamentos recentes dos fundos.";

export default function CalendarCopyEnhancer() {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const element = Array.from(document.querySelectorAll("p")).find((item) => item.textContent?.trim() === OLD_TEXT);
      if (element) {
        element.textContent = NEW_TEXT;
        window.clearInterval(timer);
      }
      if (attempts > 20) window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
