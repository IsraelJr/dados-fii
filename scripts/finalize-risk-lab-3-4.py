from __future__ import annotations

import json
import re
from pathlib import Path

EVIDENCE_PATH = Path(
    "docs/production-evidence/risk-lab/risk-lab-3-4-20260720-v1.json"
)
HANDOFF_PATH = Path("DADOS_FII_HANDOFF.md")
DOSSIER_PATH = Path("docs/risk-lab/sprint-3-4-production-smoke.md")
ROUTE_PATH = Path("src/app/api/system/risk-lab-production-smoke/route.ts")
TEST_PATH = Path("tests/risk-lab-production-smoke-architecture.test.mjs")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def sub_once(
    text: str,
    pattern: str,
    replacement: str,
    label: str,
    flags: int = 0,
) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    require(count == 1, f"handoff marker not found: {label}")
    return updated


def validate_evidence() -> dict:
    evidence = json.loads(EVIDENCE_PATH.read_text())
    require(evidence.get("status") == "passed", "production evidence is not passed")
    require(evidence.get("sprint") == "3.4", "unexpected sprint in evidence")
    require(len(evidence.get("checks", [])) == 11, "unexpected check count")
    require(
        all(item.get("status") == "passed" for item in evidence["checks"]),
        "one or more production checks failed",
    )
    require(len(evidence.get("cases", [])) == 6, "unexpected case count")
    require(len(evidence.get("blockers", [])) == 0, "production blockers remain")
    require(
        bool(re.fullmatch(r"[a-f0-9]{64}", evidence.get("evidenceHash", ""))),
        "invalid evidence hash",
    )
    require(
        all(
            case.get("premiumIntegrated") is False
            and case.get("notificationsSent") is False
            for case in evidence["cases"]
        ),
        "forbidden external effect found in evidence",
    )
    return evidence


def write_read_only_route() -> None:
    ROUTE_PATH.write_text(
        '''import { NextResponse } from "next/server";
import { riskLabProductionSmokeService } from "@/lib/risk-lab/RiskLabProductionSmokeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  try {
    const evidence = await riskLabProductionSmokeService.getPublicEvidence();
    return response({
      ok: evidence?.status === "passed",
      sprint: "3.4",
      status: evidence?.status || "pending",
      evidence,
    });
  } catch (error) {
    console.error(
      "Risk Lab production smoke evidence error",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ ok: false, sprint: "3.4", status: "unavailable" }, 503);
  }
}
'''
    )


