import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = join(projectRoot, "src", specifier.slice(2));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    candidate = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (candidate && !extname(candidate) && existsSync(`${candidate}.ts`)) {
    return { url: pathToFileURL(`${candidate}.ts`).href, shortCircuit: true };
  }
  if (candidate && extname(candidate) === ".json" && existsSync(candidate)) {
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".json")) {
    const raw = readFileSync(fileURLToPath(url), "utf8");
    JSON.parse(raw);
    return {
      format: "module",
      source: `export default ${raw};`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
