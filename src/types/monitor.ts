export type MonitorSeverity = "warning" | "critical";
export type MonitorAlertStatus = "active" | "resolved";

export type MonitorAlert = {
  fingerprint: string;
  code: string;
  title: string;
  message: string;
  severity: MonitorSeverity;
  component: string;
  status: MonitorAlertStatus;
  detectedAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type MonitorDelivery = {
  channel: "panel" | "firestore" | "email";
  status: "sent" | "stored" | "skipped" | "failed";
  detail?: string;
};

export type MonitorRun = {
  id: string;
  actor: string;
  status: "healthy" | "warning" | "critical" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  healthScore: number;
  alerts: MonitorAlert[];
  deliveries: MonitorDelivery[];
  totals: { alerts: number; warning: number; critical: number; notified: number };
  error?: string;
};

export type MonitorStatus = {
  generatedAt: string;
  latestRun: MonitorRun | null;
  activeAlerts: MonitorAlert[];
  recentRuns: MonitorRun[];
};
