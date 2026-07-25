from pathlib import Path

handoff_path = Path("DADOS_FII_HANDOFF.md")
test_path = Path("tests/canonical-handoff.test.mjs")
handoff = handoff_path.read_text()
test = test_path.read_text()


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: esperado 1, encontrado {count}")
    return text.replace(old, new, 1)

handoff = once(handoff, "**Versão:** 6.12.0", "**Versão:** 6.13.0", "versão")
handoff = once(handoff, "**Base funcional auditada:** `bfdc186057652a535025d19beae061856624d5c1`", "**Base funcional auditada:** `7391791b09b1615a86e29c2002b74f95f55e833e`", "base")
handoff = once(handoff, "**Sprint corrente:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — planejada, não iniciada", "**Sprint corrente:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — mesclada, aguardando deployment de produção", "sprint corrente")
handoff = once(handoff, "**Próxima unidade de trabalho:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — não iniciada", "**Próxima unidade de trabalho:** concluir deployment de produção e ativação controlada da Sprint 3.7 — bloqueada por quota Vercel", "próxima unidade")
handoff = once(handoff, "Este Handoff v6.12.0 é a única referência canônica", "Este Handoff v6.13.0 é a única referência canônica", "referência canônica")
handoff = once(
    handoff,
    "| As Sprints 3.5 e 3.6 estão formalmente concluídas; a 3.7 é a próxima unidade, ainda não iniciada. | Sprint 3.6 planejada. | Concluída / planejada | PR #131, merge `bfdc186057652a535025d19beae061856624d5c1`; ruleset `0.2.0` homologado. |",
    "| As Sprints 3.5 e 3.6 estão formalmente concluídas; a 3.7 foi implementada, testada e mesclada, mas ainda não está formalmente concluída. | Sprint 3.7 planejada e não iniciada. | Implementada / bloqueada | PR #134, merge `7391791b09b1615a86e29c2002b74f95f55e833e`; deployment de produção recusado por quota diária do Vercel. |",
    "decisão sprint",
)
handoff = once(
    handoff,
    "| A próxima fase é 3.7 — integração read-only no Premium + Prompt Premium v3 e não inicia automaticamente. | Promover o ruleset diretamente ao produto. | Planejada | A homologação metodológica não equivale a integração de produto. |",
    "| A Sprint 3.7 possui integração read-only, Prompt Premium v3 e Modo Gestor mesclados, mas a próxima unidade continua sendo concluir deployment e ativação controlada. | Promover automaticamente SEO-S1 ou Radar após o merge funcional. | Bloqueada | O runtime recebeu Preview Ready; produção recusou o deploy por `api-deployments-free-per-day` e a flag permanece desligada por padrão. |",
    "decisão próxima fase",
)
handoff = once(
    handoff,
    "| Risk Lab permanece fora do Premium e das notificações até a Sprint 3.7 implementar integração read-only com feature flag, fallback e rollback. | Integração automática após homologação. | Bloqueada | Homologação metodológica da 3.6 não conecta o ruleset ao produto. |",
    "| Risk Lab está integrado ao Premium em modo read-only atrás de feature flag desligada por padrão; notificações continuam proibidas. | Risk Lab totalmente fora do Premium. | Parcial / bloqueada | Código, testes e Preview concluídos; produção e ativação controlada pendentes. |",
    "decisão risk lab",
)
handoff = once(
    handoff,
    "| O Relatório Premium recebe cálculos determinísticos antes da IA. | IA recalculando regras e preenchendo lacunas. | Parcial | Prompt Premium v3 entra depois do Risk Lab. |",
    "| O Relatório Premium v2 executa cálculos determinísticos, Risk Lab read-only e Modo Gestor antes da IA. | IA recalculando regras e preenchendo lacunas. | Implementada; rollout pendente | Prompt Premium v3 foi mesclado na PR #134; ativação depende do deployment e da flag. |",
    "decisão premium",
)
handoff = once(
    handoff,
    "- Próxima unidade: 3.7 — Risk Lab read-only no Premium + Prompt Premium v3, ainda não iniciada.\n- Risk Lab permanece isolado de Premium e notificações até a implementação e validação próprias da Sprint 3.7.",
    "- A Sprint 3.7 foi implementada, testada e mesclada no `main` pelo commit `7391791b09b1615a86e29c2002b74f95f55e833e`.\n- O runtime final recebeu Preview Vercel Ready no commit `6bc5940b9ee15cbb8f25865f16a1191074425489`; após isso, somente documentação, manifesto e teste foram alterados.\n- O deployment de produção do merge foi recusado por quota diária do Vercel; a feature flag `ENABLE_RISK_LAB_PREMIUM_READONLY` permanece desligada por padrão.\n- A Sprint 3.7 não está formalmente concluída e nenhuma etapa seguinte deve iniciar antes da produção e ativação controlada.\n- Notificações do Risk Lab continuam proibidas.",
    "resumo 3.7",
)
handoff = once(
    handoff,
    "| Sprint 3.7 — integração read-only | Não | Não | Não iniciada | **Planejada** |",
    "| Sprint 3.7 — integração read-only | Sim | Sim | Preview do runtime Ready; produção bloqueada por quota | **Mesclada; conclusão formal pendente** |",
    "tabela 3.7",
)
handoff = once(
    handoff,
    "| Prompt Premium v3 | Contrato | Casos definidos | Não implantado | **Planejada para 3.7** |",
    "| Prompt Premium v3 | Sim | Sim | Runtime em Preview; produção pendente | **Mesclado na 3.7** |",
    "tabela prompt",
)
handoff = once(
    handoff,
    "- Sprint 3.7: planejada e não iniciada.\n- Integração com Premium/notificações: proibida até os gates próprios da Sprint 3.7.",
    "- Sprint 3.7: implementada, testada e mesclada; deployment de produção e ativação controlada pendentes.\n- Integração Premium: read-only atrás de feature flag desligada por padrão.\n- Notificações do Risk Lab: proibidas.",
    "fase 3 status",
)

