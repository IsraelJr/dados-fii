import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { resolveFunctionalQaPreviewDeployment } from "../scripts/resolve-functional-qa-preview-deployment.mjs";

const suffix = "-israel-alves-projects-aee7aa56.vercel.app";
const validTarget = `https://dados-fii-valid${suffix}`;
const otherValidTarget = `https://dados-fii-newer${suffix}`;

function deployment(id, createdAt, overrides = {}) {
  return {
    id,
    created_at: createdAt,
    creator: { login: "vercel[bot]" },
    environment: "Preview",
    task: "deploy",
    ...overrides,
  };
}

function status(createdAt, overrides = {}) {
  return {
    created_at: createdAt,
    creator: { login: "vercel[bot]" },
    environment: "Preview",
    environment_url: validTarget,
    state: "success",
    ...overrides,
  };
}

async function resolve(deployments, statusesByDeployment) {
  return resolveFunctionalQaPreviewDeployment({
    deployments,
    previewHostnameSuffix: suffix,
    loadStatuses: async (deploymentId) => statusesByDeployment.get(deploymentId) || [],
  });
}

test("deployment mais recente falho cede ao deployment anterior válido", async () => {
  const result = await resolve(
    [deployment(2, "2026-08-02T12:00:00Z"), deployment(1, "2026-08-02T11:00:00Z")],
    new Map([
      [2, [status("2026-08-02T12:01:00Z", { environment_url: null, state: "failure" })]],
      [1, [status("2026-08-02T11:01:00Z")]],
    ]),
  );
  assert.deepEqual(result, { deploymentId: 1, target: validTarget });
});

test("deployment mais recente sem URL cede ao deployment anterior válido", async () => {
  const result = await resolve(
    [deployment(2, "2026-08-02T12:00:00Z"), deployment(1, "2026-08-02T11:00:00Z")],
    new Map([
      [2, [status("2026-08-02T12:01:00Z", { environment_url: "" })]],
      [1, [status("2026-08-02T11:01:00Z")]],
    ]),
  );
  assert.equal(result?.deploymentId, 1);
});

test("dois deployments válidos escolhem o mais recente válido", async () => {
  const visited = [];
  const result = await resolveFunctionalQaPreviewDeployment({
    deployments: [deployment(1, "2026-08-02T11:00:00Z"), deployment(2, "2026-08-02T12:00:00Z")],
    previewHostnameSuffix: suffix,
    loadStatuses: async (deploymentId) => {
      visited.push(deploymentId);
      return [status("2026-08-02T12:01:00Z", { environment_url: otherValidTarget })];
    },
  });
  assert.deepEqual(result, { deploymentId: 2, target: otherValidTarget });
  assert.deepEqual(visited, [2]);
});

test("nenhum deployment válido falha fechado", async () => {
  const result = await resolve(
    [deployment(2, "2026-08-02T12:00:00Z"), deployment(1, "2026-08-02T11:00:00Z")],
    new Map([
      [2, [status("2026-08-02T12:01:00Z", { state: "pending" })]],
      [1, [status("2026-08-02T11:01:00Z", { state: "cancelled" })]],
    ]),
  );
  assert.equal(result, null);
});

test("deployment criado por ator não confiável é ignorado", async () => {
  const visited = [];
  const result = await resolveFunctionalQaPreviewDeployment({
    deployments: [deployment(1, "2026-08-02T12:00:00Z", { creator: { login: "IsraelJr" } })],
    previewHostnameSuffix: suffix,
    loadStatuses: async (deploymentId) => {
      visited.push(deploymentId);
      return [status("2026-08-02T12:01:00Z")];
    },
  });
  assert.equal(result, null);
  assert.deepEqual(visited, []);
});

test("status criado por ator não confiável é rejeitado", async () => {
  const result = await resolve(
    [deployment(1, "2026-08-02T12:00:00Z")],
    new Map([[1, [status("2026-08-02T12:01:00Z", { creator: { login: "IsraelJr" } })]]]),
  );
  assert.equal(result, null);
});

test("status success sem environment_url é rejeitado", async () => {
  const result = await resolve(
    [deployment(1, "2026-08-02T12:00:00Z")],
    new Map([[1, [status("2026-08-02T12:01:00Z", { environment_url: undefined })]]]),
  );
  assert.equal(result, null);
});

test("URL inválida ou fora do domínio permitido é rejeitada", async (t) => {
  for (const candidate of ["http://dados-fii.example.com", "https://attacker.example.com", "não-é-url"]) {
    await t.test(candidate, async () => {
      const result = await resolve(
        [deployment(1, "2026-08-02T12:00:00Z")],
        new Map([[1, [status("2026-08-02T12:01:00Z", { environment_url: candidate })]]]),
      );
      assert.equal(result, null);
    });
  }
});

test("um sucesso antigo não reabilita deployment cujo status efetivo falhou", async () => {
  const result = await resolve(
    [deployment(1, "2026-08-02T12:00:00Z")],
    new Map([[1, [
      status("2026-08-02T12:02:00Z", { environment_url: null, state: "failure" }),
      status("2026-08-02T12:01:00Z"),
    ]]]),
  );
  assert.equal(result, null);
});

test("CLI falha fechado sem ecoar configuração ou sentinelas sensíveis", () => {
  const sentinels = {
    GH_TOKEN: "qa-fake-token-must-not-leak",
    VERCEL_PREVIEW_HOST_SUFFIX: "qa-fake-suffix-must-not-leak",
  };
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/resolve-functional-qa-preview-deployment.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        ...sentinels,
        DEPLOYMENT_SHA: "invalid",
        GITHUB_REPOSITORY: "IsraelJr/dados-fii",
        NODE_NO_WARNINGS: "1",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Nenhum deployment Preview válido foi encontrado para o SHA solicitado.\n");
  for (const sentinel of Object.values(sentinels)) {
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(sentinel));
  }
});