def write_architecture_test() -> None:
    TEST_PATH.write_text(
        '''import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const smokeService = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeService.ts", "utf8");
const smokeStore = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeStore.ts", "utf8");
const scanStore = readFileSync("src/lib/risk-lab/RiskLabAutomaticScanStore.ts", "utf8");
const smokeRoute = readFileSync("src/app/api/system/risk-lab-production-smoke/route.ts", "utf8");
const adminRoute = readFileSync("src/app/api/admin/system/risk-lab/automatic/route.ts", "utf8");
const evidence = JSON.parse(
  readFileSync("docs/production-evidence/risk-lab/risk-lab-3-4-20260720-v1.json", "utf8"),
);

function executable(source) {
  return source
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, "")
    .replace(/^\\s*\\/\\/.*$/gm, "");
}

test("production smoke covers the official Sprint 3.4 matrix", () => {
  for (const value of [
    "HCTR11",
    "MCCI11",
    "RBRY11",
    "invalid-ticker",
    "insufficient-series",
    "ambiguous-credit-event",
  ]) {
    assert.match(smokeService, new RegExp(value));
  }

  for (const checkId of [
    "deployment.production",
    "feature.automatic-discovery",
    "rate-limit.contract",
    "persistence.scans",
    "audit.scans",
    "isolation.external-effects",
    "integrity.scan-hashes",
  ]) {
    assert.match(smokeService, new RegExp(checkId.replaceAll(".", "\\\\.")));
  }
});

test("automatic scans and smoke evidence use repositories with locks and audit", () => {
  assert.match(scanStore, /RiskLabAutomaticScans/);
  assert.match(scanStore, /RiskLabAutomaticScanAudit/);
  assert.match(scanStore, /runTransaction/);
  assert.match(smokeStore, /RiskLabProductionSmokeRuns/);
  assert.match(smokeStore, /RiskLabProductionSmokeAudit/);
  assert.match(smokeStore, /RiskLabProductionSmokeLocks/);
  assert.match(smokeStore, /acquireLock/);
  assert.match(smokeStore, /releaseLock/);
  assert.match(adminRoute, /repository:\\s*riskLabAutomaticScanStore/);
});

test("production evidence endpoint is permanently read-only after closure", () => {
  assert.match(smokeRoute, /export async function GET\\(\\)/);
  assert.match(smokeRoute, /getPublicEvidence/);
  assert.doesNotMatch(
    smokeRoute,
    /NextRequest|searchParams|run\\(\\)|VERCEL_GIT_COMMIT_SHA|github-actions|AUTOMATIC_TRIGGER|TOKEN/,
  );

  for (const temporaryPath of [
    ".github/workflows/risk-lab-production-smoke.yml",
    ".github/workflows/risk-lab-production-smoke-release.yml",
    ".github/workflows/risk-lab-closure.yml",
    ".github/workflows/risk-lab-closure-fix.yml",
    ".github/workflows/risk-lab-3-4-finalize-pr59.yml",
    ".github/risk-lab-production-smoke.trigger",
    ".github/risk-lab-production-smoke-release.trigger",
    ".github/risk-lab-closure.trigger",
    ".github/risk-lab-closure-fix.trigger",
    ".github/risk-lab-finalize.trigger",
  ]) {
    assert.equal(existsSync(temporaryPath), false, `${temporaryPath} should be removed`);
  }
});

test("approved production evidence is immutable and complete", () => {
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.sprint, "3.4");
  assert.equal(evidence.checks.length, 11);
  assert.equal(evidence.cases.length, 6);
  assert.equal(evidence.blockers.length, 0);
  assert.match(evidence.evidenceHash, /^[a-f0-9]{64}$/);
  assert.equal(
    evidence.cases.every(
      (item) => item.premiumIntegrated === false && item.notificationsSent === false,
    ),
    true,
  );
});

test("smoke remains isolated from Premium and notifications", () => {
  const source = executable(smokeService);
  assert.doesNotMatch(
    source,
    /getPremiumReport|AIInsights|sendEmail|sendNotification|createAlert/,
  );
  assert.match(source, /premiumIntegrated:\\s*false/);
  assert.match(source, /notificationsSent:\\s*false/);
  assert.match(adminRoute, /RISK_LAB_AUTOMATIC_RATE_LIMIT/);
});
'''
    )


