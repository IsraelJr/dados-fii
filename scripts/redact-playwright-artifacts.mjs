import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

const roots = process.argv.slice(2);
const secrets = [
  process.env.E2E_USER_EMAIL,
  process.env.E2E_USER_PASSWORD,
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
].filter(Boolean);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".log", ".md", ".txt", ".xml"]);

function redact(value) {
  let output = value;
  for (const secret of secrets) output = output.split(secret).join("[REDACTED]");
  return output
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|code|secret|key|password)=)[^&\s\"']+/gi, "$1[REDACTED]");
}

function redactBytes(bytes) {
  return Buffer.from(redact(Buffer.from(bytes).toString("utf8")));
}

async function redactZip(file) {
  const entries = unzipSync(await readFile(file));
  for (const [name, bytes] of Object.entries(entries)) {
    const extension = path.extname(name).toLowerCase();
    if (textExtensions.has(extension) || !extension) entries[name] = redactBytes(bytes);
  }
  await writeFile(file, zipSync(entries, { level: 6 }));
}

async function visit(target) {
  const info = await stat(target).catch(() => null);
  if (!info) return;
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await visit(path.join(target, entry));
    return;
  }
  const extension = path.extname(target).toLowerCase();
  if (extension === ".zip") await redactZip(target);
  else if (textExtensions.has(extension)) {
    const original = await readFile(target, "utf8");
    const redacted = redact(original);
    if (redacted !== original) await writeFile(target, redacted);
  }
}

for (const root of roots) await visit(root);