marker = "- homologação permitida: `true`; Premium integrado: `false`; notificações enviadas: `false`.\n\n---\n\n## 3. Sprint atual"
evidence = """- homologação permitida: `true`; Premium integrado: `false`; notificações enviadas: `false`.

### Evidência canônica da Sprint 3.7 — integração read-only no Premium

- issue `#133`; PR funcional `#134`;
- merge funcional: `7391791b09b1615a86e29c2002b74f95f55e833e`;
- registro runtime: `premium-readonly-v1`, SHA-256 `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`;
- manifesto autoconsistente: `de2d1abd481e2a66b296dc7eab667277cc8072c807872f9f7b3982da8aa9bbcd`;
- Prompt Premium: `premium-fund-analysis-v3`; Modo Gestor: `premium-manager-mode-v3`;
- feature flag: `ENABLE_RISK_LAB_PREMIUM_READONLY`, padrão `false`;
- disposições preservadas: DEVA11/VSLH11 risco histórico elevado; KNCR11 sem estresse qualificante; KNSC11/RBRY11 recuperação informativa; MCCI11 inconclusivo e não pontuado;
- fundos fora da coorte recebem indisponibilidade explícita, sem classificação por semelhança;
- 16 testes específicos, suíte Risk Lab, regressão Fase 2, política de notificações, typecheck e build verdes;
- Preview do runtime: commit `6bc5940b9ee15cbb8f25865f16a1191074425489`, status Ready;
- head funcional aprovado: `f43f174a417be7a8218f015353a05cc65d1d2dcd`;
- zero review threads; nenhuma notificação ou efeito externo;
- deployment de produção do merge recusado por quota `api-deployments-free-per-day`;
- conclusão formal: `false`; ativação controlada: pendente.

---

## 3. Sprint atual"""
handoff = once(handoff, marker, evidence, "evidência 3.7")

