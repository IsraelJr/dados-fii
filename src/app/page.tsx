'use client';

import { useState } from "react";

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchFII = async () => {
    setError("");
    setData(null);

    if (!ticker.trim()) {
      setError("Digite um ticker válido.");
      return;
    }

    try {
      const res = await fetch(`/api/fii?ticker=${ticker.toUpperCase().trim()}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Erro ao buscar FII");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    }
  };

  const getCurrentYearDividends = (yearData: any) => {
    if (!yearData) return [];

    const monthsOrder = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return Object.entries(yearData).sort(
      ([monthA], [monthB]) => monthsOrder.indexOf(monthA) - monthsOrder.indexOf(monthB)
    );
  };

  const copyJSON = () => {
    if (!data) return;
    const filtered = {
      ativo: data.active ? "Sim" : "Não",
      ticker: data.code,
      DY: data.dividendYield,
      isIFIX: data.isIFIX ? "Sim" : "Não",
      preço: data.price,
      segmento: data.segment_new,
      razãoSocial: data.socialReason,
      dividendos: getCurrentYearDividends(data.earnings2025).map(
        ([month, info]: any) => {
          const value = parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
          return { month, earnings: value.toFixed(3), payment_date: info.payment_date };
        }
      )
    };
    navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
    alert("JSON copiado para a área de transferência!");
  };

  // Mapeamento dos meses para PT-BR
  const monthsPTBR: Record<string, string> = {
    January: "Janeiro",
    February: "Fevereiro",
    March: "Março",
    April: "Abril",
    May: "Maio",
    June: "Junho",
    July: "Julho",
    August: "Agosto",
    September: "Setembro",
    October: "Outubro",
    November: "Novembro",
    December: "Dezembro",
  };

  return (
    <div style={{ fontFamily: "Arial", textAlign: "center", marginTop: "50px", padding: "10px" }}>
      <h1>📊 Dados de Fundos Imobiliários</h1>
      <p>Consulte informações resumidas de FIIs</p>

      <div style={{ margin: "20px 0" }}>
        <input
          type="text"
          placeholder="Digite o ticker (ex: TGAR11)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          style={{
            padding: "8px",
            width: "220px",
            marginRight: "10px",
            borderRadius: "4px",
            border: "1px solid #888",
            backgroundColor: "#f0f0f0",
            color: "#000"
          }}
        />
        <button
          onClick={fetchFII}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "#4f46e5",
            color: "white",
            fontWeight: "bold"
          }}
        >
          Consultar
        </button>
      </div>

      {error && (
        <div style={{ color: "#f87171", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {data && (
        <div
          style={{
            textAlign: "left",
            margin: "0 auto",
            maxWidth: "650px",
            maxHeight: "500px",
            overflowY: "auto",
            padding: "20px",
            borderRadius: "10px",
            backgroundColor: "#1e1e2f",
            color: "#f5f5f5",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
          }}
        >
          <p><strong>Ativo:</strong> {data.active ? "Sim" : "Não"}</p>
          <p><strong>Ticker:</strong> {data.code}</p>
          <p><strong>DY:</strong> {data.dividendYield}</p>
          <p><strong>Faz parte do IFIX:</strong> {data.isIFIX ? "Sim" : "Não"}</p>
          <p><strong>Preço:</strong> {data.price}</p>
          <p><strong>Segmento:</strong> {data.segment_new}</p>
          <p><strong>Razão Social:</strong> {data.socialReason}</p>

          <h3><strong>Dividendos ({new Date().getFullYear()}):</strong></h3>
          <ul style={{ paddingLeft: "20px" }}>
            {getCurrentYearDividends(data.earnings2025).map(([month, info]: any) => {
              const monthPT = monthsPTBR[month] || month;
              const value = parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
              const formatted = `R$ ${value.toFixed(3)}`;

              return (
                <li key={month} style={{ marginBottom: "6px" }}>
                  <strong>{monthPT}:</strong> {formatted} | Pago em {info.payment_date}
                </li>
              );
            })}
          </ul>

          <button
            onClick={copyJSON}
            style={{
              marginTop: "15px",
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#10b981",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Copiar JSON
          </button>
        </div>
      )}
    </div>
  );
}
