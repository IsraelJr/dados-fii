import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync, zipSync } from "fflate";

const REDACTED = "[REDACTED]";
const sensitiveNames = /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|idtoken|id_token|accesstoken|access_token|refreshtoken|refresh_token|sessiontoken|session_token|x-wallet-session|x-vercel-protection-bypass)$/i;
const storageNames = /^(?:localstorage|sessionstorage|storage|storagestate|origins)$/i;

function environmentSecrets() {
  return [
    process.env.E2E_USER_EMAIL,
    process.env.E2E_USER_PASSWORD,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ].filter((value) => typeof value === "string" && value.length > 0);
}

function sanitizeString(value, secrets) {
  let output = value;
  for (const secret of secrets) output = output.split(secret).join(REDACTED);
  return output
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_TOKEN]")
    .replace(/([?&](?:token|code|secret|key|password|session)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(\b(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie|x-wallet-session|x-vercel-protection-bypass)\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/("(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|idToken|id_token|accessToken|access_token|refreshToken|refresh_token|sessionToken|session_token|x-wallet-session|x-vercel-protection-bypass)"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2")
    .replace(/("name"\s*:\s*"(?:authorization|proxy-authorization|cookie|set-cookie|x-wallet-session|x-vercel-protection-bypass)"[^{}\r\n]*?"value"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2")
    .replace(/R\$\s*\d[\d.]*,\d{2}/g, "R$ [REDACTED]");
}

function sanitizeStructured(value, secrets, context = "") {
  if (typeof value === "string") return sanitizeString(value, secrets);
  if (Array.isArray(value)) {
    if (storageNames.test(context)) return value.map(() => REDACTED);
    return value.map((item) => sanitizeStructured(item, secrets, context));
  }
  if (!value || typeof value !== "object") return value;

  const record = value;
  const headerName = typeof record.name === "string" ? record.name : "";
  const forceValues = sensitiveNames.test(headerName) || /cookies?/i.test(context);
  const sanitized = {};
  for (const [key, item] of Object.entries(record)) {
    if (storageNames.test(key)) {
      sanitized[key] = REDACTED;
    } else if (sensitiveNames.test(key) || (forceValues && key.toLowerCase() === "value")) {
      sanitized[key] = REDACTED;
    } else {
      sanitized[key] = sanitizeStructured(item, secrets, key);
    }
  }
  return sanitized;
}

function sanitizeJsonLine(line, secrets) {
  try {
    return JSON.stringify(sanitizeStructured(JSON.parse(line), secrets));
  } catch {
    return sanitizeString(line, secrets);
  }
}

export function redactArtifactText(value, secrets = environmentSecrets()) {
  try {
    return sanitizeString(JSON.stringify(sanitizeStructured(JSON.parse(value), secrets)), secrets);
  } catch {
    const lines = value.split("\n");
    return lines.map((line) => sanitizeJsonLine(line, secrets)).join("\n");
  }
}

function looksLikeZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06));
}

function looksLikeText(bytes) {
  if (!bytes.length) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 8_192));
  let controlCharacters = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controlCharacters += 1;
  }
  return controlCharacters / sample.length < 0.01;
}

function redactBytes(bytes, secrets, depth = 0) {
  if (depth > 8) throw new Error("Profundidade máxima de arquivo compactado excedida.");
  if (looksLikeZip(bytes)) {
    const entries = unzipSync(bytes);
    const redactedEntries = {};
    for (const [name, entry] of Object.entries(entries)) {
      redactedEntries[name] = redactBytes(entry, secrets, depth + 1);
    }
    return zipSync(redactedEntries, { level: 6 });
  }
  if (!looksLikeText(bytes)) return bytes;
  return Buffer.from(redactArtifactText(Buffer.from(bytes).toString("utf8"), secrets));
}

async function visit(target, secrets) {
  const info = await stat(target).catch(() => null);
  if (!info) return;
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await visit(path.join(target, entry), secrets);
    return;
  }

  const original = await readFile(target);
  const redacted = redactBytes(original, secrets);
  if (!Buffer.from(redacted).equals(original)) await writeFile(target, redacted);
}

export async function redactArtifactRoots(roots, secrets = environmentSecrets()) {
  for (const root of roots) await visit(root, secrets);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) await redactArtifactRoots(process.argv.slice(2));
