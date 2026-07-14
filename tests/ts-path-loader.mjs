import { existsSync } from "node:fs";
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
  return nextResolve(specifier, context);
}
