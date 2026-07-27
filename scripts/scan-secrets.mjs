import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.endsWith("package-lock.json"))
  .filter((file) => !/\.(png|jpe?g|gif|ico|pdf|zip|woff2?)$/i.test(file));

const patterns = [
  {
    id: "private-key",
    expression: new RegExp(["BEGIN", "(?:RSA |EC |OPENSSH |)", "PRIVATE KEY"].join("[ -]+")),
  },
  {
    id: "github-token",
    expression: new RegExp(["gh", "[pousr]", "_[A-Za-z0-9]{30,}"].join("")),
  },
  {
    id: "openai-token",
    expression: new RegExp(["(?:^|[^A-Za-z0-9])", "s", "k-", "(?:proj-)?[A-Za-z0-9_-]{24,}"].join("")),
  },
  {
    id: "public-sensitive-env",
    expression: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|ADMIN_EMAILS|CRON_TOKEN)/,
  },
  {
    id: "secret-in-url",
    expression: /[?&](?:secret|admin_secret|adminKey|cron_secret)=/i,
  },
  {
    id: "legacy-secret-input",
    expression: /searchParams\.get\(\s*["'](?:secret|adminSecret|adminKey)["']\s*\)/,
  },
];

const violations = [];
for (const file of trackedFiles) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  content.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.expression.test(line)) {
        violations.push(`${file}:${index + 1} [${pattern.id}]`);
      }
      pattern.expression.lastIndex = 0;
    }
  });
}

if (violations.length) {
  console.error("Possíveis segredos ou contratos legados encontrados:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(`Secret scan aprovado em ${trackedFiles.length} arquivos versionados.`);
}
