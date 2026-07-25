from pathlib import Path
import re

handoff_path = Path('DADOS_FII_HANDOFF.md')
test_path = Path('tests/canonical-handoff.test.mjs')
text = handoff_path.read_text()
test = test_path.read_text()

def once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {count}')
    return source.replace(old, new, 1)

def regex_once(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: padrão não encontrado de forma única')
    return updated

# Cabeçalho e decisões vigentes.
text = once(text, '**Versão:** 6.11.0', '**Versão:** 6.12.0', 'versão')
text = once(text, '**Base funcional auditada:** `ef0c621f2f813009fdb3999b721e4f4a6568c134`', '**Base funcional auditada:** `bfdc186057652a535025d19beae061856624d5c1`', 'base')
text = once(text, '**Sprint corrente:** 3.6 — calibração e homologação do ruleset — planejada, não iniciada', '**Sprint corrente:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — planejada, não iniciada', 'sprint corrente')
text = once(text, '**Próxima unidade de trabalho:** 3.6 — calibração e homologação do ruleset — não iniciada', '**Próxima unidade de trabalho:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — não iniciada', 'próxima unidade')
text = once(text, 'Este Handoff v6.11.0 é a única referência canônica', 'Este Handoff v6.12.0 é a única referência canônica', 'linha canônica')
text = once(text,
    '| A Sprint 3.5 está formalmente concluída e a 3.6 é a próxima unidade, ainda não iniciada. | Sprint 3.5 em andamento. | Concluída / planejada | PR #128, merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`; backtest concluído com calibração obrigatória. |',
    '| As Sprints 3.5 e 3.6 estão formalmente concluídas; a 3.7 é a próxima unidade, ainda não iniciada. | Sprint 3.6 planejada. | Concluída / planejada | PR #131, merge `bfdc186057652a535025d19beae061856624d5c1`; ruleset `0.2.0` homologado. |',
    'decisão sprint')
text = once(text,
    '| A próxima fase é 3.6 — calibração e homologação e não inicia automaticamente. | Promover o ruleset diretamente ao produto. | Planejada | O ruleset `0.1.0` não está homologado; KNSC11 e MCCI11 exigem calibração sem look-ahead. |',
    '| A Sprint 3.6 — calibração e homologação está formalmente concluída. | Ruleset `0.1.0` não homologado. | Concluída | Ruleset `0.2.0`, 100% de acurácia nos cinco casos verificáveis, zero falso positivo e zero falso negativo. |\n| A próxima fase é 3.7 — integração read-only no Premium + Prompt Premium v3 e não inicia automaticamente. | Promover o ruleset diretamente ao produto. | Planejada | A homologação metodológica não equivale a integração de produto. |',
    'decisões 3.6/3.7')
text = once(text,
    '| Risk Lab permanece fora do Premium e das notificações até 3.5/3.6. | Integração antecipada. | Bloqueada | Produto não pode consumir metodologia não homologada. |',
    '| Risk Lab permanece fora do Premium e das notificações até a Sprint 3.7 implementar integração read-only com feature flag, fallback e rollback. | Integração automática após homologação. | Bloqueada | Homologação metodológica da 3.6 não conecta o ruleset ao produto. |',
    'bloqueio produto')

# Resumo e auditoria.
text = once(text,
    '- Próxima unidade: 3.6 — calibração e homologação do ruleset, ainda não iniciada.\n- Risk Lab permanece isolado de Premium e notificações até a conclusão e homologação da Sprint 3.6.',
    '- A Sprint 3.6 está formalmente concluída; o ruleset `0.2.0` foi homologado com 100% de acurácia nos cinco casos verificáveis, zero falso positivo e zero falso negativo.\n- MCCI11 permanece `inconclusive_unscored`, fora da otimização e das métricas pontuadas.\n- Próxima unidade: 3.7 — Risk Lab read-only no Premium + Prompt Premium v3, ainda não iniciada.\n- Risk Lab permanece isolado de Premium e notificações até a implementação e validação próprias da Sprint 3.7.',
    'resumo executivo')
text = once(text,
    '| Sprint 3.6 — calibração | Não | Não | Não iniciada | **Planejada** |',
    '| Sprint 3.6 — calibração | Sim | Sim | Preview Ready; sem integração de produto | **Formalmente concluída e homologada** |\n| Sprint 3.7 — integração read-only | Não | Não | Não iniciada | **Planejada** |',
    'auditoria 3.6')
text = once(text,
    '- Sprint 3.6: planejada e não iniciada.\n- Integração com Premium/notificações: proibida antes dos gates 3.5/3.6.',
    '- Sprint 3.6 completa: formalmente concluída; ruleset `0.2.0` homologado.\n- Sprint 3.7: planejada e não iniciada.\n- Integração com Premium/notificações: proibida até os gates próprios da Sprint 3.7.',
    'fase 3')

# Evidência canônica da 3.6.
evidence = '''### Evidência canônica da Sprint 3.6 — calibração e homologação

- issue `#130`; PR funcional `#131`;
- merge funcional: `bfdc186057652a535025d19beae061856624d5c1`;
- ruleset de origem: `0.1.0`; ruleset homologado: `0.2.0`;
- estrutura preservada: 6 meses de baseline, 3 de estresse e 3 de recuperação;
- parâmetros: estresse `80%`, recuperação `89%`, margem mínima `0,5 ponto percentual`;
- espaço pré-registrado: 10 candidatos válidos, de `81%` a `90%`;
- validação: cinco folds leave-one-verified-case-out, todos selecionando `89%`, estáveis e corretos no holdout;
- métricas: 5/5 casos verificáveis corretos, acurácia `100%`, cobertura `83,33%`, falsos positivos `0`, falsos negativos `0`;
- disposições: DEVA11 e VSLH11 `elevated_risk`; KNCR11 `none`; KNSC11 e RBRY11 `informational_recovery`;
- MCCI11: `inconclusive_unscored`, excluído da otimização e das métricas pontuadas;
- hash da configuração: `91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`;
- hash do relatório: `22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`;
- hash da evidência: `fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81`;
- índice final: `35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`;
- homologação permitida: `true`; Premium integrado: `false`; notificações enviadas: `false`.

'''
text = once(text, '\n---\n\n## 3. Sprint atual', '\n\n' + evidence + '---\n\n## 3. Sprint atual', 'inserção evidência 3.6')

# Sprint atual e ordem oficial.
text = regex_once(text, r'## 3\. Sprint atual\n.*?\n---\n\n## 4\. Ordem oficial das próximas sprints', '''## 3. Sprint atual

### Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

Estado: **planejada e não iniciada**.

Entrada obrigatória:

1. consumir apenas o ruleset homologado `0.2.0` e suas evidências versionadas;
2. executar cálculos determinísticos antes da IA;
3. expor leitura informativa, nunca recomendação de investimento;
4. manter MCCI11 como inconclusivo quando a verdade-terreno não permitir conclusão;
5. implementar feature flag, autorização, auditoria, fallback e rollback;
6. impedir notificações automáticas até existir gate específico;
7. validar Preview e produção porque esta fase altera o runtime do produto.

A Sprint 3.7 não foi iniciada automaticamente. Exige issue, branch, PR, CI, evidência, deployment real, merge, auditoria do `main` e atualização canônica próprios.

---

## 4. Ordem oficial das próximas sprints''', 'seção 3')
text = regex_once(text, r'## 4\. Ordem oficial das próximas sprints\n.*?\n---\n\n## 5\. Escopo e critérios de aceite de cada sprint', '''## 4. Ordem oficial das próximas sprints

1. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3** — não iniciada.
2. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.
3. **4.1 — Radar: acompanhar fundo fora da carteira**.
4. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.

---

## 5. Escopo e critérios de aceite de cada sprint''', 'seção 4')
text = regex_once(text, r'### 3\.6 — calibração\n.*?\n### 3\.7 — integração read-only', '''### 3.6 — calibração — concluída

- dataset e hashes da 3.5-C preservados integralmente;
- espaço de candidatos limitado e versionado antes da seleção;
- nenhuma exceção ou parâmetro por ticker;
- zero look-ahead;
- zero falsos positivos e zero falsos negativos nos cinco casos verificáveis;
- KNSC11 corrigido como recuperação informativa, sem apagar o falso positivo histórico da 3.5-C;
- MCCI11 mantido inconclusivo e fora da otimização;
- todos os folds fora da amostra aprovados;
- ruleset `0.2.0`, evidência, testes, CI, build, Preview, merge e auditoria do `main` concluídos.

### 3.7 — integração read-only''', 'subseção 3.6')

# Arquivos e funcionalidades.
text = once(text, '- PR #128 — dataset e backtest 3.5-C; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.', '- PR #128 — dataset e backtest 3.5-C; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.\n- PR #131 — calibração e homologação 3.6; merge `bfdc186057652a535025d19beae061856624d5c1`.', 'PR 131')
text = once(text, '- `docs/production-evidence/risk-lab/cohort-phase-c-manifest.json`', '- `docs/production-evidence/risk-lab/cohort-phase-c-manifest.json`\n- `docs/production-evidence/risk-lab/calibration-phase-3-6/`\n- `docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json`\n- `docs/risk-lab/sprint-3-6-calibration.md`\n- `src/lib/risk-lab/RiskLabRulesetV020.ts`\n- `src/lib/risk-lab/FrozenCalibrationPhase36.ts`\n- `tests/risk-lab-calibration-phase-3-6.test.ts`\n- `tests/risk-lab-calibration-phase-3-6-evidence.test.mjs`', 'evidências 3.6')
text = once(text, '- Risk Lab até 3.4, os seis casos da coorte e a Fase 3.5-C de dataset e backtest; Sprint 3.5 formalmente concluída.', '- Risk Lab até 3.4, Sprint 3.5 e Sprint 3.6 formalmente concluídas; ruleset `0.2.0` homologado.', 'concluídas')
text = once(text, '- Sprint 3.6: planejada e não iniciada; calibração deve resolver KNSC11 falso positivo e MCCI11 inconclusivo sem look-ahead.', '- Sprint 3.7: planejada e não iniciada; integração read-only e Prompt Premium v3 exigem gates próprios de runtime.', 'parciais')
text = once(text, '- Calibração e homologação da Sprint 3.6.\n- Prompt Premium v3 e integração read-only.', '- Prompt Premium v3 e integração read-only da Sprint 3.7.', 'pendentes')
text = once(text, '9. Premium e alertas não consomem Risk Lab antes das Sprints 3.5 e 3.6.', '9. Premium e alertas não consomem Risk Lab antes da implementação e validação próprias da Sprint 3.7.', 'regra arquitetura')
text = once(text, '- flags de Risk Lab permanecem desligadas para Premium/notificações até homologação;', '- flags de Risk Lab permanecem desligadas para Premium/notificações até a integração controlada da Sprint 3.7;', 'flags')
text = once(text, '- testes do dataset e backtest da Fase 3.5-C', '- testes do dataset e backtest da Fase 3.5-C\n- testes de calibração, leave-one-case-out e homologação da Sprint 3.6', 'gates')
text = once(text,
    '- Abrir issue e branch exclusivas para 3.6 — calibração e homologação do ruleset, somente mediante nova instrução do usuário.\n- Consumir o dataset imutável da 3.5-C sem alterar verdade-terreno, papéis ou hashes históricos.\n- Não iniciar 3.7, Premium ou notificações antes da homologação formal da Sprint 3.6.',
    '- Abrir issue e branch exclusivas para 3.7 — Risk Lab read-only no Premium + Prompt Premium v3, somente mediante nova instrução do usuário.\n- Consumir somente o ruleset homologado `0.2.0`, sem alterar dataset, verdade-terreno ou hashes históricos.\n- Não integrar Premium nem notificações fora dos gates próprios da Sprint 3.7.',
    'próxima execução')
text = once(text,
    'Este documento registra a Sprint 3.5 como formalmente concluída e a Sprint 3.6 como próxima unidade planejada, ainda não iniciada. O ruleset `0.1.0` não está homologado, o Risk Lab não está liberado para Premium/notificações e nenhuma fase seguinte deve ser promovida sem evidência e testes próprios.',
    'Este documento registra as Sprints 3.5 e 3.6 como formalmente concluídas e a Sprint 3.7 como próxima unidade planejada, ainda não iniciada. O ruleset `0.2.0` está homologado, mas o Risk Lab não está integrado ao Premium/notificações; nenhuma fase seguinte deve ser promovida sem evidência, testes e deployment próprios.',
    'regra de parada')

# Teste canônico v6.12.
test = once(test, '6\\.11\\.0', '6\\.12\\.0', 'teste versão')
test = once(test, 'ef0c621f2f813009fdb3999b721e4f4a6568c134', 'bfdc186057652a535025d19beae061856624d5c1', 'teste base')
test = once(test, 'Próxima unidade de trabalho:\\*\\* 3\\.6 — calibração e homologação do ruleset — não iniciada', 'Próxima unidade de trabalho:\\*\\* 3\\.7 — Risk Lab read-only no Premium \\+ Prompt Premium v3 — não iniciada', 'teste próxima')
test = regex_once(test, r'test\("Sprint 3\.5 está concluída e 3\.6 não foi iniciada", \(\) => \{.*?\n\}\);\n\n', '''test("Sprints 3.5 e 3.6 estão concluídas e 3.7 não foi iniciada", () => {
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
});

''', 'teste estado')
new_test = '''test("evidência canônica da Sprint 3.6 está registrada", () => {
  const text = body();
  for (const required of [
    "merge funcional: `bfdc186057652a535025d19beae061856624d5c1`",
    "ruleset homologado: `0.2.0`",
    "recuperação `89%`",
    "falsos positivos `0`",
    "falsos negativos `0`",
    "MCCI11: `inconclusive_unscored`",
    "`91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`",
    "`22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`",
    "`35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`",
    "Premium integrado: `false`",
    "notificações enviadas: `false`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

'''
test = once(test, 'test("arquivos e gates permanentes da 3.5-C existem", () => {', new_test + 'test("arquivos e gates permanentes da 3.5-C existem", () => {', 'inserção teste 3.6')
test = once(test, '    "tests/risk-lab-frozen-cohort-phase-c.test.ts",', '    "tests/risk-lab-frozen-cohort-phase-c.test.ts",\n    "docs/production-evidence/risk-lab/calibration-phase-3-6/index.json",\n    "docs/production-evidence/risk-lab/calibration-phase-3-6/calibration-report.json",\n    "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json",\n    "src/lib/risk-lab/RiskLabRulesetV020.ts",\n    "src/lib/risk-lab/FrozenCalibrationPhase36.ts",\n    "tests/risk-lab-calibration-phase-3-6.test.ts",\n    "tests/risk-lab-calibration-phase-3-6-evidence.test.mjs",', 'arquivos teste')
test = once(test, '  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);', '  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);\n  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);', 'workflow teste')

handoff_path.write_text(text)
test_path.write_text(test)
