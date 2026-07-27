import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;
const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test.before(async () => {
  if (!emulatorAvailable) return;
  environment = await initializeTestEnvironment({
    projectId: "demo-dados-fii",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

test.after(async () => {
  if (emulatorAvailable) await environment.cleanup();
});

if (emulatorAvailable) {
  test("cliente anônimo não lê nem altera qualquer coleção", async () => {
    const database = environment.unauthenticatedContext().firestore();
    for (const path of ["Fiis/TGAR11", "User/anon-user", "Parameters/runtime"]) {
      await assertFails(getDoc(doc(database, path)));
      await assertFails(setDoc(doc(database, path), { injected: true }));
    }
  });

  test("[REG-DEF-09] token de usuário não concede acesso direto ao Firestore", async () => {
    const database = environment.authenticatedContext("user-123", {
      email: "usuario@example.com",
      email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(database, "User/user-123")));
    await assertFails(setDoc(doc(database, "User/user-123"), { plan: "super_premium" }));
  });
}

test("regras versionadas adotam fail-closed global", () => {
  const source = readFileSync("firestore.rules", "utf8");
  assert.match(source, /match \/\{document=\*\*\}/);
  assert.match(source, /allow read, write: if false/);
});
