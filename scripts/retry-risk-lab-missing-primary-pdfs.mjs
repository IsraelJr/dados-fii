import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const documents = [
  { ticker: "KNSC11", role: "healthy_control", documentId: "543642", receivedAt: "2023-10-30T00:00:00-03:00" },
  { ticker: "RBRY11", role: "reversible_stress", documentId: "1058416", receivedAt: "2025-12-11T00:00:00-03:00" },
  { ticker: "DEVA11", role: "severe_deterioration", documentId: "424937", receivedAt: "2023-03-06T00:00:00-03:00" },
  { ticker: "VSLH11", role: "severe_deterioration", documentId: "456608", receivedAt: "2023-05-05T00:00:00-03:00" },
];
const patterns = [
  ["judicial_recovery", ["RECUPERACAO JUDICIAL", "RECUPERACAO EXTRAJUDICIAL", "PEDIDO DE FALENCIA", "DECRETO DE FALENCIA"]],
  ["default", ["INADIMPLENCIA", "VENCIMENTO ANTECIPADO", "NAO PAGAMENTO", "DEFAULT", "MORA MATERIAL", "CREDITO INADIMPLENTE"]],
  ["impairment", ["IMPAIRMENT", "PROVISAO PARA PERDA", "PERDA ESPERADA", "AJUSTE AO VALOR RECUPERAVEL", "PERDA DE CREDITO"]],
  ["material_restructuring", ["REESTRUTURACAO", "RENEGOCIACAO", "REPERFILAMENTO", "WAIVER DE COVENANT", "CARACTERISTICAS DA DIVIDA ALTERADAS"]],
];
function normalize(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase(); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function excerpt(text, term) { const index=text.indexOf(term); return index<0?"":text.slice(Math.max(0,index-280),Math.min(text.length,index+term.length+520)); }
async function fetchAttempt(sourceUrl) {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),25_000);
  try {
    const response=await fetch(sourceUrl,{redirect:"follow",cache:"no-store",signal:controller.signal,headers:{Accept:"application/pdf,*/*;q=0.1","User-Agent":"DadosFII-RiskLab/0.3 (+phase-c-retry-primary-pdf)"}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally { clearTimeout(timeout); }
}
const folder=mkdtempSync(join(tmpdir(),"phase-c-pdf-retry-"));
const results=[];
try {
  for(const item of documents) {
    const sourceUrl=`https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=${item.documentId}`;
    let final=null; const failures=[];
    for(let attempt=1;attempt<=5 && !final;attempt+=1) {
      try {
        const bytes=await fetchAttempt(sourceUrl);
        const pdf=join(folder,`${item.documentId}-${attempt}.pdf`); const txt=join(folder,`${item.documentId}-${attempt}.txt`);
        writeFileSync(pdf,bytes);
        execFileSync("pdftotext",["-layout",pdf,txt],{timeout:20_000,stdio:"pipe"});
        const text=normalize(readFileSync(txt,"utf8"));
        const matches=[];
        for(const [type,terms] of patterns) for(const term of terms) if(text.includes(term)) matches.push({type,term,excerpt:excerpt(text,term)});
        final={...item,sourceUrl,status:"extracted",attempt,bytes:bytes.length,sourceHash:sha(bytes),textHash:sha(Buffer.from(text,"utf8")),textLength:text.length,matches};
      } catch(error) {
        failures.push({attempt,error:(error instanceof Error?error.message:String(error)).slice(0,300)});
        await sleep(attempt*1_000);
      }
    }
    results.push(final||{...item,sourceUrl,status:"failed",failures,matches:[]});
    console.log(`${item.ticker}/${item.documentId}: ${final?`extraído na tentativa ${final.attempt}`:"falhou fechado"}`);
  }
  const core={schemaVersion:1,pipeline:"risk-lab-phase-c-primary-pdf-retry-v1",documents:results};
  writeFileSync("risk-lab-missing-primary-pdfs-retry.json",`${JSON.stringify({...core,artifactHash:sha(Buffer.from(JSON.stringify(core),"utf8"))},null,2)}\n`);
} finally { rmSync(folder,{recursive:true,force:true}); }
