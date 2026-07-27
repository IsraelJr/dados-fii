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
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MONITOR_EMAIL_FROM || process.env.WALLET_EMAIL_FROM || "Dados FII <no-reply@dadosfii.com.br>";
    if (!recipients.length || !apiKey) {
      return { channel: "email", status: "skipped", detail: "Resend ou destinatários não configurados." };
    }

    try {
      const content = plainMessage(alerts);
      const response = await this.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: `[Dados FII] ${alerts.some((alert) => alert.severity === "critical") ? "CRÍTICO" : "Alerta"} — Monitor sistêmico`,
          text: content,
          html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(content)}</pre>`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
      return { channel: "email", status: "sent", detail: `${recipients.length} destinatário(s).` };
    } catch {
      return { channel: "email", status: "failed", detail: "Falha sanitizada no provedor de e-mail." };
    }
  }

  async dispatch(alerts: MonitorAlert[]) {
    if (!alerts.length) return [] as MonitorDelivery[];
    return Promise.all([this.email(alerts)]);
  }
}

export const alertDispatcher = new AlertDispatcher();
