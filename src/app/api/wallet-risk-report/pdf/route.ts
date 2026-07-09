import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_COLLECTION = "UserRiskReports";
const TIME_ZONE = "America/Sao_Paulo";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}`;
}

function formatDatePtBr() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function sanitizePdfText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\t/g, "  ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function normalizeLine(line: string) {
  return sanitizePdfText(line)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "- ")
    .replace(/^\d+\.\s+/, (match) => match)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trimEnd();
}

function isHeading(line: string) {
  return /^#{1,3}\s+/.test(line) || /^##\s+/.test(line);
}

function isMajorHeading(line: string) {
  return /^#\s+/.test(line);
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      return;
    }

    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(sha256(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { docId: direct.id, data: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { docId: doc.id, data: doc.data() || {} };
  }

  return null;
}

async function loadReport(email: string, sessionToken: unknown) {
  if (!isEmail(email)) throw Object.assign(new Error("Informe um e-mail válido."), { status: 400 });
  if (!(await hasSession(email, sessionToken))) {
    throw Object.assign(new Error("Confirme o código da carteira antes de baixar o PDF."), { status: 401 });
  }

  const user = await findUserByEmail(email);
  if (!user) throw Object.assign(new Error("Usuário não encontrado."), { status: 404 });

  const month = currentMonthKey();
  const reportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
  const reportSnap = await adminDb.collection(REPORT_COLLECTION).doc(reportId).get();
  const report = reportSnap.data() || {};

  if (!reportSnap.exists || report.status !== "done" || !report.reportMarkdown) {
    throw Object.assign(new Error("Relatório não encontrado para gerar o PDF."), { status: 404 });
  }

  return { report, month };
}

async function createReportPdf(reportMarkdown: string, metadata: { email: string; month: string }) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let pageNumber = 1;

  function drawPageChrome(currentPage: any, currentPageNumber: number) {
    currentPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 44, width: PAGE_WIDTH, height: 44, color: rgb(0.07, 0.09, 0.16) });
    currentPage.drawText("Dados FII", { x: MARGIN_X, y: PAGE_HEIGHT - 29, size: 13, font: bold, color: rgb(1, 1, 1) });
    currentPage.drawText("Relatorio de risco da carteira", { x: MARGIN_X + 84, y: PAGE_HEIGHT - 29, size: 10, font: regular, color: rgb(0.82, 0.86, 0.95) });

    currentPage.drawText("DADOS FII", {
      x: 145,
      y: 380,
      size: 62,
      font: bold,
      color: rgb(0.9, 0.92, 0.98),
      rotate: degrees(35),
      opacity: 0.12,
    });

    currentPage.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
      thickness: 0.5,
      color: rgb(0.82, 0.84, 0.88),
    });
    currentPage.drawText(`Gerado em ${formatDatePtBr()} - ${metadata.email}`, {
      x: MARGIN_X,
      y: 26,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.47, 0.52),
    });
    currentPage.drawText(`Pagina ${currentPageNumber}`, {
      x: PAGE_WIDTH - MARGIN_X - 46,
      y: 26,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.47, 0.52),
    });
  }

  function newPage() {
    drawPageChrome(page, pageNumber);
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    y = PAGE_HEIGHT - MARGIN_TOP;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN_BOTTOM) newPage();
  }

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("Dados FII", { x: MARGIN_X, y: PAGE_HEIGHT - 110, size: 22, font: bold, color: rgb(0.15, 0.18, 0.32) });
  page.drawText("Relatorio de risco da carteira", { x: MARGIN_X, y: PAGE_HEIGHT - 150, size: 28, font: titleFont, color: rgb(0.05, 0.07, 0.14) });
  page.drawText(`Competencia: ${metadata.month}`, { x: MARGIN_X, y: PAGE_HEIGHT - 178, size: 12, font: regular, color: rgb(0.35, 0.38, 0.45) });
  page.drawText(`Gerado em ${formatDatePtBr()}`, { x: MARGIN_X, y: PAGE_HEIGHT - 198, size: 12, font: regular, color: rgb(0.35, 0.38, 0.45) });
  page.drawText("Analise educacional baseada nos dados disponiveis. Nao constitui recomendacao individual definitiva.", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 236,
    size: 10,
    font: regular,
    color: rgb(0.38, 0.40, 0.46),
  });
  drawPageChrome(page, pageNumber);
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pageNumber += 1;
  y = PAGE_HEIGHT - MARGIN_TOP;

  const lines = reportMarkdown.replace(/```[\s\S]*?```/g, "").split("\n");

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y -= 8;
      continue;
    }

    const major = isMajorHeading(rawLine);
    const heading = isHeading(rawLine);
    const bullet = /^[-*]\s+/.test(trimmed);
    const text = normalizeLine(rawLine);
    const font = heading ? bold : regular;
    const fontSize = major ? 16 : heading ? 13 : 10;
    const lineHeight = major ? 20 : heading ? 17 : 13.5;
    const indent = bullet ? 12 : 0;
    const color = major ? rgb(0.08, 0.11, 0.22) : heading ? rgb(0.16, 0.18, 0.34) : rgb(0.12, 0.13, 0.16);
    const wrapped = wrapText(text, font, fontSize, CONTENT_WIDTH - indent);

    ensureSpace(wrapped.length * lineHeight + (heading ? 10 : 2));
    if (heading) y -= 6;

    wrapped.forEach((line, index) => {
      page.drawText(index > 0 && bullet ? `  ${line}` : line, {
        x: MARGIN_X + indent,
        y,
        size: fontSize,
        font,
        color,
      });
      y -= lineHeight;
    });

    if (heading) y -= 4;
  }

  drawPageChrome(page, pageNumber);

  return pdfDoc.save();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);
    const sessionToken = body?.sessionToken;
    const { report, month } = await loadReport(email, sessionToken);
    const pdfBytes = await createReportPdf(report.reportMarkdown, { email, month });
    const fileName = `relatorio-risco-carteira-${month}.pdf`;

    return new Response(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao gerar PDF do relatório." }, { status: err.status || 500 });
  }
}
