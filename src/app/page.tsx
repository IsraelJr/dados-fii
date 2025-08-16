export default function Home() {
  return (
    <div style={{ fontFamily: "Arial", textAlign: "center", marginTop: "50px" }}>
      <h1>📊 API de Fundos Imobiliários</h1>
      <p>Consulte informações resumidas de FIIs</p>
      <p>Exemplo de uso da API:</p>
      <code>/api/fii?ticker=MXRF11</code>
    </div>
  );
}
