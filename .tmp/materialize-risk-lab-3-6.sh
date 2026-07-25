#!/usr/bin/env bash
set -euo pipefail

cat .tmp/cal36-bundle-00 .tmp/cal36-bundle-01 .tmp/cal36-bundle-02 .tmp/cal36-bundle-03 > .tmp/cal36-permanent.tar.gz.b64
echo '09c6f162edb48f31c3e906ccbf2137bd1a43b1df0617a01d18c5d6010629b909  .tmp/cal36-permanent.tar.gz.b64' | sha256sum -c -
base64 -d .tmp/cal36-permanent.tar.gz.b64 > .tmp/cal36-permanent.tar.gz
echo '8191c83845f6d526fa96b172dfed961a977cfb88978a5d6eb4041516684081ba  .tmp/cal36-permanent.tar.gz' | sha256sum -c -
tar -xzf .tmp/cal36-permanent.tar.gz -C .

python - <<'PY'
from pathlib import Path
import json

source_path = Path('src/lib/risk-lab/RiskLabRulesetV020.ts')
source = source_path.read_text()
source_replacements = [
  (
    'export class RiskLabRulesetV020 {\n  constructor(private readonly config: RiskLabRulesetV020Config = loadRiskLabRulesetV020Config()) {}\n',
    'export class RiskLabRulesetV020 {\n  private readonly config: RiskLabRulesetV020Config;\n\n  constructor(config: RiskLabRulesetV020Config = loadRiskLabRulesetV020Config()) {\n    this.config = config;\n  }\n',
  ),
  ('config.candidateSpace.recoveryThresholds.length === 21', 'config.candidateSpace.recoveryThresholds.length === 10'),
  ('config.candidateSpace.recoveryThresholds[0] === 0.7', 'config.candidateSpace.recoveryThresholds[0] === 0.81'),
  ('config.candidateSpace.recoveryThresholds[20] === 0.9', 'config.candidateSpace.recoveryThresholds[9] === 0.9'),
]
for old, new in source_replacements:
    if source.count(old) != 1:
        raise SystemExit(f'Trecho esperado ausente ou duplicado no ruleset: {old}')
    source = source.replace(old, new, 1)
source_path.write_text(source)

config_path = Path('src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json')
config = json.loads(config_path.read_text())
config['candidateSpace']['recoveryThresholds'] = [round(value / 100, 2) for value in range(81, 91)]
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')

replacements = {
  'src/lib/risk-lab/FrozenCalibrationPhase36.ts': [
    ('config.candidateSpace.recoveryThresholds.length === 21', 'config.candidateSpace.recoveryThresholds.length === 10'),
  ],
  'tests/risk-lab-calibration-phase-3-6.test.ts': [
    ('config.candidateSpace.recoveryThresholds.length, 21', 'config.candidateSpace.recoveryThresholds.length, 10'),
  ],
  'tests/risk-lab-calibration-phase-3-6-evidence.test.mjs': [
    ('ruleset.candidateSpace.recoveryThresholds.length, 21', 'ruleset.candidateSpace.recoveryThresholds.length, 10'),
    ('ruleset.candidateSpace.recoveryThresholds[0], 0.7', 'ruleset.candidateSpace.recoveryThresholds[0], 0.81'),
    ('candidateSpace.candidates.length, 21', 'candidateSpace.candidates.length, 10'),
  ],
  'scripts/build-risk-lab-calibration-phase-3-6.ts': [
    ('espaço de busca limitado a 21 candidatos de recuperação', 'espaço de busca limitado a 10 candidatos de recuperação'),
  ],
}
for filename, pairs in replacements.items():
    file_path = Path(filename)
    text_value = file_path.read_text()
    for old, new in pairs:
        if text_value.count(old) != 1:
            raise SystemExit(f'Trecho esperado ausente ou duplicado em {filename}: {old}')
        text_value = text_value.replace(old, new, 1)
    file_path.write_text('\n'.join(line.rstrip() for line in text_value.splitlines()) + '\n')

path = Path('.github/workflows/risk-lab.yml')
text = path.read_text()
start = '  # BEGIN TEMP MATERIALIZER 3.6\n'
end = '  # END TEMP MATERIALIZER 3.6\n'
if text.count(start) != 1 or text.count(end) != 1:
    raise SystemExit('Bloco temporário do materializador não foi encontrado de forma única.')
before, rest = text.split(start, 1)
_, after = rest.split(end, 1)
text = before + after
text = text.replace('permissions:\n  contents: write\n', 'permissions:\n  contents: read\n', 1)