old_sprint = """### Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

Estado: **planejada e não iniciada**.

Entrada obrigatória:

1. consumir apenas o ruleset homologado `0.2.0` e suas evidências versionadas;
2. executar cálculos determinísticos antes da IA;
3. expor leitura informativa, nunca recomendação de investimento;
4. manter MCCI11 como inconclusivo quando a verdade-terreno não permitir conclusão;
5. implementar feature flag, autorização, auditoria, fallback e rollback;
6. impedir notificações automáticas até existir gate específico;
7. validar Preview e produção porque esta fase altera o runtime do produto.

A Sprint 3.7 não foi iniciada automaticamente. Exige issue, branch, PR, CI, evidência, deployment real, merge, auditoria do `main` e atualização canônica próprios."""
new_sprint = """### Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

Estado: **implementada, testada e mesclada; conclusão formal bloqueada por deployment de produção**.

Entregas comprovadas:

1. ruleset homologado `0.2.0` consumido em modo read-only;
2. cálculos determinísticos e Modo Gestor executados antes da IA;
3. Prompt Premium v3 sem recomendação automática de investimento;
4. MCCI11 preservado como `inconclusive_unscored`;
5. feature flag, autorização, auditoria, fallback e rollback implementados;
6. notificações e efeitos externos proibidos e testados;
7. Preview real do runtime Ready e CI completa verde.

Bloqueadores de conclusão:

- deployment de produção do merge `7391791b09b1615a86e29c2002b74f95f55e833e` recusado pela quota diária do Vercel;
- `ENABLE_RISK_LAB_PREMIUM_READONLY` deve ser configurada de forma controlada no ambiente após o deployment;
- smoke test autenticado do endpoint Premium em produção ainda não foi executado.

Nenhuma etapa seguinte deve iniciar até esses bloqueadores serem removidos, a produção ser auditada e a issue #133 ser encerrada."""
handoff = once(handoff, old_sprint, new_sprint, "bloco sprint atual")
handoff = once(
    handoff,
    "1. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3** — não iniciada.\n2. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.",
    "1. **3.7-D — concluir deployment de produção, ativação controlada e smoke test** — bloqueada por quota Vercel.\n2. **SEO-S1, dias 1–15** — não iniciar antes do encerramento formal da 3.7, salvo decisão explícita do usuário.",
    "ordem roadmap",
)
handoff = once(
    handoff,
    "### 3.7 — integração read-only\n\n- cálculo determinístico antes da IA;\n- IA interpreta, não inventa dados nem recalcula score;\n- conteúdo informativo, sem recomendação de investimento;\n- feature flag, auditoria, fallback e rollback;\n- Prompt Premium v3 com glossário e impacto prático.",
    "### 3.7 — integração read-only — mesclada; produção pendente\n\n- cálculo determinístico antes da IA: concluído;\n- IA interpreta, não inventa dados nem recalcula score: concluído;\n- conteúdo informativo, sem recomendação de investimento: concluído;\n- feature flag, auditoria, fallback e rollback: concluídos;\n- Prompt Premium v3 com glossário e impacto prático: concluído;\n- Preview real do runtime: concluído;\n- deployment e smoke test de produção: pendentes;\n- ativação controlada da flag: pendente;\n- notificações: continuam proibidas.",
    "escopo 3.7",
)
handoff = once(
    handoff,
    "9. Premium e alertas não consomem Risk Lab antes da implementação e validação próprias da Sprint 3.7.",
    "9. Premium só consome Risk Lab em modo read-only e atrás de feature flag; alertas e efeitos externos permanecem proibidos.",
    "regra arquitetura 9",
)
handoff = once(
    handoff,
    "- PR #131 — calibração e homologação 3.6; merge `bfdc186057652a535025d19beae061856624d5c1`.\n- PR #65",
    "- PR #131 — calibração e homologação 3.6; merge `bfdc186057652a535025d19beae061856624d5c1`.\n- PR #134 — Risk Lab read-only no Premium e Prompt Premium v3; merge `7391791b09b1615a86e29c2002b74f95f55e833e`.\n- PR #65",
    "lista PRs",
)
handoff = once(
    handoff,
    "- `docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json`\n- `docs/risk-lab/sprint-3-6-calibration.md`",
    "- `docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json`\n- `docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json`\n- `docs/risk-lab/sprint-3-7-premium-readonly.md`\n- `docs/premium/PROMPT_PREMIUM_V3.md`\n- `src/lib/risk-lab/RiskLabPremiumReadModel.ts`\n- `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`\n- `tests/risk-lab-premium-readonly.test.ts`\n- `tests/risk-lab-premium-integration.test.mjs`\n- `docs/risk-lab/sprint-3-6-calibration.md`",
    "evidências arquivos",
)
handoff = once(
    handoff,
    "- Sprint 3.7: planejada e não iniciada; integração read-only e Prompt Premium v3 exigem gates próprios de runtime.",
    "- Sprint 3.7: código, testes, merge e Preview concluídos; deployment de produção, ativação controlada e smoke test permanecem pendentes.",
    "funcionalidades parciais",
)
handoff = once(
    handoff,
    "- Prompt Premium v3 e integração read-only da Sprint 3.7.\n- SEO-S1",
    "- Deployment de produção, ativação controlada e smoke test da Sprint 3.7.\n- SEO-S1",
    "pendências",
)
handoff = once(
    handoff,
    "- Risk Lab não dispara alertas nem altera relatório enquanto estiver bloqueado pelos gates.",
    "- Risk Lab só altera o conteúdo do relatório Premium quando a feature flag read-only está ativa; nunca dispara alertas nem efeitos externos.",
    "segurança risk lab",
)
handoff = once(
    handoff,
    "- `ENABLE_AUTOMATIC_MONITOR`\n- credenciais Firebase Admin",
    "- `ENABLE_AUTOMATIC_MONITOR`\n- `ENABLE_RISK_LAB_PREMIUM_READONLY`\n- credenciais Firebase Admin",
    "variável flag",
)
handoff = once(
    handoff,
    "- flags de Risk Lab permanecem desligadas para Premium/notificações até a integração controlada da Sprint 3.7;",
    "- `ENABLE_RISK_LAB_PREMIUM_READONLY` permanece desligada por padrão e deve ser ativada separadamente por ambiente após deployment saudável;",
    "regra env flag",
)
handoff = once(
    handoff,
    "- testes de calibração, leave-one-case-out e homologação da Sprint 3.6\n- `npm run test:workflow-governance`",
    "- testes de calibração, leave-one-case-out e homologação da Sprint 3.6\n- `npm run test:sprint3.7`\n- teste de hash integral do registro e manifesto autoconsistente da Sprint 3.7\n- `npm run test:workflow-governance`",
    "gates 3.7",
)
handoff = once(
    handoff,
    "- Abrir issue e branch exclusivas para 3.7 — Risk Lab read-only no Premium + Prompt Premium v3, somente mediante nova instrução do usuário.\n- Consumir somente o ruleset homologado `0.2.0`, sem alterar dataset, verdade-terreno ou hashes históricos.\n- Não integrar Premium nem notificações fora dos gates próprios da Sprint 3.7.",
    "- Reexecutar o deployment de produção do merge `7391791b09b1615a86e29c2002b74f95f55e833e` quando a quota Vercel permitir.\n- Configurar `ENABLE_RISK_LAB_PREMIUM_READONLY=true` de forma controlada no ambiente alvo somente após deployment saudável.\n- Executar smoke test autenticado do endpoint Premium e confirmar auditoria `premium-read`.\n- Manter notificações bloqueadas e não iniciar SEO-S1 ou Radar antes do encerramento formal da issue #133.",
    "próxima execução",
)
handoff = once(
    handoff,
    "Este documento registra as Sprints 3.5 e 3.6 como formalmente concluídas e a Sprint 3.7 como próxima unidade planejada, ainda não iniciada. O ruleset `0.2.0` está homologado, mas o Risk Lab não está integrado ao Premium/notificações; nenhuma fase seguinte deve ser promovida sem evidência, testes e deployment próprios.",
    "Este documento registra as Sprints 3.5 e 3.6 como formalmente concluídas e a Sprint 3.7 como implementada, testada e mesclada, porém ainda não formalmente concluída. O Risk Lab read-only e o Prompt Premium v3 estão no `main`, mas o deployment de produção, a ativação controlada e o smoke test permanecem pendentes; notificações continuam proibidas e nenhuma fase seguinte deve iniciar.",
    "regra parada",
)

