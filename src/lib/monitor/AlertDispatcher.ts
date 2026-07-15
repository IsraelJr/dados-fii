import nodemailer from "nodemailer";
import type { MonitorAlert, MonitorDelivery } from "@/types/monitor";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function emails() {
  return String(process.env.MONITOR_ALERT_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function plainMessage(alerts: MonitorAlert[]) {
  return [
    `Dados FII — ${alerts.length} alerta(s) sistêmico(s)`,
    "",
    ...alerts.flatMap((alert) => [
      `[${alert.severity.toUpperCase()}] ${alert.title}`,
      alert.message,
      `Componente: ${alert.component}`,
      "",
    ]),
  ].join("\n").slice(0, 3_800);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

export class AlertDispatcher {
  private readonly fetcher: Fetcher;

  constructor(fetcher: Fetcher = fetch) {
    this.fetcher = fetcher;
  }

  private async email(alerts: MonitorAlert[]): Promise<MonitorDelivery> {
    const recipients = emails();
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    if (!recipients.length || !host || !user || !pass || !from) return { channel: "email", status: "skipped", detail: "SMTP ou destinatários não configurados." };
    try {
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
        auth: { user, pass },
      });
      const content = plainMessage(alerts);
      await transport.sendMail({
        from,
        to: recipients.join(","),
        subject: `[Dados FII] ${alerts.some((alert) => alert.severity === "critical") ? "CRÍTICO" : "Alerta"} — Monitor sistêmico`,
        text: content,
        html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(content)}</pre>`,
      });
      return { channel: "email", status: "sent", detail: `${recipients.length} destinatário(s).` };
    } catch (error) {
      return { channel: "email", status: "failed", detail: error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida." };
    }
  }

  private async telegram(alerts: MonitorAlert[]): Promise<MonitorDelivery> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { channel: "telegram", status: "skipped", detail: "Bot ou chat não configurado." };
    try {
      const response = await this.fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: plainMessage(alerts), disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
      return { channel: "telegram", status: "sent" };
    } catch (error) {
      return { channel: "telegram", status: "failed", detail: error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida." };
    }
  }

  async dispatch(alerts: MonitorAlert[]) {
    if (!alerts.length) return [] as MonitorDelivery[];
    return Promise.all([this.email(alerts), this.telegram(alerts)]);
  }
}

export const alertDispatcher = new AlertDispatcher();
