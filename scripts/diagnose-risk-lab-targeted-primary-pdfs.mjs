import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cases = [
  { ticker: "DEVA11", documentId: "424937", receivedAt: "2023-03-06T00:00:00-03:00" },
  { ticker: "DEVA11", documentId: "435304", receivedAt: "2023-03-29T00:00:00-03:00" },
  { ticker: "DEVA11", documentId: "456606", receivedAt: "2023-05-05T00:00:00-03:00" },
  { ticker: "VSLH11", documentId: "424942", receivedAt: "2023-03-06T00:00:00-03:00" },
  { ticker: "VSLH11", documentId: "435301", receivedAt: "2023-03-29T00:00:00-03:00" },
  { ticker: "VSLH11", documentId: "456608", receivedAt: "2023-05-05T00:00:00-03:00" },
];
const patterns = [
  ["judicial_recovery", ["RECUPERACAO JUDICIAL", "RECUPERACAO EXTRAJUDICIAL", "PEDIDO DE FALENCIA", "DECRETO DE FALENCIA"]],
  ["default", ["INADIMPLENCIA", "VENCIMENTO ANTECIPADO", "NAO PAGAMENTO", "DEFAULT", "MORA", "CREDITO INADIMPLENTE"]],
  ["impairment", ["IMPAIRMENT", "PROVISAO PARA PERDA", "PERDA ESPERADA", "AJUSTE AO VALOR RECUPERAVEL", "PERDA DE CREDITO"]],
  ["material_restructuring", ["REESTRUTURACAO", "RENEGOCIACAO", "REPERFILAMENTO", "WAIVER", "CARACTERISTICAS DA DIVIDA ALTERADAS"]],
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
  const core={schemaVersion:1,pipeline:"risk-lab-phase-c-targeted-primary-pdf-v1",documents};
  writeFileSync("risk-lab-targeted-primary-pdfs.json",`${JSON.stringify({...core,artifactHash:sha(Buffer.from(JSON.stringify(core),"utf8"))},null,2)}\n`);
} finally { rmSync(folder,{recursive:true,force:true}); }