# Atualiza o teste canônico sem apagar a evidência histórica da 3.6.
test = once(test, "assert.match(text, /\\*\\*Versão:\\*\\* 6\\.12\\.0/);", "assert.match(text, /\\*\\*Versão:\\*\\* 6\\.13\\.0/);", "teste versão")
test = once(test, "assert.match(text, /\\*\\*Base funcional auditada:\\*\\* `bfdc186057652a535025d19beae061856624d5c1`/);", "assert.match(text, /\\*\\*Base funcional auditada:\\*\\* `7391791b09b1615a86e29c2002b74f95f55e833e`/);", "teste base")
test = once(test, "assert.match(text, /Próxima unidade de trabalho:\\*\\* 3\\.7 — Risk Lab read-only no Premium \\+ Prompt Premium v3 — não iniciada/);", "assert.match(text, /Próxima unidade de trabalho:\\*\\* concluir deployment de produção e ativação controlada da Sprint 3\\.7 — bloqueada por quota Vercel/);", "teste próxima unidade")
old_test_block = '''test("Sprints 3.5 e 3.6 estão concluídas e 3.7 não foi iniciada", () => {
  const text = body();
  for (const required of [
    "A Sprint 3.6 está formalmente concluída",
    "Sprint 3.6 completa: formalmente concluída",
    "Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "Estado: **planejada e não iniciada**",
    "A Sprint 3.7 não foi iniciada automaticamente",
    "ruleset `0.2.0` está homologado",
    "Risk Lab não está integrado ao Premium/notificações",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
  assert.doesNotMatch(text, /Sprint 3\.6 não está concluída/i);
  assert.doesNotMatch(text, /ruleset `0\.1\.0` não está homologado/i);
});'''
new_test_block = '''test("Sprint 3.7 está mesclada, mas a conclusão formal permanece bloqueada por produção", () => {
  const text = body();
  for (const required of [
    "A Sprint 3.6 está formalmente concluída",
    "Sprint 3.6 completa: formalmente concluída",
    "Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "implementada, testada e mesclada; conclusão formal bloqueada por deployment de produção",
    "deployment de produção do merge",
    "quota diária do Vercel",
    "ENABLE_RISK_LAB_PREMIUM_READONLY",
    "Notificações do Risk Lab continuam proibidas",
    "nenhuma etapa seguinte deve iniciar",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
  assert.doesNotMatch(text, /Sprint 3\.7.*formalmente concluída/i);
  assert.doesNotMatch(text, /ruleset `0\.1\.0` não está homologado/i);
});'''
test = once(test, old_test_block, new_test_block, "teste estado 3.7")
insert_before = 'test("arquivos e gates permanentes da 3.5-C existem", () => {'
new_test = '''test("evidência canônica da Sprint 3.7 e bloqueio de produção estão registrados", () => {
  const text = body();
  for (const required of [
    "merge funcional: `7391791b09b1615a86e29c2002b74f95f55e833e`",
    "`982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`",
    "`de2d1abd481e2a66b296dc7eab667277cc8072c807872f9f7b3982da8aa9bbcd`",
    "premium-fund-analysis-v3",
    "premium-manager-mode-v3",
    "Preview do runtime",
    "api-deployments-free-per-day",
    "conclusão formal: `false`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

'''
test = once(test, insert_before, new_test + insert_before, "teste evidência 3.7")
test = once(
    test,
    '    "tests/risk-lab-calibration-phase-3-6-evidence.test.mjs",\n  ];',
    '    "tests/risk-lab-calibration-phase-3-6-evidence.test.mjs",\n    "docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json",\n    "docs/risk-lab/sprint-3-7-premium-readonly.md",\n    "docs/premium/PROMPT_PREMIUM_V3.md",\n    "src/lib/risk-lab/RiskLabPremiumReadModel.ts",\n    "src/lib/risk-lab/risk-lab-premium-readonly-v1.json",\n    "tests/risk-lab-premium-readonly.test.ts",\n    "tests/risk-lab-premium-integration.test.mjs",\n  ];',
    "teste arquivos 3.7",
)
test = once(test, "  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);", "  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);\n  assert.match(workflow, /Validate Premium read-only integration and Prompt v3/);", "teste workflow 3.7")
test = once(test, '    "3.7 — Risk Lab read-only no Premium + Prompt Premium v3",', '    "3.7-D — concluir deployment de produção, ativação controlada e smoke test",', "teste roadmap")

handoff_path.write_text(handoff)
test_path.write_text(test)
print("Handoff v6.13 e teste canônico gerados com estado parcial honesto da Sprint 3.7.")
