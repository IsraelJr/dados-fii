import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function text(path) {
  return readFileSync(path, "utf8");
}

test("route handlers do histórico permanecem finos e sem Firestore", () => {
  for (const path of [
    "src/app/api/portfolio/history/route.ts",
    "src/app/api/portfolio/history/migrate/route.ts",
  ]) {
    const body = text(path);
    assert.doesNotMatch(body, /firebaseAdmin|adminDb|\.collection\(/);
    assert.match(body, /server\/controllers/);
  }
});

test("controller não aceita ownerId, userId ou e-mail do payload como identidade", () => {
  const body = text("src/server/controllers/PortfolioHistoryController.ts");
  assert.match(body, /resolveWalletIdentity\(request\)/);
  assert.doesNotMatch(body, /body\.(?:ownerId|userId|email)/);
  assert.doesNotMatch(body, /ownerId:\s*String\(body/);
});

test("migração também resolve ownership no servidor", () => {
  const body = text("src/server/controllers/PortfolioHistoryMigrationController.ts");
  assert.match(body, /resolveWalletIdentity\(request\)/);
  assert.doesNotMatch(body, /body\.(?:ownerId|userId|email)/);
});

test("repository server-side é a única camada do histórico que importa Firestore", () => {
  const repository = text("src/server/repositories/FirestorePortfolioHistoryRepository.ts");
  const repositoryCore = text("src/server/repositories/FirestorePortfolioHistoryRepositoryCore.ts");
  const service = text("src/lib/portfolio/PortfolioHistoryService.ts");
  assert.match(repository, /firebaseAdmin/);
  assert.match(repositoryCore, /runTransaction/);
  assert.doesNotMatch(service, /firebaseAdmin|adminDb|\.collection\(/);
});

test("listagem do histórico não depende de índice composto implantado separadamente", () => {
  const repository = text("src/server/repositories/FirestorePortfolioHistoryRepositoryCore.ts");
  assert.doesNotMatch(repository, /\.orderBy\("competence"/);
  assert.match(repository, /localeCompare\(right\.competence\)/);
});

test("identidade por e-mail exige sessão validada e cookie anônimo exige usuário existente", () => {
  const body = text("src/server/auth/WalletIdentityResolver.ts");
  assert.match(body, /WalletSessions/);
  assert.match(body, /sha256\(`\$\{email\}:\$\{token\}`\)/);
  assert.match(body, /expiresAt/);
  assert.match(body, /cookieStore\.get\("anonId"\)/);
  assert.match(body, /USER_NOT_FOUND/);
});
