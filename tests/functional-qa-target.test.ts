import assert from "node:assert/strict";
import test from "node:test";
import {
  validateQaTarget,
  vercelBypassHeadersForOrigin,
} from "./e2e/support/qaTarget.ts";

const suffix = "-israel-alves-projects-aee7aa56.vercel.app";
const preview = `https://dados-fii-git-agent-functional-qa${suffix}`;

test("Preview aceita somente a origem HTTPS do projeto e produção exige origem canônica", () => {
  assert.equal(validateQaTarget(preview, "Preview", { previewHostnameSuffix: suffix }), preview);
  assert.equal(validateQaTarget("https://www.dadosfii.com.br", "Production"), "https://www.dadosfii.com.br");
  for (const invalid of [
    "https://attacker.example",
    "https://dados-fii-attacker.vercel.app",
    `${preview}/login`,
    `${preview}?token=unsafe`,
    `https://user:password@dados-fii-preview${suffix}`,
  ]) {
    assert.throws(() => validateQaTarget(invalid, "Preview", { previewHostnameSuffix: suffix }));
  }
});

test("bypass é emitido só para a origem exata do Preview", () => {
  const expected = {
    "x-vercel-protection-bypass": "sentinel-bypass",
    "x-vercel-set-bypass-cookie": "true",
  };
  assert.deepEqual(vercelBypassHeadersForOrigin(preview, `${preview}/`, "sentinel-bypass"), expected);
  for (const external of [
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
    "https://firebase.googleapis.com/",
    "https://www.google-analytics.com/g/collect",
    "https://attacker.example/",
  ]) {
    assert.deepEqual(vercelBypassHeadersForOrigin(preview, external, "sentinel-bypass"), {});
  }
});
