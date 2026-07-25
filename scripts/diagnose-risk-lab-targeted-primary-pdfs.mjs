import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cases = [
  { ticker: "DEVA11", role: "severe_deterioration", documentId: "424937", receivedAt: "2023-03-06T00:00:00-03:00" },
  { ticker: "DEVA11", role: "severe_deterioration", documentId: "435304", receivedAt: "2023-03-29T00:00:00-03:00" },
  { ticker: "DEVA11", role: "severe_deterioration", documentId: "456606", receivedAt: "2023-05-05T00:00:00-03:00" },
  { ticker: "VSLH11", role: "severe_deterioration", documentId: "424942", receivedAt: "2023-03-06T00:00:00-03:00" },
  { ticker: "VSLH11", role: "severe_deterioration", documentId: "435301", receivedAt: "2023-03-29T00:00:00-03:00" },
  { ticker: "VSLH11", role: "severe_deterioration", documentId: "456608", receivedAt: "2023-05-05T00:00:00-03:00" },
  { ticker: "KNCR11", role: "healthy_control", documentId: "601312", receivedAt: "2024-02-09T00:00:00-03:00" },
  { ticker: "KNCR11", role: "healthy_control", documentId: "754234", receivedAt: "2024-10-08T00:00:00-03:00" },
  { ticker: "KNCR11", role: "healthy_control", documentId: "962129", receivedAt: "2025-08-07T00:00:00-03:00" },
  { ticker: "KNSC11", role: "healthy_control", documentId: "259720", receivedAt: "2022-01-26T00:00:00-03:00" },
  { ticker: "KNSC11", role: "healthy_control", documentId: "543642", receivedAt: "2023-10-30T00:00:00-03:00" },
  { ticker: "KNSC11", role: "healthy_control", documentId: "717289", receivedAt: "2024-08-13T00:00:00-03:00" },
  { ticker: "MCCI11", role: "reversible_stress", documentId: "281671", receivedAt: "2022-03-28T00:00:00-03:00" },
  { ticker: "MCCI11", role: "reversible_stress", documentId: "285884", receivedAt: "2022-04-05T00:00:00-03:00" },
  { ticker: "MCCI11", role: "reversible_stress", documentId: "351757", receivedAt: "2022-09-14T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "272948", receivedAt: "2022-02-25T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "283124", receivedAt: "2022-03-30T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "325760", receivedAt: "2022-07-13T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "332848", receivedAt: "2022-08-02T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "398994", receivedAt: "2023-01-06T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "595236", receivedAt: "2024-02-02T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "612913", receivedAt: "2024-03-01T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "690779", receivedAt: "2024-07-02T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "802386", receivedAt: "2024-12-16T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "1058416", receivedAt: "2025-12-11T00:00:00-03:00" },
];
const patterns = [
  ["judicial_recovery", ["RECUPERACAO JUDICIAL", "RECUPERACAO EXTRAJUDICIAL", "PEDIDO DE FALENCIA", "DECRETO DE FALENCIA"]],
  ["default", ["INADIMPLENCIA", "VENCIMENTO ANTECIPADO", "NAO PAGAMENTO", "DEFAULT", "MORA MATERIAL", "CREDITO INADIMPLENTE"]],
  ["impairment", ["IMPAIRMENT", "PROVISAO PARA PERDA", "PERDA ESPERADA", "AJUSTE AO VALOR RECUPERAVEL", "PERDA DE CREDITO"]],
  ["material_restructuring", ["REESTRUTURACAO", "RENEGOCIACAO", "REPERFILAMENTO", "WAIVER DE COVENANT", "CARACTERISTICAS DA DIVIDA ALTERADAS"]],
];
function normalize(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase(); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function contexts(text, term) {
  const values=[]; let offset=0;
  while(values.length<4) { const index=text.indexOf(term,offset); if(index<0) break; values.push(text.slice(Math.max(0,index-240),Math.min(text.length,index+term.length+420))); offset=index+term.length; }
  return values;
}
async function download(url) {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),20_000);
  try {
    const response=await fetch(url,{redirect:"follow",cache:"no-store",signal:controller.signal,headers:{Accept:"application/pdf,*/*;q=0.1","User-Agent":"DadosFII-RiskLab/0.3 (+phase-c-targeted-primary-pdf)"}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return { bytes:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get("content-type")||"" };
  } finally { clearTimeout(timeout); }
}
const folder=mkdtempSync(join(tmpdir(),"phase-c-targeted-"));
const documents=[];
try {
  for(const item of cases) {
    const sourceUrl=`https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=${item.documentId}`;
    try {
      const downloaded=await download(sourceUrl);
      const pdf=join(folder,`${item.documentId}.pdf`); const txt=join(folder,`${item.documentId}.txt`);
      writeFileSync(pdf,downloaded.bytes);
      execFileSync("pdftotext",["-layout",pdf,txt],{timeout:15_000,stdio:"pipe"});
      const normalized=normalize(readFileSync(txt,"utf8"));
      const matches=[];
      for(const [type,terms] of patterns) for(const term of terms) if(normalized.includes(term)) matches.push({type,term,contexts:contexts(normalized,term)});
      documents.push({...item,sourceUrl,status:"extracted",contentType:downloaded.contentType,bytes:downloaded.bytes.length,sourceHash:sha(downloaded.bytes),textHash:sha(Buffer.from(normalized,"utf8")),textLength:normalized.length,matches});
      console.log(`${item.ticker}/${item.documentId}: ${matches.map(x=>`${x.type}:${x.term}`).join(",")||"sem-termo"}`);
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      documents.push({...item,sourceUrl,status:"failed",error:message.slice(0,500),matches:[]});
      console.log(`${item.ticker}/${item.documentId}: falha ${message}`);
    }
  }
  const core={schemaVersion:1,pipeline:"risk-lab-phase-c-targeted-primary-pdf-v2",documents};
  writeFileSync("risk-lab-targeted-primary-pdfs.json",`${JSON.stringify({...core,artifactHash:sha(Buffer.from(JSON.stringify(core),"utf8"))},null,2)}\n`);
} finally { rmSync(folder,{recursive:true,force:true}); }
