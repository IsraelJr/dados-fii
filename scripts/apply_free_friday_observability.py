from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise SystemExit(f"Target not found in {path}: {old[:160]!r}")
    file_path.write_text(text.replace(old, new, 1))


# 1) Plano grátis: resumo somente às sextas-feiras.
engine = "src/lib/portfolioNotificationEngine.ts"
replace_once(
    engine,
    'import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";\n',
    'import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";\nimport { logObservabilityEvent } from "@/lib/observability";\n',
)
replace_once(
    engine,
    "  digestSent?: boolean;\n  error?: string;\n",
    "  digestSent?: boolean;\n  digestSchedule?: string;\n  error?: string;\n",
)
replace_once(
    engine,
    '    const schedule = String(preferences.digestSchedule || process.env.PORTFOLIO_DIGEST_SCHEDULE || "daily");\n',
    '    const schedule = isVip\n      ? String(preferences.digestSchedule || process.env.PORTFOLIO_DIGEST_SCHEDULE || "daily")\n      : "weekly:5";\n',
)
replace_once(
    engine,
    "      lastDigestDate: nextLastDigestDate || null,\n      lastProcessedDate: now.dateKey,\n",
    "      lastDigestDate: nextLastDigestDate || null,\n      digestSchedule: schedule,\n      lastProcessedDate: now.dateKey,\n",
)
replace_once(
    engine,
    '    return { userId: doc.id, email, status: "processed", isVip, walletCount: wallet.length, notificationsCreated, emailsSent, digestSent };\n',
    '    return { userId: doc.id, email, status: "processed", isVip, walletCount: wallet.length, notificationsCreated, emailsSent, digestSent, digestSchedule: schedule };\n',
)
replace_once(
    engine,
    'export async function processPortfolioNotifications(options?: { limit?: number }) {\n  if (!envBoolean("PORTFOLIO_NOTIFICATIONS_ENABLED", true)) {\n',
    'export async function processPortfolioNotifications(options?: { limit?: number }) {\n  const startedAt = Date.now();\n  if (!envBoolean("PORTFOLIO_NOTIFICATIONS_ENABLED", true)) {\n',
)
replace_once(
    engine,
    "    acc.digestsSent = (acc.digestsSent || 0) + Number(item.digestSent ? 1 : 0);\n    return acc;\n",
    "    acc.digestsSent = (acc.digestsSent || 0) + Number(item.digestSent ? 1 : 0);\n    acc.freeUsers = (acc.freeUsers || 0) + Number(item.isVip === false);\n    acc.vipUsers = (acc.vipUsers || 0) + Number(item.isVip === true);\n    return acc;\n",
)
replace_once(
    engine,
    '  await adminDb.collection("PortfolioNotificationRuns").add({\n    dateKey: now.dateKey,\n    limit,\n    totalUsersRead: snapshot.size,\n    summary,\n    createdAt: adminFieldValue.serverTimestamp(),\n  });\n\n  return { ok: true, dateKey: now.dateKey, limit, totalUsersRead: snapshot.size, summary, results };\n',
    '  const durationMs = Date.now() - startedAt;\n  const runPayload = {\n    ok: Number(summary.error || 0) === 0,\n    dateKey: now.dateKey,\n    limit,\n    totalUsersRead: snapshot.size,\n    durationMs,\n    summary,\n    createdAt: adminFieldValue.serverTimestamp(),\n  };\n\n  await adminDb.collection("PortfolioNotificationRuns").add(runPayload);\n  await logObservabilityEvent({\n    type: "portfolio_notifications",\n    ok: runPayload.ok,\n    statusCode: runPayload.ok ? 200 : 207,\n    source: "vercel-cron",\n    message: `Processamento de notificações: ${summary.processed || 0} processado(s), ${summary.emailsSent || 0} e-mail(s), ${summary.error || 0} erro(s).`,\n    metadata: {\n      dateKey: now.dateKey,\n      totalUsersRead: snapshot.size,\n      durationMs,\n      summary,\n    },\n  });\n\n  return { ok: runPayload.ok, dateKey: now.dateKey, limit, totalUsersRead: snapshot.size, durationMs, summary, results };\n',
)

