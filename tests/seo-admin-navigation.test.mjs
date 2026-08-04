import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public navigation does not expose the administrative area", () => {
  const navigation = read("src/app/components/SiteNav.tsx");

  assert.doesNotMatch(navigation, /AdminEntryLink/);
  assert.doesNotMatch(navigation, /ShieldCheck/);
  assert.doesNotMatch(navigation, /href=["']\/admin(?:\/|["'])/);
  assert.equal(
    existsSync(new URL("../src/app/components/AdminEntryLink.tsx", import.meta.url)),
    false,
  );
});

test("robots keeps administrative and API routes out of public crawling", () => {
  const robots = read("src/app/robots.ts");

  assert.match(robots, /disallow:\s*\[[^\]]*["']\/admin\/["']/s);
  assert.match(robots, /disallow:\s*\[[^\]]*["']\/api\/["']/s);
  assert.match(robots, /sitemap:\s*`\$\{SITE_URL\}\/sitemap\.xml`/);
});
