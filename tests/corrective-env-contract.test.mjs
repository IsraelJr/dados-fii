import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function filesBelow(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory() ? filesBelow(target) : [target];
  });
}

test("inventário versionado cobre todas as variáveis de runtime sem tornar segredo público", () => {
  const sourceFiles = [
    ...filesBelow("src"),
    "next.config.ts",
    "playwright.config.ts",
  ].filter((file) => /\.(?:ts|tsx|mjs)$/.test(file));
  const used = new Set();
  const expression = /process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g;
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(expression)) used.add(match[1] || match[2]);
  }
  const flags = readFileSync("src/lib/featureFlags.ts", "utf8").match(/ENABLE_[A-Z0-9_]+/g) || [];
  flags.forEach((flag) => used.add(flag));

  const example = readFileSync(".env.example", "utf8");
  const handoff = readFileSync("DADOS_FII_HANDOFF.md", "utf8");
  const documented = new Set(
    example
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter(Boolean),
  );

  const missingFromExample = [...used].filter((name) => name !== "CI" && !documented.has(name)).sort();
  const missingFromHandoff = [...used].filter((name) => !handoff.includes(`\`${name}\``)).sort();
  assert.deepEqual(missingFromExample, []);
  assert.deepEqual(missingFromHandoff, []);
  assert.doesNotMatch(example, /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PASSWORD|ADMIN_EMAILS|PRIVATE_KEY|CRON_TOKEN)/);
  assert.doesNotMatch(example, /(?:FIREBASE_SERVICE_ACCOUNT_KEY|CRON_SECRET|OPENAI_API_KEY|RESEND_API_KEY)=.+/);
});
