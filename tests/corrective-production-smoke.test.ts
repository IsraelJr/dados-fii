import assert from "node:assert/strict";
import test from "node:test";
import { validateGithubActionsClaims } from "../src/lib/security/GithubActionsOidc";

const sha = "a".repeat(40);
const validClaims = {
  repository: "IsraelJr/dados-fii",
  ref: "refs/heads/main",
  sha,
  workflow_ref: "IsraelJr/dados-fii/.github/workflows/production-premium-smoke.yml@refs/heads/main",
  run_id: "12345",
  run_attempt: "2",
  actor_id: "789",
};

test("política OIDC vincula repositório, workflow, main e SHA publicado", () => {
  const identity = validateGithubActionsClaims(validClaims, sha);
  assert.equal(identity.sha, sha);
  assert.equal(identity.repository, "IsraelJr/dados-fii");
  assert.equal(identity.runId, "12345");
});

test("política OIDC rejeita fork, outro workflow, branch ou SHA", () => {
  assert.throws(
    () => validateGithubActionsClaims({ ...validClaims, repository: "attacker/fork" }, sha),
    /Repositório/,
  );
  assert.throws(
    () => validateGithubActionsClaims({ ...validClaims, ref: "refs/heads/feature" }, sha),
    /main/,
  );
  assert.throws(
    () => validateGithubActionsClaims({ ...validClaims, workflow_ref: "IsraelJr/dados-fii/.github/workflows/evil.yml@refs/heads/main" }, sha),
    /Workflow/,
  );
  assert.throws(
    () => validateGithubActionsClaims(validClaims, "b".repeat(40)),
    /SHA/,
  );
});