def update_handoff(evidence: dict) -> None:
    release = evidence["releaseCommit"]
    evidence_hash = evidence["evidenceHash"]
    text = HANDOFF_PATH.read_text()

    text = sub_once(text, r"\*\*Versão:\*\* 6\.1\.0", "**Versão:** 6.2.0", "version")
    text = sub_once(
        text,
        r"\*\*Commit auditado em Produção:\*\* `[^`]+`",
        f"**Commit auditado em Produção:** `{release}`",
        "production commit",
    )
    text = sub_once(
        text,
        r"\*\*Branch desta atualização:\*\* `[^`]+`",
        "**Branch desta atualização:** `automation/risk-lab-3-4-release-0072ecf340e6`",
        "branch",
    )
    text = sub_once(
        text,
        r"\*\*PR desta atualização:\*\* .*",
        "**PR desta atualização:** #59 — `chore: formaliza conclusão da Sprint 3.4`",
        "pr",
        re.M,
    )
    text = sub_once(
        text,
        r"^\| Sprint corrente canônica:.*$",
        "| Sprint corrente canônica: **3.5 — Coorte externa e backtest sem informação futura**. | Sprint 3.4 como sprint corrente. | A Sprint 3.4 foi homologada em Produção com evidência auditável, mantendo o Risk Lab isolado do Premium e das notificações. |",
        "current decision",
        re.M,
    )
    text = sub_once(
        text,
        r"^- O Risk Lab está implementado.*$",
        f"- A Sprint 3.4 do Risk Lab foi concluída em Produção com 11/11 checks e 6/6 casos, evidência `{evidence_hash}`. O Risk Lab continua isolado do Premium e das notificações; a coorte externa permanece bloqueada até verificação primária.",
        "summary",
        re.M,
    )
    text = sub_once(
        text,
        r"^\| Fase 3 — Risk Lab \|.*$",
        f"| Fase 3 — Risk Lab | Sim, até 3.4 | Sim | Sim (`{release[:7]}`, Vercel verde) | Smoke 3.4: 11/11 checks e 6/6 casos; coorte externa pendente | Em andamento |",
        "audit row",
        re.M,
    )
    text = sub_once(
        text,
        r"^\*\*Em andamento\.\*\* As Sprints 3\.0 a 3\.3.*$",
        "**Em andamento.** As Sprints 3.0 a 3.4 possuem código, testes e homologação de Produção. A Sprint 3.5 continua bloqueada até a verificação primária da coorte externa.",
        "phase status",
        re.M,
    )

    current = """### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias e executar o backtest sem informação futura, preservando integralmente o ruleset `v0.1.0`.

**Trabalho obrigatório:**

1. confirmar `knownAt`, URL, trecho, página, hash e versão por observação;
2. executar `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11` e `RBRY11` sem look-ahead;
3. medir antecedência, falsos positivos, falsos negativos, inconclusão e cobertura;
4. manter `executionAllowed=false` enquanto faltar verificação primária;
5. versionar a evidência e preservar o ruleset congelado.

**Critério de aceite:** nenhuma conclusão final sustentada apenas por fonte secundária; controles saudáveis sem vermelho injustificado; ambiguidades como inconclusivas; métricas e evidências persistidas no Git."""
    text = sub_once(
        text,
        r"### Sprint 3\.4 — Risk Lab em Produção e smoke ponta a ponta\n.*?(?=\n## 4\.)",
        current,
        "current sprint section",
        re.S,
    )

    track = """### Trilha principal de produto

1. **Sprint 3.5 — Coorte externa e backtest sem informação futura.**
2. **Sprint 3.6 — Métricas, calibração e gate formal.**
3. **Sprint 3.7 — Risk Lab read-only no Relatório Premium e Prompt Premium v3.**
4. **Sprint 3.8 — Impacto na carteira e alertas opt-in.**
5. **Sprint 4.1 — Radar: acompanhar fundo fora da carteira.**
6. **Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.**
7. **Sprint 4.3 — Planos, preferências, canais e monetização.**
8. **Sprint 5.1 — Carteira histórica verdadeira e ledger de eventos.**
9. **Sprint 5.2 — Motor de risco, exposição e atribuição acionável.**
10. **Sprint 5.3 — Inteligência sobre comunicados oficiais.**
11. **Sprint 5.4 — Screener quantitativo, pares e fair value por tipo de FII.**
12. **Sprint 5.5 — Benchmark, retorno total, calendário, centro fiscal e simuladores.**"""
    text = sub_once(
        text,
        r"### Trilha principal de produto\n\n.*?(?=\n### Trilha SEO)",
        track,
        "sprint order",
        re.S,
    )
    text = sub_once(
        text,
        r"### Sprint 3\.4 — Risk Lab em Produção\n\n\*\*Escopo:\*\*",
        "### Sprint 3.4 — Risk Lab em Produção (concluída)\n\n**Escopo:**",
        "3.4 scope heading",
    )
    text = sub_once(
        text,
        r"^\*\*Aceite:\*\* deployment `Ready`.*smoke salvo no Git\.$",
        f"**Aceite obtido:** deployment de Produção identificado; 11/11 checks; 6/6 casos; persistência, auditoria, locks, hashes e rate limit conferidos; zero efeito no Premium e nas notificações; evidência `{evidence_hash}` salva no Git. Os casos reais ficaram inconclusivos com segurança por insuficiência de evidência estruturada, sem falsa classificação final.",
        "3.4 acceptance",
        re.M,
    )
    text = sub_once(
        text,
        r"1\. Executar o smoke autenticado da Sprint 3\.4 no commit de release do Risk Lab\.\n2\. Verificar fontes primárias da coorte e só então remover o bloqueio de execução\.",
        "1. Verificar fontes primárias da coorte e só então remover o bloqueio de execução.",
        "blockers",
    )
    text = sub_once(
        text,
        r"^17\. Padronizar persistência e auditoria dos scans automáticos do Risk Lab\.\n",
        "",
        "completed engineering item",
        re.M,
    )
    text = text.replace("18. Decidir se regras futuras", "17. Decidir se regras futuras", 1)
    text = text.replace("19. Mover ferramentas manuais", "18. Mover ferramentas manuais", 1)
    text = sub_once(
        text,
        r"Formulação vigente: \*\*Fases 1 e 2 formalmente concluídas.*Sprint atual 3\.4\.\*\*",
        "Formulação vigente: **Fases 1 e 2 formalmente concluídas em Produção sob a evidência schema v2; Fase 3 em andamento, com Sprint 3.4 concluída e Sprint atual 3.5.**",
        "final formula",
    )

    HANDOFF_PATH.write_text(text)


