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
const PAGE_CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stripAccents(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function correctPortugueseText(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bpayload\b/gi, "dados recebidos"],
    [/\bjson\b/gi, "dados disponíveis"],
    [/\bbackend\b/gi, "sistema"],
    [/\bfrontend\b/gi, "tela"],
    [/\bendpoint\b/gi, "serviço"],
    [/\bAPI\b/g, "serviço"],
    [/\bbanco de dados\b/gi, "base de informações"],
    [/\bcampo\b/gi, "informação"],
    [/\bRelatorio\b/g, "Relatório"], [/\brelatorio\b/g, "relatório"],
    [/\bAnalise\b/g, "Análise"], [/\banalise\b/g, "análise"],
    [/\bDisponiveis\b/g, "Disponíveis"], [/\bdisponiveis\b/g, "disponíveis"],
    [/\bNao\b/g, "Não"], [/\bnao\b/g, "não"],
    [/\bPagina\b/g, "Página"], [/\bpagina\b/g, "página"],
    [/\bCompetencia\b/g, "Competência"], [/\bcompetencia\b/g, "competência"],
    [/\bCorrelacao\b/g, "Correlação"], [/\bcorrelacao\b/g, "correlação"],
    [/\bConcentracao\b/g, "Concentração"], [/\bconcentracao\b/g, "concentração"],
    [/\bExposicao\b/g, "Exposição"], [/\bexposicao\b/g, "exposição"],
    [/\bGeografica\b/g, "Geográfica"], [/\bgeografica\b/g, "geográfica"],
    [/\bGestao\b/g, "Gestão"], [/\bgestao\b/g, "gestão"],
    [/\bCredito\b/g, "Crédito"], [/\bcredito\b/g, "crédito"],
    [/\bInadimplencia\b/g, "Inadimplência"], [/\binadimplencia\b/g, "inadimplência"],
    [/\bTributacao\b/g, "Tributação"], [/\btributacao\b/g, "tributação"],
    [/\bRegulatorio\b/g, "Regulatório"], [/\bregulatorio\b/g, "regulatório"],
    [/\bRecomendacao\b/g, "Recomendação"], [/\brecomendacao\b/g, "recomendação"],
    [/\bEstrategia\b/g, "Estratégia"], [/\bestrategia\b/g, "estratégia"],
    [/\bGeracao\b/g, "Geração"], [/\bgeracao\b/g, "geração"],
    [/\bVariacao\b/g, "Variação"], [/\bvariacao\b/g, "variação"],
    [/\bCotacao\b/g, "Cotação"], [/\bcotacao\b/g, "cotação"],
    [/\bLiquidez diaria\b/g, "Liquidez diária"], [/\bliquidez diaria\b/g, "liquidez diária"],
    [/\bAcao\b/g, "Ação"], [/\bacao\b/g, "ação"],
    [/\bAcoes\b/g, "Ações"], [/\bacoes\b/g, "ações"],
  ];

  return replacements.reduce((text, [regex, replacement]) => text.replace(regex, replacement), value);
}

function sanitizePdfText(value: string) {
  return correctPortugueseText(String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\t/g, "  ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, ""));
}

function normalizeLine(line: string) {
  return sanitizePdfText(line)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
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

function isGeographicHeading(line: string) {
  if (!isHeading(line)) return false;
  return stripAccents(line).toLowerCase().includes("geografic");
}

function preprocessReportMarkdown(reportMarkdown: string) {
  const withoutCodeBlocks = String(reportMarkdown || "").replace(/```[\s\S]*?```/g, "");
  const lines = withoutCodeBlocks.split("\n");
  const output: string[] = [];
  let skippingGeography = false;

  for (const line of lines) {
    if (isGeographicHeading(line)) {
      skippingGeography = true;
      continue;
    }

    if (skippingGeography && isHeading(line)) {
      skippingGeography = false;
    }

    if (!skippingGeography) output.push(correctPortugueseText(line));
  }

  return output.join("\n");
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const cleanText = sanitizePdfText(text);
  const words = cleanText.split(/\s+/).filter(Boolean);
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

function splitTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => normalizeLine(cell.trim()));
}

function isTableSeparator(line: string) {
  const cells = splitTableLine(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.includes("|") && Boolean(lines[index + 1]) && isTableSeparator(lines[index + 1]);
}

function parseMarkdownTable(lines: string[], startIndex: number) {
  const headers = splitTableLine(lines[startIndex]);
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].includes("|")) {
    const row = splitTableLine(lines[index]);
    if (!row.length) break;
    rows.push(row);
    index += 1;
  }

  return { headers, rows, nextIndex: index };
}

