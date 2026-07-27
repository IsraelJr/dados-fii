import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function filesBelow(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory() ? filesBelow(target) : [target.replaceAll(path.sep, "/")];
  });
}

const sourceFiles = filesBelow("src").filter((file) => /\.(?:ts|tsx)$/.test(file));

function resolveSourceImport(from, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? path.join("src", specifier.slice(2))
    : path.resolve(path.dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    const relative = path.relative(process.cwd(), path.resolve(candidate)).replaceAll(path.sep, "/");
    if (existsSync(relative) && statSync(relative).isFile()) return relative;
  }
  return null;
}

test("camadas de UI, repository e Route Handler respeitam seus limites", () => {
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    if (file.includes("/components/") || /src\/app\/[^/]+\/page\.tsx$/.test(file)) {
      assert.doesNotMatch(source, /firebaseAdmin|adminDb|server\/controllers|RegulatoryRepository/, file);
    }
    if (/Repository\.ts$/.test(file)) {
      assert.doesNotMatch(source, /next\/server|NextResponse|src\/app|@\/app|React/, file);
    }
    if (file.endsWith("/route.ts")) {
      assert.doesNotMatch(source, /firebaseAdmin|firebase-admin|adminDb|\.collection\(/, file);
    }
  }
});

test("grafo de imports internos não possui dependência circular", () => {
  const graph = new Map();
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    const dependencies = [];
    for (const match of source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) {
      const resolved = resolveSourceImport(file, match[1]);
      if (resolved) dependencies.push(resolved);
    }
    graph.set(file, dependencies);
  }

  const visited = new Set();
  const active = new Set();
  const stack = [];
  const cycles = [];
  function visit(file) {
    if (active.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].join(" -> "));
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    stack.pop();
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  assert.deepEqual(cycles, []);
});
