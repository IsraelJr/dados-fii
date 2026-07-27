import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

const ISSUER = "https://token.actions.githubusercontent.com";
const DEFAULT_AUDIENCE = "dados-fii-production-smoke";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

export type GithubActionsIdentity = {
  repository: "IsraelJr/dados-fii";
  ref: "refs/heads/main";
  sha: string;
  workflowRef: string;
  runId: string;
  runAttempt: string;
  actorId: string;
};

function requiredClaim(payload: JWTPayload, name: string) {
  const value = payload[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Claim OIDC ausente: ${name}.`);
  return value;
}

export function validateGithubActionsClaims(
  payload: JWTPayload,
  deployedSha: string,
  allowedWorkflowFiles: string[] = ["production-premium-smoke.yml"],
): GithubActionsIdentity {
  const repository = requiredClaim(payload, "repository");
  const ref = requiredClaim(payload, "ref");
  const sha = requiredClaim(payload, "sha");
  const workflowRef = requiredClaim(payload, "workflow_ref");
  const runId = requiredClaim(payload, "run_id");
  const runAttempt = requiredClaim(payload, "run_attempt");
  const actorId = requiredClaim(payload, "actor_id");
  if (repository !== "IsraelJr/dados-fii") throw new Error("Repositório OIDC não autorizado.");
  if (ref !== "refs/heads/main") throw new Error("Somente a branch main pode validar Produção.");
  const workflowAllowed = allowedWorkflowFiles.some((file) =>
    workflowRef.endsWith(`/.github/workflows/${file}@refs/heads/main`));
  if (!workflowAllowed) {
    throw new Error("Workflow OIDC não autorizado.");
  }
  if (!/^[a-f0-9]{40}$/.test(sha) || sha !== deployedSha) {
    throw new Error("SHA OIDC não corresponde ao deployment ativo.");
  }
  return {
    repository,
    ref,
    sha,
    workflowRef,
    runId,
    runAttempt,
    actorId,
  };
}

function bearer(request: NextRequest) {
  return (request.headers.get("authorization") || "").match(/^Bearer ([^\s]+)$/)?.[1] || "";
}

export async function requireGithubActionsProductionIdentity(
  request: NextRequest,
  options: {
    audience?: string;
    allowedWorkflowFiles?: string[];
  } = {},
) {
  const token = bearer(request);
  if (!token) throw new Error("Token OIDC ausente.");
  const deployedSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "");
  if (process.env.VERCEL_ENV !== "production" || !/^[a-f0-9]{40}$/.test(deployedSha)) {
    throw new Error("Gate OIDC disponível somente no deployment de Produção.");
  }
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: options.audience || DEFAULT_AUDIENCE,
    algorithms: ["RS256"],
    maxTokenAge: "5m",
    clockTolerance: 10,
  });
  return validateGithubActionsClaims(payload, deployedSha, options.allowedWorkflowFiles);
}
