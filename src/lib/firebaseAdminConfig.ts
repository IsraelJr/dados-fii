export type FirebaseAdminBootstrapConfig =
  | {
    mode: "service-account";
    serviceAccount: Record<string, unknown>;
  }
  | {
    mode: "build-only";
    projectId: string;
  };

function parseServiceAccount(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY contém JSON inválido.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY deve conter um objeto JSON.");
  }

  return parsed as Record<string, unknown>;
}

export function resolveFirebaseAdminBootstrapConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FirebaseAdminBootstrapConfig {
  const rawServiceAccount = environment.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (rawServiceAccount) {
    return {
      mode: "service-account",
      serviceAccount: parseServiceAccount(rawServiceAccount),
    };
  }

  if (environment.ALLOW_FIREBASE_ADMIN_BUILD_WITHOUT_CREDENTIALS === "true") {
    return {
      mode: "build-only",
      projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "dados-fii-build",
    };
  }

  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_KEY ausente. O modo sem credenciais é permitido apenas no build automatizado explicitamente autorizado.",
  );
}