# 2) Observabilidade aceita o novo tipo de evento.
replace_once(
    "src/lib/observability.ts",
    '  type: "fii_lookup" | "fii_batch_lookup" | "risk_report" | "system";\n',
    '  type: "fii_lookup" | "fii_batch_lookup" | "risk_report" | "portfolio_notifications" | "system";\n',
)

# 3) API de observabilidade: métricas e execuções de notificações.
obs_api = "src/app/api/admin/observability/route.ts"
portfolio_fn = '''
async function getPortfolioNotifications() {
  try {
    const snapshot = await adminDb.collection("PortfolioNotificationRuns").orderBy("createdAt", "desc").limit(20).get();
    const runs = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const summary = data.summary || {};
      return {
        id: doc.id,
        ok: data.ok !== false && Number(summary.error || 0) === 0,
        dateKey: data.dateKey || null,
        totalUsersRead: Number(data.totalUsersRead || 0),
        durationMs: Number(data.durationMs || 0),
        processed: Number(summary.processed || 0),
        skipped: Number(summary.skipped || 0),
        errors: Number(summary.error || 0),
        freeUsers: Number(summary.freeUsers || 0),
        vipUsers: Number(summary.vipUsers || 0),
        notificationsCreated: Number(summary.notificationsCreated || 0),
        emailsSent: Number(summary.emailsSent || 0),
        digestsSent: Number(summary.digestsSent || 0),
        createdAt: toIso(data.createdAt),
      };
    });

    const totals = runs.reduce((acc, run) => {
      acc.totalUsersRead += run.totalUsersRead;
      acc.processed += run.processed;
      acc.skipped += run.skipped;
      acc.errors += run.errors;
      acc.freeUsers += run.freeUsers;
      acc.vipUsers += run.vipUsers;
      acc.notificationsCreated += run.notificationsCreated;
      acc.emailsSent += run.emailsSent;
      acc.digestsSent += run.digestsSent;
      return acc;
    }, { totalUsersRead: 0, processed: 0, skipped: 0, errors: 0, freeUsers: 0, vipUsers: 0, notificationsCreated: 0, emailsSent: 0, digestsSent: 0 });

    return {
      ok: true,
      hasRuns: runs.length > 0,
      totalRuns: runs.length,
      ...totals,
      latest: runs[0] || null,
      recent: runs.slice(0, 10),
    };
  } catch (err: any) {
    return {
      ok: false,
      hasRuns: false,
      totalRuns: 0,
      totalUsersRead: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      freeUsers: 0,
      vipUsers: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      digestsSent: 0,
      recent: [],
      error: err.message || "Erro ao consultar notificações da carteira",
    };
  }
}
'''
replace_once(obs_api, "\nfunction summarizeLookups(events: any[]) {\n", portfolio_fn + "\nfunction summarizeLookups(events: any[]) {\n")
replace_once(
    obs_api,
    '  const [fiis, userReports, walletSessions, benchmarks, traffic, reports, events] = await Promise.all([sampleCollection("Fiis"), sampleCollection("UserRiskReports"), sampleCollection("WalletSessions"), getBenchmarks(), getStats(), getReports(), getEvents()]);\n',
    '  const [fiis, userReports, walletSessions, benchmarks, traffic, reports, portfolioNotifications, events] = await Promise.all([sampleCollection("Fiis"), sampleCollection("UserRiskReports"), sampleCollection("WalletSessions"), getBenchmarks(), getStats(), getReports(), getPortfolioNotifications(), getEvents()]);\n',
)
replace_once(
    obs_api,
    '    { key: "sessions", label: "Sessoes de carteira", ok: walletSessions.ok && walletSessions.hasSample, detail: walletSessions.hasSample ? "Sessoes encontradas" : "Nenhuma sessao" },\n',
    '    { key: "sessions", label: "Sessoes de carteira", ok: walletSessions.ok && walletSessions.hasSample, detail: walletSessions.hasSample ? "Sessoes encontradas" : "Nenhuma sessao" },\n    { key: "portfolioNotifications", label: "Notificações da carteira", ok: Boolean(portfolioNotifications.ok), detail: portfolioNotifications.hasRuns ? `${portfolioNotifications.totalRuns} execução(ões) recente(s) · ${portfolioNotifications.emailsSent} e-mail(s)` : "Aguardando primeira execução" },\n',
)
replace_once(
    obs_api,
    '  return { ok: services.every((service) => service.ok), generatedAt: new Date().toISOString(), health: { score: Math.round((healthy / services.length) * 100), healthyServices: healthy, totalServices: services.length, services }, traffic, lookups, reports, benchmarks, collections: { fiis, userReports, walletSessions }, recentEvents: events.slice(0, 20) };\n',
    '  return { ok: services.every((service) => service.ok), generatedAt: new Date().toISOString(), health: { score: Math.round((healthy / services.length) * 100), healthyServices: healthy, totalServices: services.length, services }, traffic, lookups, reports, portfolioNotifications, benchmarks, collections: { fiis, userReports, walletSessions }, recentEvents: events.slice(0, 20) };\n',
)

