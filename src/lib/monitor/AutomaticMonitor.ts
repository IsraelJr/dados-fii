import { featureEnabled } from "@/lib/featureFlags";
import { alertDispatcher, type AlertDispatcher } from "@/lib/monitor/AlertDispatcher";
import { evaluateMonitorAlerts } from "@/lib/monitor/MonitorRules";
import { regulatoryRepository, type RegulatoryRepository } from "@/lib/regulatory/RegulatoryRepository";
import type { MonitorDelivery, MonitorRun } from "@/types/monitor";
import type { ParserHealth, SystemHealth, ValidationRun } from "@/types/regulatory";

const configuredCooldownMs = Number(process.env.MONITOR_ALERT_COOLDOWN_MS || 6 * 60 * 60_000);
const ALERT_COOLDOWN_MS = Number.isFinite(configuredCooldownMs) && configuredCooldownMs >= 60_000
  ? configuredCooldownMs
  : 6 * 60 * 60_000;

type MonitorInput = {
  actor: string;
  health: SystemHealth;
  parsers: ParserHealth[];
  latestValidation: ValidationRun | null;
};

export class AutomaticMonitorError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "AutomaticMonitorError";
    this.code = code;
    this.status = status;
  }
}

export class AutomaticMonitor {
  private readonly repository: RegulatoryRepository;
  private readonly dispatcher: AlertDispatcher;

  constructor(repository: RegulatoryRepository = regulatoryRepository, dispatcher: AlertDispatcher = alertDispatcher) {
    this.repository = repository;
    this.dispatcher = dispatcher;
  }

  async run(input: MonitorInput): Promise<MonitorRun> {
    if (!featureEnabled("ENABLE_AUTOMATIC_MONITOR", false)) {
      throw new AutomaticMonitorError("Monitor automático está desabilitado.", "AUTOMATIC_MONITOR_DISABLED", 503);
    }
    const runId = this.repository.monitorRunId();
    const lockOwner = `${runId}:${input.actor}`;
    if (!await this.repository.acquireMonitorLock(lockOwner)) {
      throw new AutomaticMonitorError("Já existe uma execução do monitor em andamento.", "MONITOR_ALREADY_RUNNING", 409);
    }
    try {
      const startedMs = Date.now();
      const startedAt = new Date(startedMs).toISOString();
      const alerts = evaluateMonitorAlerts(input, startedAt);
      const stored = await Promise.all(alerts.map((item) => this.repository.upsertMonitorAlert(item, ALERT_COOLDOWN_MS)));
      await this.repository.resolveMonitorAlerts(alerts.map((item) => item.fingerprint), startedAt);
      const notifyAlerts = stored.filter((item) => item.shouldNotify).map((item) => item.alert);
      const channelDeliveries = await this.dispatcher.dispatch(notifyAlerts);
      const deliveries: MonitorDelivery[] = [
        { channel: "panel", status: "stored", detail: `${alerts.length} alerta(s) disponível(is).` },
        { channel: "firestore", status: "stored", detail: `${alerts.length} alerta(s) persistido(s).` },
        ...channelDeliveries,
      ];
      if (notifyAlerts.length) await Promise.all(notifyAlerts.map((item) => this.repository.markMonitorAlertNotified(item.fingerprint, channelDeliveries)));
      const critical = alerts.filter((item) => item.severity === "critical").length;
      const warning = alerts.filter((item) => item.severity === "warning").length;
      const run: MonitorRun = {
        id: runId,
        actor: input.actor,
        status: critical ? "critical" : warning ? "warning" : "healthy",
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        healthScore: input.health.score,
        alerts,
        deliveries,
        totals: { alerts: alerts.length, warning, critical, notified: notifyAlerts.length },
      };
      await this.repository.saveMonitorRun(run);
      return run;
    } finally {
      await this.repository.releaseMonitorLock(lockOwner).catch(() => undefined);
    }
  }

  async failed(actor: string, error: unknown): Promise<MonitorRun> {
    const now = new Date().toISOString();
    const run: MonitorRun = {
      id: this.repository.monitorRunId(),
      actor,
      status: "failed",
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      healthScore: 0,
      alerts: [],
      deliveries: [],
      totals: { alerts: 0, warning: 0, critical: 0, notified: 0 },
      error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
    };
    await this.repository.saveMonitorRun(run).catch(() => undefined);
    return run;
  }
}

export const automaticMonitor = new AutomaticMonitor();
