import { pathToFileURL } from "node:url";

import { validateQaTarget } from "../tests/e2e/support/qaTarget.ts";

export const RESOLUTION_FAILURE_MESSAGE =
  "Nenhum deployment Preview válido foi encontrado para o SHA solicitado.";

const TRUSTED_CREATOR = "vercel[bot]";
const PREVIEW_ENVIRONMENT = "Preview";

function newestFirst(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.item?.created_at || "");
      const rightTime = Date.parse(right.item?.created_at || "");
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function isTrustedPreviewDeployment(deployment) {
  return (
    deployment?.creator?.login === TRUSTED_CREATOR &&
    deployment?.task === "deploy" &&
    deployment?.environment === PREVIEW_ENVIRONMENT
  );
}

function validPreviewTarget(status, previewHostnameSuffix) {
  if (
    status?.state !== "success" ||
    status?.creator?.login !== TRUSTED_CREATOR ||
    status?.environment !== PREVIEW_ENVIRONMENT ||
    typeof status?.environment_url !== "string" ||
    status.environment_url.trim() === ""
  ) {
    return null;
  }

  try {
    return validateQaTarget(status.environment_url, PREVIEW_ENVIRONMENT, {
      previewHostnameSuffix,
    });
  } catch {
    return null;
  }
}

export async function resolveFunctionalQaPreviewDeployment({
  deployments,
  loadStatuses,
  previewHostnameSuffix,
}) {
  if (!Array.isArray(deployments) || typeof loadStatuses !== "function") return null;

  for (const deployment of newestFirst(deployments)) {
    if (!isTrustedPreviewDeployment(deployment)) continue;

    const statuses = await loadStatuses(deployment.id);
    if (!Array.isArray(statuses) || statuses.length === 0) continue;

    // O status mais recente representa o estado efetivo. Um sucesso antigo não
    // pode reabilitar um deployment posteriormente falho, cancelado ou pendente.
    const currentStatus = newestFirst(statuses)[0];
    const target = validPreviewTarget(currentStatus, previewHostnameSuffix);
    if (target) return { deploymentId: deployment.id, target };
  }

  return null;
}

async function githubJson(path, token) {
  const response = await fetch(`${process.env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error("GitHub deployment lookup failed.");
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("GitHub deployment lookup failed.");
  return payload;
}

async function main() {
  const sha = process.env.DEPLOYMENT_SHA || "";
  const repository = process.env.GITHUB_REPOSITORY || "";
  const token = process.env.GH_TOKEN || "";
  const previewHostnameSuffix = process.env.VERCEL_PREVIEW_HOST_SUFFIX || "";
  if (!/^[0-9a-f]{40}$/.test(sha) || !repository || !token || !previewHostnameSuffix) {
    throw new Error("Invalid resolver configuration.");
  }

  const query = new URLSearchParams({
    sha,
    environment: PREVIEW_ENVIRONMENT,
    per_page: "100",
  });
  const deployments = await githubJson(`/repos/${repository}/deployments?${query}`, token);
  const resolved = await resolveFunctionalQaPreviewDeployment({
    deployments,
    previewHostnameSuffix,
    loadStatuses: (deploymentId) =>
      githubJson(`/repos/${repository}/deployments/${encodeURIComponent(deploymentId)}/statuses?per_page=100`, token),
  });

  if (!resolved) throw new Error("No valid Preview deployment.");
  process.stdout.write(resolved.target);
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  main().catch(() => {
    process.stderr.write(`${RESOLUTION_FAILURE_MESSAGE}\n`);
    process.exitCode = 1;
  });
}