function segmentNameOf(item: any) {
  return String(item?.segment || item?.sector || item?.fundType || "Sem segmento").trim() || "Sem segmento";
}

function buildSegmentChartData(portfolio: any[]) {
  const totals = new Map<string, number>();

  if (!Array.isArray(portfolio)) return [];

  portfolio.forEach((item) => {
    const label = segmentNameOf(item);
    const value = Number(item?.quantity || item?.quotas || 0) || Number(item?.currentValue || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    totals.set(label, (totals.get(label) || 0) + value);
  });

  const sorted = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= 6) return sorted;

  const main = sorted.slice(0, 5);
  const others = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
  return [...main, { label: "Outros", value: others }];
}

function pieSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
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

async function createReportPdf(report: any, metadata: { email: string; month: string }) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const chartColors = [
    rgb(0.31, 0.36, 0.96),
    rgb(0.06, 0.66, 0.45),
    rgb(0.96, 0.62, 0.16),
    rgb(0.88, 0.28, 0.35),
    rgb(0.48, 0.35, 0.88),
    rgb(0.25, 0.58, 0.78),
  ];

  let page: any = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let pageNumber = 1;

  function drawTextSafe(currentPage: any, text: string, options: any) {
    const cleanText = sanitizePdfText(text);
    try {
      currentPage.drawText(cleanText, options);
    } catch {
      currentPage.drawText(stripAccents(cleanText).replace(/[^\x20-\x7E]/g, ""), options);
    }
  }

  function drawWatermark(currentPage: any) {
    const watermarkColor = rgb(0.86, 0.88, 0.96);
    [250, 380, 510].forEach((positionY) => {
      drawTextSafe(currentPage, "Dados FII", {
        x: 54,
        y: positionY,
        size: 44,
        font: bold,
        color: watermarkColor,
        rotate: degrees(35),
        opacity: 0.10,
      });
    });
  }

  function drawPageChrome(currentPage: any, currentPageNumber: number) {
    drawWatermark(currentPage);
    currentPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 44, width: PAGE_WIDTH, height: 44, color: rgb(0.07, 0.09, 0.16) });
    drawTextSafe(currentPage, "Dados FII", { x: MARGIN_X, y: PAGE_HEIGHT - 29, size: 13, font: bold, color: rgb(1, 1, 1) });
    drawTextSafe(currentPage, "Relatório de risco da carteira", { x: MARGIN_X + 84, y: PAGE_HEIGHT - 29, size: 10, font: regular, color: rgb(0.82, 0.86, 0.95) });

    currentPage.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
      thickness: 0.5,
      color: rgb(0.82, 0.84, 0.88),
    });
    drawTextSafe(currentPage, `Gerado em ${formatDatePtBr()} - ${metadata.email}`, {
      x: MARGIN_X,
      y: 26,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.47, 0.52),
    });
    drawTextSafe(currentPage, `Página ${currentPageNumber}`, {
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

  function remainingHeight() {
    return y - MARGIN_BOTTOM;
  }

  function ensureSpace(height: number) {
    if (remainingHeight() < height) {
      newPage();
      return true;
    }
    return false;
  }

  function drawHeading(text: string, size = 13) {
    ensureSpace(Math.max(110, size + 42));
    y -= 6;
    drawTextSafe(page, text, { x: MARGIN_X, y, size, font: bold, color: rgb(0.16, 0.18, 0.34) });
    y -= size + 8;
  }

  function drawParagraph(text: string, options?: { heading?: boolean; major?: boolean; bullet?: boolean }) {
    const font = options?.heading ? bold : regular;
    const fontSize = options?.major ? 16 : options?.heading ? 13 : 10;
    const lineHeight = options?.major ? 20 : options?.heading ? 17 : 13.5;
    const indent = options?.bullet ? 12 : 0;
    const color = options?.major ? rgb(0.08, 0.11, 0.22) : options?.heading ? rgb(0.16, 0.18, 0.34) : rgb(0.12, 0.13, 0.16);
    const wrapped = wrapText(text, font, fontSize, CONTENT_WIDTH - indent);
    const requiredHeight = wrapped.length * lineHeight + (options?.heading ? 46 : 2);

    if (options?.heading) ensureSpace(Math.max(110, requiredHeight));
    else ensureSpace(requiredHeight);

    if (options?.heading) y -= 6;

    wrapped.forEach((line, index) => {
      drawTextSafe(page, index > 0 && options?.bullet ? `  ${line}` : line, {
        x: MARGIN_X + indent,
        y,
        size: fontSize,
        font,
        color,
      });
      y -= lineHeight;
    });

    if (options?.heading) y -= 4;
  }

  function renderTable(headers: string[], rows: string[][]) {
    const colCount = Math.max(headers.length, ...rows.map((row) => row.length));
    if (colCount < 2) return;

    const fontSize = colCount >= 7 ? 6.2 : colCount >= 5 ? 7.2 : 8.2;
    const lineHeight = fontSize + 2.8;
    const colWidth = CONTENT_WIDTH / colCount;
    const padding = 4;

    function normalizeRow(row: string[]) {
      return Array.from({ length: colCount }, (_, index) => sanitizePdfText(row[index] || ""));
    }

    function measureRow(row: string[]) {
      const cellLines = normalizeRow(row).map((cell) => wrapText(cell, regular, fontSize, colWidth - padding * 2));
      const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
      return { cellLines, height: Math.max(22, maxLines * lineHeight + padding * 2) };
    }

    const headerMeasure = measureRow(headers);
    const rowMeasures = rows.map((row) => measureRow(row));
    const tableHeight = headerMeasure.height + rowMeasures.reduce((sum, row) => sum + row.height, 0) + 14;

    if (tableHeight <= PAGE_CONTENT_HEIGHT && tableHeight > remainingHeight()) {
      newPage();
    }

    function drawMeasuredRow(row: string[], measured: { cellLines: string[][]; height: number }, isHeader = false) {
      const rowY = y - measured.height + 6;

      for (let col = 0; col < colCount; col += 1) {
        const x = MARGIN_X + col * colWidth;
        page.drawRectangle({
          x,
          y: rowY,
          width: colWidth,
          height: measured.height,
          color: isHeader ? rgb(0.90, 0.92, 0.98) : rgb(1, 1, 1),
          borderColor: rgb(0.80, 0.82, 0.88),
          borderWidth: 0.5,
        });

        const cellFont = isHeader ? bold : regular;
        const cellColor = isHeader ? rgb(0.10, 0.12, 0.22) : rgb(0.12, 0.13, 0.16);
        measured.cellLines[col].forEach((line, lineIndex) => {
          drawTextSafe(page, line, {
            x: x + padding,
            y: y - padding - fontSize - lineIndex * lineHeight,
            size: fontSize,
            font: cellFont,
            color: cellColor,
          });
        });
      }

      y -= measured.height;
    }

    function drawHeader() {
      if (headerMeasure.height > remainingHeight()) newPage();
      drawMeasuredRow(headers, headerMeasure, true);
    }

    y -= 4;
    drawHeader();

    rows.forEach((row, index) => {
      const measured = rowMeasures[index];
      if (measured.height > remainingHeight()) {
        newPage();
        drawHeader();
      }
      drawMeasuredRow(row, measured, false);
    });

    y -= 10;
  }

  function drawHorizontalSegmentBars(data: Array<{ label: string; value: number }>, total: number) {
    const maxValue = Math.max(...data.map((item) => item.value));
    const startX = MARGIN_X;
    const labelWidth = 145;
    const barMaxWidth = CONTENT_WIDTH - labelWidth - 58;
    let barY = y - 10;

    data.forEach((item, index) => {
      const percent = ((item.value / total) * 100).toFixed(1).replace(".", ",");
      const barWidth = maxValue ? (item.value / maxValue) * barMaxWidth : 0;
      const wrappedLabel = wrapText(item.label, regular, 8.5, labelWidth - 8).slice(0, 2);

      wrappedLabel.forEach((line, lineIndex) => {
        drawTextSafe(page, line, { x: startX, y: barY - lineIndex * 10, size: 8.5, font: regular, color: rgb(0.15, 0.16, 0.22) });
      });
      page.drawRectangle({ x: startX + labelWidth, y: barY - 2, width: barMaxWidth, height: 9, color: rgb(0.91, 0.93, 0.98) });
      page.drawRectangle({ x: startX + labelWidth, y: barY - 2, width: Math.max(2, barWidth), height: 9, color: chartColors[index % chartColors.length] });
      drawTextSafe(page, `${percent}%`, { x: startX + labelWidth + barMaxWidth + 8, y: barY - 2, size: 8.5, font: bold, color: rgb(0.15, 0.16, 0.22) });
      barY -= Math.max(24, wrappedLabel.length * 10 + 8);
    });

    y = barY - 8;
  }

  function drawSegmentChart(portfolio: any[]) {
    const data = buildSegmentChartData(portfolio);
    if (!data.length) return;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (!total) return;

    ensureSpace(252);
    drawHeading("Concentração por segmento", 14);

    const centerX = MARGIN_X + 95;
    const centerY = y - 76;
    const radius = 64;
    let angle = -Math.PI / 2;
    let pieRendered = true;

    if (data.length === 1) {
      page.drawCircle({ x: centerX, y: centerY, size: radius, color: chartColors[0] });
    } else {
      for (let index = 0; index < data.length; index += 1) {
        const item = data[index];
        const endAngle = angle + (item.value / total) * Math.PI * 2;
        const path = pieSlicePath(centerX, centerY, radius, angle, endAngle);
        try {
          page.drawSvgPath(path, { color: chartColors[index % chartColors.length] });
        } catch {
          pieRendered = false;
          break;
        }
        angle = endAngle;
      }
    }

    if (pieRendered) {
      const legendX = MARGIN_X + 190;
      let legendY = y - 20;

      data.forEach((item, index) => {
        const percent = ((item.value / total) * 100).toFixed(1).replace(".", ",");
        page.drawRectangle({ x: legendX, y: legendY - 2, width: 10, height: 10, color: chartColors[index % chartColors.length] });
        const legendText = `${item.label}: ${percent}%`;
        const wrapped = wrapText(legendText, regular, 9, CONTENT_WIDTH - 210);
        wrapped.forEach((line, lineIndex) => {
          drawTextSafe(page, line, { x: legendX + 16, y: legendY - lineIndex * 11, size: 9, font: regular, color: rgb(0.15, 0.16, 0.22) });
        });
        legendY -= Math.max(16, wrapped.length * 11 + 4);
      });

      drawTextSafe(page, "Base: quantidade de cotas por segmento disponível na carteira.", {
        x: MARGIN_X,
        y: y - 160,
        size: 8,
        font: regular,
        color: rgb(0.42, 0.44, 0.50),
      });

      y -= 194;
      return;
    }

    drawHorizontalSegmentBars(data, total);
    drawTextSafe(page, "Base: quantidade de cotas por segmento disponível na carteira. Representação em barras usada como alternativa ao gráfico de pizza.", {
      x: MARGIN_X,
      y,
      size: 8,
      font: regular,
      color: rgb(0.42, 0.44, 0.50),
    });
    y -= 18;
  }

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.96, 0.97, 0.99) });
  drawTextSafe(page, "Dados FII", { x: MARGIN_X, y: PAGE_HEIGHT - 110, size: 22, font: bold, color: rgb(0.15, 0.18, 0.32) });
  drawTextSafe(page, "Relatório de risco da carteira", { x: MARGIN_X, y: PAGE_HEIGHT - 150, size: 28, font: titleFont, color: rgb(0.05, 0.07, 0.14) });
  drawTextSafe(page, `Competência: ${metadata.month}`, { x: MARGIN_X, y: PAGE_HEIGHT - 178, size: 12, font: regular, color: rgb(0.35, 0.38, 0.45) });
  drawTextSafe(page, `Gerado em ${formatDatePtBr()}`, { x: MARGIN_X, y: PAGE_HEIGHT - 198, size: 12, font: regular, color: rgb(0.35, 0.38, 0.45) });
  drawTextSafe(page, "Análise educacional baseada nos dados disponíveis. Não constitui recomendação individual definitiva.", {
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

  drawSegmentChart(report.portfolio || []);

  const lines = preprocessReportMarkdown(report.reportMarkdown).split("\n");

  for (let index = 0; index < lines.length;) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y -= 8;
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseMarkdownTable(lines, index);
      renderTable(table.headers, table.rows);
      index = table.nextIndex;
      continue;
    }

    const major = isMajorHeading(rawLine);
    const heading = isHeading(rawLine);
    const bullet = /^[-*]\s+/.test(trimmed);
    const text = normalizeLine(rawLine);

    if (heading && remainingHeight() < 110) newPage();
    drawParagraph(text, { major, heading, bullet });
    index += 1;
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
    const pdfBytes = await createReportPdf(report, { email, month });
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