# 4) Painel Admin: cards e tabela das notificações.
obs_page = "src/app/admin/observabilidade/page.tsx"
replace_once(
    obs_page,
    'import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, Database, Eye, FileText, Home, KeyRound, Menu, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";\n',
    'import { Activity, AlertTriangle, BarChart3, BellRing, CheckCircle2, Clock, Database, Eye, FileText, Home, KeyRound, MailCheck, Menu, RefreshCw, Search, ShieldCheck, Users, XCircle } from "lucide-react";\n',
)
replace_once(
    obs_page,
    'type LookupEvent = { id: string; type?: string; ok: boolean; statusCode: number; ticker?: string | null; error?: string | null; source?: string | null; createdAt?: string | null };\n',
    'type LookupEvent = { id: string; type?: string; ok: boolean; statusCode: number; ticker?: string | null; error?: string | null; source?: string | null; createdAt?: string | null };\ntype PortfolioRun = { id: string; ok: boolean; dateKey?: string | null; totalUsersRead: number; durationMs: number; processed: number; skipped: number; errors: number; freeUsers: number; vipUsers: number; notificationsCreated: number; emailsSent: number; digestsSent: number; createdAt?: string | null };\ntype PortfolioNotificationSummary = { ok: boolean; hasRuns: boolean; totalRuns: number; totalUsersRead: number; processed: number; skipped: number; errors: number; freeUsers: number; vipUsers: number; notificationsCreated: number; emailsSent: number; digestsSent: number; latest?: PortfolioRun | null; recent: PortfolioRun[]; error?: string };\n',
)
replace_once(
    obs_page,
    '  reports?: { ok: boolean; totalSample: number; done: number; pending: number; failed: number; latest?: { id: string; status?: string | null; month?: string | null; updatedAt?: string | null }; error?: string };\n  benchmarks?: any;\n',
    '  reports?: { ok: boolean; totalSample: number; done: number; pending: number; failed: number; latest?: { id: string; status?: string | null; month?: string | null; updatedAt?: string | null }; error?: string };\n  portfolioNotifications?: PortfolioNotificationSummary;\n  benchmarks?: any;\n',
)
replace_once(
    obs_page,
    '  { href: "#relatorios", label: "Relatórios", icon: FileText },\n  { href: "#eventos", label: "Eventos recentes", icon: Activity },\n',
    '  { href: "#relatorios", label: "Relatórios", icon: FileText },\n  { href: "#notificacoes", label: "Notificações", icon: BellRing },\n  { href: "#eventos", label: "Eventos recentes", icon: Activity },\n',
)
replace_once(
    obs_page,
    '  const reportSummary = data?.reports;\n  const health = data?.health;\n',
    '  const reportSummary = data?.reports;\n  const notificationSummary = data?.portfolioNotifications;\n  const health = data?.health;\n',
)
replace_once(
    obs_page,
    '          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">\n',
    '          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">\n',
)
replace_once(
    obs_page,
    '            <MetricCard title="Relatórios" value={reportSummary?.done || 0} detail={`${reportSummary?.pending || 0} pendente(s) · ${reportSummary?.failed || 0} falha(s)`} icon={FileText} kind={(reportSummary?.failed || 0) > 0 ? "error" : "success"} />\n          </section>\n',
    '            <MetricCard title="Relatórios" value={reportSummary?.done || 0} detail={`${reportSummary?.pending || 0} pendente(s) · ${reportSummary?.failed || 0} falha(s)`} icon={FileText} kind={(reportSummary?.failed || 0) > 0 ? "error" : "success"} />\n            <MetricCard title="E-mails de carteira" value={notificationSummary?.emailsSent || 0} detail={`${notificationSummary?.digestsSent || 0} resumo(s) · ${notificationSummary?.notificationsCreated || 0} notificação(ões)`} icon={MailCheck} kind={(notificationSummary?.errors || 0) > 0 ? "error" : "success"} />\n            <MetricCard title="Execuções do monitor" value={notificationSummary?.totalRuns || 0} detail={`${notificationSummary?.processed || 0} processado(s) · ${notificationSummary?.errors || 0} erro(s)`} icon={BellRing} kind={(notificationSummary?.errors || 0) > 0 ? "error" : "success"} />\n          </section>\n',
)
notification_section = '''
          <section id="notificacoes" className="scroll-mt-24 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BellRing size={14} /> Notificações da carteira</p><h2 className="mt-3 text-2xl font-black text-slate-900">Cron, e-mails e resumos</h2><p className="mt-1 text-sm text-slate-500">O plano grátis recebe o resumo às sextas-feiras. O plano VIP mantém frequência configurável.</p></div>
              <HealthBadge ok={Boolean(notificationSummary?.ok)} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Usuários lidos" value={notificationSummary?.totalUsersRead || 0} detail={`${notificationSummary?.freeUsers || 0} grátis · ${notificationSummary?.vipUsers || 0} VIP`} icon={Users} kind="neutral" />
              <MetricCard title="Processados" value={notificationSummary?.processed || 0} detail={`${notificationSummary?.skipped || 0} ignorado(s)`} icon={CheckCircle2} kind="success" />
              <MetricCard title="Criadas" value={notificationSummary?.notificationsCreated || 0} detail="Central e toast" icon={BellRing} kind="neutral" />
              <MetricCard title="E-mails" value={notificationSummary?.emailsSent || 0} detail="Alertas e resumos" icon={MailCheck} kind="success" />
              <MetricCard title="Resumos" value={notificationSummary?.digestsSent || 0} detail="Carteiras enviadas" icon={FileText} kind="success" />
              <MetricCard title="Erros" value={notificationSummary?.errors || 0} detail={notificationSummary?.error || "Execuções recentes"} icon={AlertTriangle} kind={(notificationSummary?.errors || 0) > 0 ? "error" : "success"} />
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-indigo-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-700"><tr><th className="px-4 py-3">Execução</th><th className="px-4 py-3">Usuários</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Envios</th><th className="px-4 py-3">Duração</th></tr></thead>
                <tbody className="divide-y divide-indigo-50 bg-white">
                  {(notificationSummary?.recent || []).map((run) => <tr key={run.id} className="align-top"><td className="px-4 py-3 font-bold text-slate-900">{formatDateTime(run.createdAt)}<p className="mt-1 text-xs font-medium text-slate-500">{run.dateKey || "-"}</p></td><td className="px-4 py-3 text-slate-600">{run.totalUsersRead}<p className="mt-1 text-xs">{run.freeUsers} grátis · {run.vipUsers} VIP</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${run.errors ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{run.processed} OK · {run.errors} erro(s)</span><p className="mt-2 text-xs text-slate-500">{run.skipped} ignorado(s)</p></td><td className="px-4 py-3 text-slate-600">{run.emailsSent} e-mail(s)<p className="mt-1 text-xs">{run.digestsSent} resumo(s) · {run.notificationsCreated} criada(s)</p></td><td className="px-4 py-3 text-slate-600">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}</td></tr>)}
                  {!(notificationSummary?.recent || []).length && <tr><td className="px-4 py-6 text-center text-sm font-bold text-slate-500" colSpan={5}>Aguardando a primeira execução do cron de notificações.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
'''
replace_once(obs_page, '\n          <section id="pesquisas"', notification_section + '\n          <section id="pesquisas"')

