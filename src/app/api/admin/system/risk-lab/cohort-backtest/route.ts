import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { requireGithubActionsProductionIdentity } from "@/lib/security/GithubActionsOidc";
import { riskLabCohortIdentityService } from "@/lib/risk-lab/RiskLabCohortIdentityService";
import {
  planRiskLabCohortAdvance,
  type RiskLabCohortAdvanceAction,
} from "@/lib/risk-lab/RiskLabCohortAdvancePlanner";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";
import {
  SEGMENTED_COHORT_TICKERS,
  segmentedRiskLabCohortBacktestService,
} from "@/lib/risk-lab/SegmentedRiskLabCohortBacktestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function activeProductionRelease() {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || "";
  if (process.env.VERCEL_ENV !== "production") return null;
  return /^[a-f0-9]{40}$/.test(release) ? release : null;
}

function clientNextAction(action: RiskLabCohortAdvanceAction) {
  if (action === "case") return "advance";
  if (action === "noop") return null;
  return action;
}

async function authorizeOperator(
  request: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number },
) {
  if (request.headers.has("authorization")) {
    try {
      const identity = await requireGithubActionsProductionIdentity(request, {
        audience: "dados-fii-risk-lab-operation",
        allowedWorkflowFiles: [
          "risk-lab-cohort-backtest.yml",
          "risk-lab-frozen-dividend-notices.yml",
        ],
      });
      return {
        ok: true as const,
        actor: `github-oidc:${identity.runId}:${identity.runAttempt}`,
        operatorId: `github:${identity.actorId}`,
      };
    } catch {
      return {
        ok: false as const,
        rejection: adminJson({ ok: false, error: "Identidade OIDC inválida." }, 401),
      };
    }
  }
  const authorization = await authorizeAdminRequest(request, scope, options);
  if (authorization.rejection) return { ok: false as const, rejection: authorization.rejection };
  return {
    ok: true as const,
    actor: `admin:${authorization.identity.uid}`,
    operatorId: authorization.identity.uid,
  };
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeOperator(
    request,
    "risk-lab-cohort-backtest-status",
    { limit: 30, windowMs: 60_000 },
  );
  if (!authorization.ok) return authorization.rejection;

  try {
    const releaseCommit = activeProductionRelease();
    if (request.nextUrl.searchParams.get("view") === "identities") {
      const identities = await riskLabCohortIdentityService.list();
      return adminJson({
        ok: true,
        releaseCommit,
        runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
        identities,
      });
    }
    const evidence = await segmentedRiskLabCohortBacktestService.getPublicEvidence();
    const plan = releaseCommit
      ? planRiskLabCohortAdvance(releaseCommit, SEGMENTED_COHORT_TICKERS, evidence)
      : { action: "noop" as const, ticker: null };
    return adminJson({
      ok: true,
      enabled: Boolean(releaseCommit),
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      releaseCommit,
      tickers: SEGMENTED_COHORT_TICKERS,
      nextAction: clientNextAction(plan.action),
      nextTicker: plan.ticker,
      evidence,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha ao carregar o status do backtest da coorte.";
    console.error("Risk Lab segmented admin status error", {
      actor: authorization.actor,
      message,
    });
    return adminJson({ ok: false, error: "Falha ao carregar o status do backtest." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeOperator(
    request,
    "risk-lab-cohort-backtest-execute",
    { limit: 12, windowMs: 30 * 60_000 },
  );
  if (!authorization.ok) return authorization.rejection;

  const releaseCommit = activeProductionRelease();
  if (!releaseCommit) {
    return adminJson({
      ok: false,
      error: "A execução da Sprint 3.5 só é permitida no deployment ativo de Produção.",
    }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const ticker = String(body?.ticker || "").trim().toUpperCase();
  if (!new Set(["initialize", "case", "finalize", "advance"]).has(action)) {
    return adminJson({ ok: false, error: "Ação inválida. Use initialize, advance, case ou finalize." }, 400);
  }
  if (action === "case" && !SEGMENTED_COHORT_TICKERS.includes(ticker)) {
    return adminJson({ ok: false, error: "Ticker fora da coorte pré-registrada." }, 400);
  }

  try {
    let resolvedAction: RiskLabCohortAdvanceAction = action === "advance"
      ? "noop"
      : action as Exclude<RiskLabCohortAdvanceAction, "noop">;
    let resolvedTicker = ticker || null;

    if (action === "advance") {
      const current = await segmentedRiskLabCohortBacktestService.getPublicEvidence();
      const plan = planRiskLabCohortAdvance(releaseCommit, SEGMENTED_COHORT_TICKERS, current);
      resolvedAction = plan.action;
      resolvedTicker = plan.ticker;
      if (resolvedAction === "noop") {
        return adminJson({
          ok: true,
          enabled: true,
          runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
          releaseCommit,
          action: "noop",
          ticker: null,
          persistedCases: current?.cases.length || 0,
          nextAction: null,
          nextTicker: null,
          evidence: current,
        });
      }
    }

    console.info("Risk Lab segmented admin execution requested", {
      actor: authorization.actor,
      releaseCommit,
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      requestedAction: action,
      resolvedAction,
      ticker: resolvedTicker,
    });

    const evidence = resolvedAction === "initialize"
      ? await segmentedRiskLabCohortBacktestService.initialize()
      : resolvedAction === "case" && resolvedTicker
        ? await segmentedRiskLabCohortBacktestService.runTicker(resolvedTicker)
        : await segmentedRiskLabCohortBacktestService.finalize();

    const nextPlan = planRiskLabCohortAdvance(releaseCommit, SEGMENTED_COHORT_TICKERS, evidence);
    return adminJson({
      ok: resolvedAction === "finalize" ? evidence.status === "passed" : true,
      enabled: true,
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      releaseCommit,
      action: resolvedAction,
      ticker: resolvedTicker,
      persistedCases: evidence.cases.length,
      nextAction: clientNextAction(nextPlan.action),
      nextTicker: nextPlan.ticker,
      evidence,
    }, evidence.status === "running" ? 202 : 200);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha ao executar etapa do backtest da coorte.";
    console.error("Risk Lab segmented admin execution error", {
      actor: authorization.actor,
      releaseCommit,
      action,
      ticker: ticker || null,
      message,
    });
    const status = /execução|inicializado|inicializada|incompleto/i.test(message) ? 409 : 500;
    return adminJson({ ok: false, error: status === 409 ? message : "Falha ao executar a etapa do backtest." }, status);
  }
}
