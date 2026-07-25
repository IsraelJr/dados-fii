import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const documents = {
  DEVA11: [
    ["291795","2022-04-19","AVISO MERCADO"],["320501","2022-06-29","FATO RELEV"],["424937","2023-03-06","FATO RELEV"],["426679","2023-03-08","FATO RELEV"],["429750","2023-03-14","AVISO MERCADO"],["435304","2023-03-29","FATO RELEV"],["440002","2023-04-03","AVISO MERCADO"],["456606","2023-05-05","FATO RELEV"],["496781","2023-07-26","AVISO MERCADO"],["498349","2023-07-28","AVISO MERCADO"],["571644","2023-12-18","AVISO MERCADO"],["709601","2024-07-31","AVISO MERCADO"],["812957","2025-01-03","FATO RELEV"],["907691","2025-05-16","AVISO MERCADO"],["1012238","2025-10-13","AVISO MERCADO"],
  ],
  VSLH11: [
    ["254924","2022-01-11","FATO RELEV"],["291799","2022-04-19","AVISO MERCADO"],["314685","2022-06-13","AVISO MERCADO"],["318383","2022-06-23","FATO RELEV"],["409024","2023-02-02","AVISO MERCADO"],["409885","2023-02-03","AVISO MERCADO"],["419711","2023-02-16","AVISO MERCADO"],["424942","2023-03-06","FATO RELEV"],["426704","2023-03-08","FATO RELEV"],["435301","2023-03-29","FATO RELEV"],["456608","2023-05-05","FATO RELEV"],["465895","2023-05-16","AVISO MERCADO"],["592707","2024-01-30","AVISO MERCADO"],["769031","2024-10-30","AVISO MERCADO"],["812980","2025-01-03","FATO RELEV"],["982395","2025-09-02","AVISO MERCADO"],["1042791","2025-11-17","AVISO MERCADO"],
  ],
};

const terms = [
  "RECUPERACAO JUDICIAL","RECUPERACAO EXTRAJUDICIAL","PEDIDO DE FALENCIA","DECRETO DE FALENCIA",
  "INADIMPLENCIA","VENCIMENTO ANTECIPADO","NAO PAGAMENTO","DEFAULT","MORA MATERIAL","CREDITO INADIMPLENTE",
  "IMPAIRMENT","PROVISAO PARA PERDA","PERDA ESPERADA","AJUSTE AO VALOR RECUPERAVEL","PERDA DE CREDITO",
  "REESTRUTURACAO","RENEGOCIACAO","REPERFILAMENTO","WAIVER DE COVENANT","CARACTERISTICAS DA DIVIDA ALTERADAS",
];

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function snippets(text, term) {
  const out=[]; let from=0;
  while (out.length<5) {
    const index=text.indexOf(term, from); if(index<0) break;
    out.push(text.slice(Math.max(0,index-220), Math.min(text.length,index+term.length+320)));
    from=index+term.length;
  }
  return out;
}

const folder=mkdtempSync(join(tmpdir(),"risk-lab-critical-pdfs-"));
const results=[];
try {
  for (const [ticker, items] of Object.entries(documents)) {
    for (const [documentId, receivedAt, documentType] of items) {
      const sourceUrl=`https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=${documentId}`;
      const response=await fetch(sourceUrl,{headers:{Accept:"application/pdf,*/*;q=0.1","User-Agent":"DadosFII-RiskLab/0.3 (+phase-c-primary-pdf)"},redirect:"follow"});
      if(!response.ok) throw new Error(`${ticker}/${documentId}: HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      const pdfPath=join(folder,`${documentId}.pdf`); const textPath=join(folder,`${documentId}.txt`);
      writeFileSync(pdfPath,bytes);
      let extractionError=null; let text="";
      try { execFileSync("pdftotext",["-layout",pdfPath,textPath],{stdio:"pipe"}); text=readFileSync(textPath,"utf8"); }
      catch(error){ extractionError=error instanceof Error?error.message:"Falha no pdftotext"; }
      const normalized=normalize(text);
      const matches=terms.flatMap(term=>normalized.includes(term)?[{term,contexts:snippets(normalized,term)}]:[]);
      results.push({ticker,documentId,receivedAt:`${receivedAt}T00:00:00-03:00`,documentType,sourceUrl,contentType:response.headers.get("content-type"),bytes:bytes.length,sourceHash:hash(bytes),textHash:hash(Buffer.from(normalized,"utf8")),textLength:normalized.length,extractionError,matches});
      console.log(`${ticker}/${documentId}: bytes=${bytes.length}; texto=${normalized.length}; termos=${matches.map(x=>x.term).join(",")||"nenhum"}`);
    }
  }
  const payload={schemaVersion:1,pipeline:"risk-lab-phase-c-primary-pdf-v1",documents:results};
  writeFileSync("risk-lab-critical-pdf-diagnostic.json",`${JSON.stringify({...payload,artifactHash:createHash("sha256").update(JSON.stringify(payload)).digest("hex")},null,2)}\n`);
} finally { rmSync(folder,{recursive:true,force:true}); }