def update_dossier(evidence: dict) -> None:
    text = DOSSIER_PATH.read_text()
    if "## Resultado de Produção" not in text:
        text += f"""

## Resultado de Produção

- Status: `passed`;
- run: `{evidence['runId']}`;
- commit auditado: `{evidence['releaseCommit']}`;
- ambiente: `{evidence['environment']}`;
- deployment: `{evidence['deploymentUrl']}`;
- checks: `11/11`;
- casos: `6/6`;
- hash: `{evidence['evidenceHash']}`;
- Premium integrado: `false`;
- notificações enviadas: `false`.

Os três casos reais (`HCTR11`, `MCCI11` e `RBRY11`) terminaram como `inconclusive`, sem falsa classificação final, porque as fontes consultadas não produziram evidência estruturada suficiente. Isso aprova a segurança operacional e a semântica do pipeline, mas não substitui a verificação primária e o backtest da Sprint 3.5.
"""
        DOSSIER_PATH.write_text(text)


def remove_markers() -> None:
    for path in [
        ".github/risk-lab-production-smoke.trigger",
        ".github/risk-lab-production-smoke-release.trigger",
        ".github/risk-lab-closure.trigger",
        ".github/risk-lab-closure-fix.trigger",
        ".github/risk-lab-finalize.trigger",
        "docs/production-evidence/risk-lab/finalization-status.json",
    ]:
        Path(path).unlink(missing_ok=True)


def main() -> None:
    evidence = validate_evidence()
    Path("docs/production-evidence/risk-lab/README.md").write_text(
        """# Evidências de Produção — Risk Lab

Este diretório contém evidências sanitizadas, versionadas e reproduzíveis das homologações do Risk Lab.

A Sprint 3.4 somente é considerada concluída quando a evidência registra `status: passed`, o commit exato de Produção, todos os casos obrigatórios, persistência e auditoria dos scans, ausência de blockers e zero integração com Premium ou notificações.
"""
    )
    write_read_only_route()
    write_architecture_test()
    update_handoff(evidence)
    update_dossier(evidence)
    remove_markers()


if __name__ == "__main__":
    main()
