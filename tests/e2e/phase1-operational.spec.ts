import { expect, test } from "@playwright/test";

const LIVE_ENABLED = process.env.E2E_RUN_LIVE_INGESTION === "true";
const ADMIN_SECRET = process.env.E2E_ADMIN_UPDATE_SECRET || "";
const sameOriginHeaders = { "Sec-Fetch-Site": "same-origin" };

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test.describe("Fase 1 - smoke operacional controlado", () => {
  test.skip(!LIVE_ENABLED || !ADMIN_SECRET, "Smoke operacional exige E2E_RUN_LIVE_INGESTION=true e segredo administrativo.");

  test("valida sessão, lock, heartbeat, QA e pré-publicação sem escrita oficial", async ({ request }) => {
    test.setTimeout(15 * 60 * 1000);

    const login = await request.post("/api/admin/session", {
      headers: sameOriginHeaders,
      data: { token: ADMIN_SECRET },
    });
    expect(login.status()).toBe(200);

    const payload = {
      ticker: "MXRF11",
      year: new Date().getFullYear(),
      delayMinutes: 0,
      enableAi: false,
    };

    const start = await request.post("/api/admin/fii-ingestion/start", {
      headers: sameOriginHeaders,
      data: payload,
    });
    expect([200, 202]).toContain(start.status());
    const started = await start.json();
    expect(started.runId).toBeTruthy();
    expect(started.publishToOfficialBase).toBe(false);
    const runId = String(started.runId);

    const concurrent = await request.post("/api/admin/fii-ingestion/start", {
      headers: sameOriginHeaders,
      data: payload,
    });
    expect(concurrent.status()).toBe(409);
    expect((await concurrent.json()).runId).toBe(runId);

    const observedSteps = new Set<string>();
    const observedHeartbeats = new Set<string>();
    let finalRun: Record<string, any> | null = null;
    let finalLock: Record<string, any> | null = null;

    for (let attempt = 0; attempt < 90; attempt += 1) {
      const statusResponse = await request.get(`/api/admin/fii-ingestion/status?runId=${encodeURIComponent(runId)}`);
      expect(statusResponse.status()).toBe(200);
      const status = await statusResponse.json();
      finalRun = status.run || null;
      finalLock = status.activeLock || null;
      if (finalRun?.currentStep) observedSteps.add(String(finalRun.currentStep));
      if (finalLock?.heartbeatAt) observedHeartbeats.add(String(finalLock.heartbeatAt));
      if (["completed", "failed"].includes(String(finalRun?.status))) break;
      await sleep(8_000);
    }

    expect(finalRun?.status).toBe("completed");
    expect(finalRun?.currentStep).toBe("completed");
    expect(finalRun?.publishToOfficialBase).toBe(false);
    expect(observedSteps.size).toBeGreaterThan(0);
    expect(observedHeartbeats.size).toBeGreaterThan(0);

    const completedStatus = await request.get(`/api/admin/fii-ingestion/status?runId=${encodeURIComponent(runId)}`);
    const completedBody = await completedStatus.json();
    expect(completedBody.activeLock).toBeNull();

    const qa = await request.get(`/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`);
    expect(qa.status()).toBe(200);
    const qaBody = await qa.json();
    expect(qaBody.report?.verdict).toBe("approved_for_human_review");
    expect(qaBody.report?.score).toBe(100);
    expect(qaBody.report?.canPublishToOfficialBase).toBe(false);

    const prePublication = await request.get(`/api/admin/fii-ingestion/pre-publication?runId=${encodeURIComponent(runId)}&persist=0`);
    expect(prePublication.status()).toBe(200);
    const prePublicationBody = await prePublication.json();
    expect(prePublicationBody.persisted).toBe(false);
    expect(prePublicationBody.reviewPackage?.canPublishToOfficialBase).toBe(false);
    expect(prePublicationBody.reviewPackage?.safeguards?.officialWritePerformed).toBe(false);

    const blockedPublication = await request.post("/api/admin/fii-ingestion/publication", {
      headers: sameOriginHeaders,
      data: { runId, proposalHash: "not-authorized", confirmationText: "NOT AUTHORIZED" },
    });
    expect(blockedPublication.status()).toBe(423);
  });
});
