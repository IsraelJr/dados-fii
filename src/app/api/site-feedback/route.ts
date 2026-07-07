import { createSign } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_SHEET_NAME = "Feedback";

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizePrivateKey(value?: string) {
  return String(value || "").replace(/\\n/g, "\n");
}

function signJwt(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(serviceAccount.private_key));
  return `${unsignedToken}.${base64Url(signature)}`;
}

async function getAccessToken() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error("Credencial de serviço não configurada para gravar feedback.");
  }

  const assertion = signJwt(serviceAccount);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.access_token) {
    throw new Error(`Google OAuth HTTP ${response.status}. ${JSON.stringify(json)}`);
  }

  return String(json.access_token);
}

function cleanText(value: unknown, max = 1200) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanKind(value: unknown) {
  const kind = cleanText(value, 30);
  return ["Elogio", "Crítica", "Sugestão"].includes(kind) ? kind : "Sugestão";
}

function cleanRating(value: unknown) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : "";
}

function appendRange(sheetName: string) {
  const safeName = sheetName.replace(/'/g, "''");
  return `'${safeName}'!A:H`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const spreadsheetId = process.env.FEEDBACK_SHEET_ID || process.env.SHEET_ID;
    const sheetName = process.env.FEEDBACK_SHEET_NAME || DEFAULT_SHEET_NAME;

    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: "Planilha de feedback não configurada." }, { status: 500 });
    }

    const kind = cleanKind(body?.kind);
    const rating = cleanRating(body?.rating);
    const message = cleanText(body?.message);
    const page = cleanText(body?.page, 500);
    const userAgent = cleanText(req.headers.get("user-agent"), 500);

    if (!rating && !message) {
      return NextResponse.json({ ok: false, error: "Informe uma nota ou comentário antes de enviar." }, { status: 400 });
    }

    const token = await getAccessToken();
    const values = [[
      new Date().toISOString(),
      kind,
      rating,
      message,
      page,
      userAgent,
      "web",
      "dadosfii.com.br",
    ]];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange(sheetName))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Google Sheets HTTP ${response.status}. ${JSON.stringify(json)}`);
    }

    return NextResponse.json({ ok: true, saved: true });
  } catch (err: any) {
    console.error("site-feedback error", err);
    return NextResponse.json({ ok: false, error: err.message || "Erro ao enviar feedback." }, { status: 500 });
  }
}