marker = '''      - name: Validate TypeScript diagnostics
'''
step = '''      - name: Validate calibrated and homologated Risk Lab ruleset
        id: phase_3_6_tests
        shell: bash
        run: |
          set -o pipefail
          node --import ./tests/register-ts-loader.mjs --experimental-strip-types --test \\
            tests/risk-lab-calibration-phase-3-6.test.ts \\
            tests/risk-lab-calibration-phase-3-6-evidence.test.mjs 2>&1 | tee .tmp/phase-3-6-ci.log

'''
if 'id: phase_3_6_tests' not in text:
    if text.count(marker) != 1:
        raise SystemExit('Marcador de typecheck divergente no Risk Lab CI.')
    text = text.replace(marker, step + marker)

old_condition = "steps.phase_c_tests.outcome == 'failure' || steps.typecheck.outcome"
new_condition = "steps.phase_c_tests.outcome == 'failure' || steps.phase_3_6_tests.outcome == 'failure' || steps.typecheck.outcome"
if old_condition in text:
    text = text.replace(old_condition, new_condition, 1)
elif new_condition not in text:
    raise SystemExit('Condição de diagnóstico da CI divergente.')

old_logs = '            .tmp/phase-c-ci.log\n            .tmp/typecheck.log'
new_logs = '            .tmp/phase-c-ci.log\n            .tmp/phase-3-6-ci.log\n            .tmp/typecheck.log'
if old_logs in text:
    text = text.replace(old_logs, new_logs, 1)
elif new_logs not in text:
    raise SystemExit('Lista de logs da CI divergente.')

path.write_text(text)
PY

node --import ./tests/register-ts-loader.mjs --experimental-strip-types scripts/build-risk-lab-calibration-phase-3-6.ts
node --import ./tests/register-ts-loader.mjs --experimental-strip-types --test \
  tests/risk-lab-calibration-phase-3-6.test.ts \
  tests/risk-lab-calibration-phase-3-6-evidence.test.mjs
npm run typecheck

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git rm --ignore-unmatch \
  .tmp/explore-risk-lab-3-6.ts \
  .tmp/explore-risk-lab-3-6.mjs \
  .tmp/materialize-risk-lab-3-6.sh \
  .tmp/cal36-bundle-00 \
  .tmp/cal36-bundle-01 \
  .tmp/cal36-bundle-02 \
  .tmp/cal36-bundle-03 \
  .github/workflows/risk-lab-3-6-explore.yml \
  .github/workflows/risk-lab-3-6-materialize.yml
rm -f .tmp/cal36-permanent.tar.gz .tmp/cal36-permanent.tar.gz.b64

git add \
  .github/workflows/risk-lab.yml \
  src/lib/risk-lab/RiskLabRulesetV020.ts \
  src/lib/risk-lab/FrozenCalibrationPhase36.ts \
  src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json \
  scripts/build-risk-lab-calibration-phase-3-6.ts \
  tests/risk-lab-calibration-phase-3-6.test.ts \
  tests/risk-lab-calibration-phase-3-6-evidence.test.mjs \
  docs/production-evidence/risk-lab/calibration-phase-3-6 \
  docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json \
  docs/risk-lab/sprint-3-6-calibration.md

git diff --cached --check
git commit -m 'feat: homologa ruleset v0.2.0 do Risk Lab'

if ! git push origin HEAD:agent/sprint-3-6-calibration; then
  tar -czf .tmp/cal36-final-output.tar.gz \
    .github/workflows/risk-lab.yml \
    src/lib/risk-lab/RiskLabRulesetV020.ts \
    src/lib/risk-lab/FrozenCalibrationPhase36.ts \
    src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json \
    scripts/build-risk-lab-calibration-phase-3-6.ts \
    tests/risk-lab-calibration-phase-3-6.test.ts \
    tests/risk-lab-calibration-phase-3-6-evidence.test.mjs \
    docs/production-evidence/risk-lab/calibration-phase-3-6 \
    docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json \
    docs/risk-lab/sprint-3-6-calibration.md
  echo '__CAL36_FINAL_SHA256__'
  sha256sum .tmp/cal36-final-output.tar.gz
  echo '__CAL36_FINAL_B64_BEGIN__'
  base64 -w0 .tmp/cal36-final-output.tar.gz
  echo
  echo '__CAL36_FINAL_B64_END__'
  exit 1
fi