# 5) Node 22 fixo para respeitar a configuração da Vercel e não saltar para Node 24.
package = Path("package.json")
package_data = json.loads(package.read_text())
package_data.setdefault("engines", {})["node"] = "22.x"
package.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + "\n")

# 6) Documentação.
docs = "docs/portfolio-notifications.md"
replace_once(docs, "- Resumo periódico da carteira.\n", "- Resumo completo da carteira enviado toda sexta-feira.\n")
replace_once(
    docs,
    "PORTFOLIO_DIGEST_SCHEDULE=daily\n",
    "PORTFOLIO_DIGEST_SCHEDULE=daily # usado pelo VIP; grátis é fixo em weekly:5\n",
)
replace_once(
    docs,
    "`PORTFOLIO_DIGEST_SCHEDULE` aceita:\n",
    "Para o plano grátis, o resumo é fixo em `weekly:5` (sexta-feira), mesmo que exista outra preferência no documento do usuário. Para o VIP, `PORTFOLIO_DIGEST_SCHEDULE` aceita:\n",
)

# 7) CI final em Node 22 e remoção dos artefatos temporários.
ci_path = Path(".github/workflows/portfolio-notifications-ci.yml")
ci_path.write_text('''name: Portfolio Notifications CI

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install --silent
      - name: Build application
        id: build
        continue-on-error: true
        shell: bash
        run: |
          PRIVATE_KEY="$(openssl genrsa 2048)"
          export PRIVATE_KEY
          export FIREBASE_SERVICE_ACCOUNT_KEY="$(node -e 'process.stdout.write(JSON.stringify({project_id:"dados-fii-ci",client_email:"ci@dados-fii-ci.iam.gserviceaccount.com",private_key:process.env.PRIVATE_KEY}))')"
          export NEXT_PUBLIC_BASE_URL="https://www.dadosfii.com.br"
          export NEXT_PUBLIC_FIREBASE_API_KEY="test-api-key-for-ci-build"
          export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="dados-fii-ci.firebaseapp.com"
          export NEXT_PUBLIC_FIREBASE_PROJECT_ID="dados-fii-ci"
          export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="dados-fii-ci.appspot.com"
          export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
          export NEXT_PUBLIC_FIREBASE_APP_ID="test-app-id-for-ci-build"
          export NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="test-measurement-id"
          export CRON_SECRET="ci-only-secret"
          export ADMIN_UPDATE_SECRET="ci-only-secret"
          npm run build > build.log 2>&1
      - name: Upload build log
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: portfolio-notifications-build-log
          path: build.log
          if-no-files-found: error
      - name: Fail when build failed
        if: steps.build.outcome == 'failure'
        run: exit 1
''')

Path(".github/workflows/patch-free-friday-observability.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)

print("Friday digest and observability patches applied.")
