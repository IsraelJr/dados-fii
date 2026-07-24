import assert from "node:assert/strict";
import test from "node:test";
import { resolveFirebaseAdminBootstrapConfig } from "../src/lib/firebaseAdminConfig";

test("usa a conta de serviço quando a credencial válida está presente", () => {
  const config = resolveFirebaseAdminBootstrapConfig({
    FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({
      project_id: "dados-fii",
      client_email: "firebase-admin@example.test",
      private_key: "test-key",
    }),
    ALLOW_FIREBASE_ADMIN_BUILD_WITHOUT_CREDENTIALS: "true",
  });

  assert.equal(config.mode, "service-account");
  if (config.mode === "service-account") {
    assert.equal(config.serviceAccount.project_id, "dados-fii");
  }
});

test("falha fechado quando a credencial está ausente fora do build autorizado", () => {
  assert.throws(
    () => resolveFirebaseAdminBootstrapConfig({}),
    /FIREBASE_SERVICE_ACCOUNT_KEY ausente/,
  );
});

test("falha fechado quando a credencial contém JSON inválido", () => {
  assert.throws(
    () => resolveFirebaseAdminBootstrapConfig({ FIREBASE_SERVICE_ACCOUNT_KEY: "undefined" }),
    /JSON inválido/,
  );
});

test("falha fechado quando a credencial não é um objeto JSON", () => {
  assert.throws(
    () => resolveFirebaseAdminBootstrapConfig({ FIREBASE_SERVICE_ACCOUNT_KEY: "[]" }),
    /objeto JSON/,
  );
});

test("permite inicialização sem credenciais somente com opt-in explícito de build", () => {
  assert.deepEqual(
    resolveFirebaseAdminBootstrapConfig({
      ALLOW_FIREBASE_ADMIN_BUILD_WITHOUT_CREDENTIALS: "true",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dados-fii-ci",
    }),
    { mode: "build-only", projectId: "dados-fii-ci" },
  );
});

test("modo de build usa projeto neutro quando o ID público está ausente", () => {
  assert.deepEqual(
    resolveFirebaseAdminBootstrapConfig({
      ALLOW_FIREBASE_ADMIN_BUILD_WITHOUT_CREDENTIALS: "true",
    }),
    { mode: "build-only", projectId: "dados-fii-build" },
  );
});
