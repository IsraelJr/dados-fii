import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SingleFrozenDividendCaseFinalizer, type SingleFrozenDividendInput } from "../src/lib/risk-lab/SingleFrozenDividendCaseFinalizer";

const inputPath = process.argv[2];
const outputDir = process.argv[3];
if (!inputPath || !outputDir) throw new Error("Uso: finalize-frozen-dividend-case <entrada.json> <diretório-saída>");
const input = JSON.parse(await readFile(inputPath, "utf8")) as SingleFrozenDividendInput;
const result = await new SingleFrozenDividendCaseFinalizer().finalize(input);
await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "case.json"), `${JSON.stringify(result.case, null, 2)}\n`),
  writeFile(path.join(outputDir, "checkpoint.json"), `${JSON.stringify(result.checkpoint, null, 2)}\n`),
  writeFile(path.join(outputDir, "audit.json"), `${JSON.stringify(result.audit, null, 2)}\n`),
]);
console.log(JSON.stringify({ status: result.case.status, ticker: result.case.ticker, caseHash: result.case.caseHash, auditHash: result.audit.auditHash, observations: result.case.observations.length, exclusions: result.audit.exclusions.length }));
