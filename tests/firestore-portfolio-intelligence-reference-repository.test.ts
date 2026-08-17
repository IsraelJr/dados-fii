import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { PortfolioIntelligenceInput } from "../src/lib/portfolio-intelligence/PortfolioIntelligence";
import { PortfolioIntelligenceService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceService";
import { PortfolioHistoryService } from "../src/lib/portfolio/PortfolioHistoryService";
import { portfolioHistoryAnnualDocumentId } from "../src/lib/portfolio/PortfolioHistoryRepository";
import { FirestorePortfolioHistoryRepositoryCore } from "../src/server/repositories/FirestorePortfolioHistoryRepositoryCore";
import {
  FirestorePortfolioIntelligenceReferenceRepositoryCore,
  portfolioIntelligenceReferenceDocumentId,
} from "../src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore";
import { FirestorePortfolioIntelligenceSourceRepositoryCore } from "../src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore";
import { PortfolioIntelligenceReferenceFactory } from "../src/server/services/PortfolioIntelligenceReferenceFactory";
import {
  resolveEmailSessionWithDependencies,
  verifiedWalletSessionDocumentId,
  VerifiedWalletIdentityCoreError,
} from "../src/server/auth/VerifiedWalletIdentityCore";
import { firestoreVerifiedWalletIdentityDependencies } from "../src/server/auth/FirestoreVerifiedWalletIdentity";

const EMULATOR_AVAILABLE = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const COLLECTION = "UserPortfolioIntelligenceReference";
const AS_OF = "2026-08-10T15:00:00.000Z";

function canonicalInput(multiplier = 1): PortfolioIntelligenceInput {
  return Object.freeze({
    snapshots: Object.freeze([
      Object.freeze({ competence: "2026-01", dividends: 47 * multiplier }),
      Object.freeze({ competence: "2026-02", dividends: 450.03 * multiplier }),
      Object.freeze({ competence: "2026-03", dividends: 87.06 * multiplier }),
      Object.freeze({ competence: "2026-04", dividends: 40 * multiplier }),
      Object.freeze({ competence: "2026-05", dividends: 50 * multiplier }),
      Object.freeze({ competence: "2026-06", dividends: 60 * multiplier }),
    ]),
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10 * multiplier, estimatedIncome: 8, segment: "Tijolo" }),
      Object.freeze({ ticker: "BBBB11", quantity: 5, price: 20, estimatedIncome: 2, segment: "Papel" }),
    ]),
  });
}

function reference(asOf: string, multiplier = 1) {
  const input = canonicalInput(multiplier);
  const result = new PortfolioIntelligenceService().analyze(input, {
    asOf,
    generatedAt: asOf,
  });
  return new PortfolioIntelligenceReferenceFactory().create(result, input);
}

test("Firestore mantém fonte canônica e par incremental monotônico e isolado", {
  skip: !EMULATOR_AVAILABLE,
  timeout: 90_000,
}, async (context) => {
  const app = initializeApp(
    { projectId: "demo-dados-fii" },
    `portfolio-intelligence-${process.pid}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const historyRepository = new FirestorePortfolioHistoryRepositoryCore({
    db,
    fieldValue: FieldValue,
    diagnose: () => undefined,
  });
  const historyService = new PortfolioHistoryService(
    historyRepository,
    () => new Date(AS_OF),
  );
  const sourceRepository = new FirestorePortfolioIntelligenceSourceRepositoryCore({
    db,
    history: historyRepository,
  });
  const references = new FirestorePortfolioIntelligenceReferenceRepositoryCore({
    db,
    fieldValue: FieldValue,
  });
  const owners = new Set<string>();
  const sessionDocuments = new Set<string>();

  function owner(label: string) {
    const value = `pv4-${process.pid}-${label}`;
    owners.add(value);
    return value;
  }

  function referenceDocument(ownerId: string) {
    return db.collection(COLLECTION).doc(
      portfolioIntelligenceReferenceDocumentId(ownerId, "default"),
    );
  }

  try {
    await context.test("WalletSnapshots é consolidado e PortfolioHistory tem precedência", async () => {
      const ownerId = owner("source");
      const user = db.collection("User").doc(ownerId);
      await user.set({
        email: "sentinel-private@example.invalid",
        wallet: [
          { ticker: "BBBB11", quotas: 5 },
          { ticker: "AAAA11", quotas: 10 },
        ],
      });
      await Promise.all([
        user.collection("WalletSnapshots").doc("2026-01").set({
          monthKey: "2026-01",
          totalValue: 1_000,
          estimatedDividendIncome: 10,
        }),
        user.collection("WalletSnapshots").doc("2026-02").set({
          monthKey: "2026-02",
          totalValue: 1_100,
          estimatedMonthlyIncome: 20,
        }),
        user.collection("WalletSnapshots").doc("invalid").set({
          monthKey: "2026-13",
          totalValue: 1_200,
          estimatedDividendIncome: 30,
        }),
      ]);
      await historyService.createManual({ ownerId }, {
        portfolioId: "default",
        year: 2026,
        month: 2,
        dividends: 450.03,
      });
      await historyService.createManual({ ownerId }, {
        portfolioId: "default",
        year: 2026,
        month: 3,
        dividends: 87.06,
      });

      const source = await sourceRepository.load({ ownerId, portfolioId: "default" });

      assert.deepEqual(source.wallet, [
        { ticker: "AAAA11", quantity: 10 },
        { ticker: "BBBB11", quantity: 5 },
      ]);
      assert.deepEqual(source.snapshots, [
        { competence: "2026-01", dividends: 10 },
        { competence: "2026-02", dividends: 450.03 },
        { competence: "2026-03", dividends: 87.06 },
      ]);
      await assert.rejects(
        sourceRepository.load({ ownerId, portfolioId: "other" }),
        /PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED/,
      );
    });

    await context.test("fonte limita aos 120 meses mais recentes e preserva renda zero", async () => {
      const ownerId = owner("source-window");
      const user = db.collection("User").doc(ownerId);
      await user.set({ wallet: [] });
      const competences = Array.from({ length: 122 }, (_, index) => {
        const ordinal = (2016 * 12) + index;
        const year = Math.floor(ordinal / 12);
        const month = ordinal % 12 + 1;
        return `${year}-${String(month).padStart(2, "0")}`;
      });
      await Promise.all(competences.map((competence, index) => (
        user.collection("WalletSnapshots").doc(competence).set({
          monthKey: competence,
          totalValue: index === competences.length - 1 ? 0 : 1_000,
          estimatedDividendIncome: index === competences.length - 1 ? 0 : index + 1,
        })
      )));

      const source = await sourceRepository.load({ ownerId, portfolioId: "default" });
      assert.equal(source.snapshots.length, 120);
      assert.equal(source.snapshots[0]?.competence, competences[2]);
      assert.equal(source.snapshots.at(-1)?.competence, competences.at(-1));
      assert.equal(source.snapshots.at(-1)?.dividends, 0);
      assert.equal(source.snapshots.some((item) => item.competence === competences[0]), false);
      assert.equal(source.snapshots.some((item) => item.competence === competences[1]), false);
    });

    await context.test("WalletSessions e User reais resolvem auth válida e isolam owner no Emulator", async () => {
      const ownerA = owner("auth-a");
      const ownerB = owner("auth-b");
      const emailA = "pv4-auth-a@example.invalid";
      const emailB = "pv4-auth-b@example.invalid";
      const validTokenA = "synthetic-valid-a";
      const validTokenB = "synthetic-valid-b";
      const expiredToken = "synthetic-expired";
      const mismatchedToken = "synthetic-mismatched";
      await Promise.all([
        db.collection("User").doc(ownerA).set({ email: emailA, wallet: [{ ticker: "AAAA11", quotas: 1 }] }),
        db.collection("User").doc(ownerB).set({ email: emailB, wallet: [{ ticker: "BBBB11", quotas: 2 }] }),
      ]);

      async function createSession(email: string, token: string, data: Record<string, unknown>) {
        const documentId = verifiedWalletSessionDocumentId(email, token);
        sessionDocuments.add(documentId);
        await db.collection("WalletSessions").doc(documentId).set(data);
      }
      await Promise.all([
        createSession(emailA, validTokenA, { email: emailA, expiresAt: "2026-08-10T16:00:00.000Z" }),
        createSession(emailB, validTokenB, { email: emailB, expiresAt: "2026-08-10T16:00:00.000Z" }),
        createSession(emailA, expiredToken, { email: emailA, expiresAt: "2026-08-10T14:00:00.000Z" }),
        createSession(emailA, mismatchedToken, { email: emailB, expiresAt: "2026-08-10T16:00:00.000Z" }),
      ]);
      const dependencies = firestoreVerifiedWalletIdentityDependencies(
        db,
        () => Date.parse("2026-08-10T15:00:00.000Z"),
      );
      const authRequest = (email: string, token: string) => new Request(
        "https://preview.example.test/api/portfolio/incremental-analysis",
        { headers: { "x-wallet-email": email, "x-wallet-session": token } },
      );
      const identityA = await resolveEmailSessionWithDependencies(
        authRequest(emailA, validTokenA),
        dependencies,
      );
      const identityB = await resolveEmailSessionWithDependencies(
        authRequest(emailB, validTokenB),
        dependencies,
      );
      assert.equal(identityA?.ownerId, ownerA);
      assert.equal(identityB?.ownerId, ownerB);
      assert.notEqual(identityA?.ownerId, identityB?.ownerId);
      assert.deepEqual(
        (await sourceRepository.load({ ownerId: identityA!.ownerId, portfolioId: "default" })).wallet,
        [{ ticker: "AAAA11", quantity: 1 }],
      );
      assert.deepEqual(
        (await sourceRepository.load({ ownerId: identityB!.ownerId, portfolioId: "default" })).wallet,
        [{ ticker: "BBBB11", quantity: 2 }],
      );

      for (const operation of [
        () => resolveEmailSessionWithDependencies(authRequest(emailA, "synthetic-missing"), dependencies),
        () => resolveEmailSessionWithDependencies(authRequest(emailA, expiredToken), dependencies),
        () => resolveEmailSessionWithDependencies(authRequest(emailA, mismatchedToken), dependencies),
      ]) {
        await assert.rejects(operation, (error: unknown) => (
          error instanceof VerifiedWalletIdentityCoreError
          && error.status === 401
          && error.code === "WALLET_SESSION_REQUIRED"
        ));
      }
    });

    await context.test("primeira gravação cria current sem PII nem carteira bruta", async () => {
      const ownerId = owner("privacy");
      const current = reference("2026-08-01T12:00:00.000Z");
      const stored = await references.compareAndStore({ ownerId, portfolioId: "default", current });
      const raw = (await referenceDocument(ownerId).get()).data() || {};
      const serialized = JSON.stringify(raw);

      assert.equal(stored.previous, null);
      assert.equal(stored.stored, true);
      assert.equal(raw.ownerId, undefined);
      assert.match(String(raw.ownerHash), /^[a-f0-9]{64}$/);
      assert.equal(serialized.includes(ownerId), false);
      assert.equal(serialized.includes("@"), false);
      assert.equal(serialized.includes("positions"), false);
      assert.equal(serialized.includes("snapshots"), false);
      assert.equal(serialized.includes("quantity"), false);
    });

    await context.test("baseline corrompida do mesmo owner é substituída atomicamente sem reutilizar dados", async () => {
      for (const [label, corrupt] of [
        ["schema", { schemaVersion: 1, current: { legacy: true } }],
        ["fingerprint", {
          schemaVersion: 2,
          current: { ...reference("2026-08-01T12:00:00.000Z"), fingerprint: "0".repeat(64) },
        }],
      ] as const) {
        const ownerId = owner(`recover-${label}`);
        const document = referenceDocument(ownerId);
        const expectedOwnerHash = createHash("sha256")
          .update(`portfolio-intelligence-owner:${ownerId}`, "utf8")
          .digest("hex");
        await document.set({
          ownerHash: expectedOwnerHash,
          portfolioId: "default",
          previous: null,
          ...corrupt,
        });
        const next = reference("2026-08-02T12:00:00.000Z", 1.1);
        const recovered = await references.compareAndStore({
          ownerId,
          portfolioId: "default",
          current: next,
        });
        const stored = (await document.get()).data() || {};
        assert.equal(recovered.baselineState, "invalid");
        assert.equal(recovered.previous, null);
        assert.equal(recovered.current.fingerprint, next.fingerprint);
        assert.equal(stored.schemaVersion, 2);
        assert.equal(stored.previous, null);
        assert.equal(stored.current.fingerprint, next.fingerprint);
        assert.equal(JSON.stringify(stored).includes("legacy"), false);
      }
    });

    await context.test("avanço rotaciona current para previous e replay preserva o par", async () => {
      const ownerId = owner("monotonic");
      const first = reference("2026-08-01T12:00:00.000Z", 1);
      const second = reference("2026-08-02T12:00:00.000Z", 1.1);
      await references.compareAndStore({ ownerId, portfolioId: "default", current: first });
      const advanced = await references.compareAndStore({ ownerId, portfolioId: "default", current: second });
      assert.equal(advanced.previous?.fingerprint, first.fingerprint);
      assert.equal(advanced.stored, true);

      const beforeReplay = (await referenceDocument(ownerId).get()).data() || {};
      const replay = await references.compareAndStore({ ownerId, portfolioId: "default", current: second });
      const afterReplay = (await referenceDocument(ownerId).get()).data() || {};
      assert.equal(replay.stored, false);
      assert.equal(replay.previous?.fingerprint, first.fingerprint);
      assert.deepEqual(afterReplay.previous, beforeReplay.previous);
      assert.deepEqual(afterReplay.current, beforeReplay.current);
      assert.equal(afterReplay.updatedAt.toMillis(), beforeReplay.updatedAt.toMillis());

      const pair = await references.readPair({ ownerId, portfolioId: "default" });
      assert.equal(pair?.previous?.fingerprint, first.fingerprint);
      assert.equal(pair?.current.fingerprint, second.fingerprint);
    });

    await context.test("mesmo conteúdo com asOf maior avança para comparação inalterada", async () => {
      const ownerId = owner("same-content-later");
      const first = reference("2026-08-01T12:00:00.000Z", 1);
      const later = reference("2026-08-02T12:00:00.000Z", 1);
      assert.equal(first.fingerprint, later.fingerprint);

      await references.compareAndStore({ ownerId, portfolioId: "default", current: first });
      const advanced = await references.compareAndStore({ ownerId, portfolioId: "default", current: later });
      const pair = await references.readPair({ ownerId, portfolioId: "default" });

      assert.equal(advanced.stored, true);
      assert.equal(advanced.previous?.asOf, first.asOf);
      assert.equal(advanced.current.asOf, later.asOf);
      assert.equal(pair?.previous?.asOf, first.asOf);
      assert.equal(pair?.current.asOf, later.asOf);
      assert.equal(pair?.previous?.fingerprint, pair?.current.fingerprint);
    });

    await context.test("stale e conflito no mesmo asOf falham fechado sem mutar", async () => {
      const ownerId = owner("reject");
      const current = reference("2026-08-03T12:00:00.000Z", 1.1);
      await references.compareAndStore({ ownerId, portfolioId: "default", current });
      const before = (await referenceDocument(ownerId).get()).data() || {};

      await assert.rejects(
        references.compareAndStore({
          ownerId,
          portfolioId: "default",
          current: reference("2026-08-02T12:00:00.000Z", 1.2),
        }),
        /PORTFOLIO_INCREMENTAL_REFERENCE_STALE/,
      );
      await assert.rejects(
        references.compareAndStore({
          ownerId,
          portfolioId: "default",
          current: reference("2026-08-03T12:00:00.000Z", 1.3),
        }),
        /PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT/,
      );
      const after = (await referenceDocument(ownerId).get()).data() || {};
      assert.deepEqual(after.previous, before.previous);
      assert.deepEqual(after.current, before.current);
      assert.equal(after.updatedAt.toMillis(), before.updatedAt.toMillis());
    });

    await context.test("entrada adulterada falha fechado antes da transação e preserva o par válido", async () => {
      const ownerId = owner("invalid-incoming");
      const valid = reference("2026-08-03T12:00:00.000Z", 1.1);
      await references.compareAndStore({ ownerId, portfolioId: "default", current: valid });
      const before = (await referenceDocument(ownerId).get()).data() || {};

      const invalidReferences = [
        { ...reference("2026-08-04T12:00:00.000Z", 1.2), fingerprint: "0".repeat(64) },
        {
          ...reference("2026-08-04T12:00:00.000Z", 1.2),
          metrics: {
            ...reference("2026-08-04T12:00:00.000Z", 1.2).metrics,
            latestIncome: Number.NaN,
          },
        },
      ];

      for (const current of invalidReferences) {
        await assert.rejects(
          references.compareAndStore({
            ownerId,
            portfolioId: "default",
            current: current as typeof valid,
          }),
          /PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED/,
        );
      }

      const after = (await referenceDocument(ownerId).get()).data() || {};
      assert.deepEqual(after.previous, before.previous);
      assert.deepEqual(after.current, before.current);
      assert.equal(after.createdAt.toMillis(), before.createdAt.toMillis());
      assert.equal(after.updatedAt.toMillis(), before.updatedAt.toMillis());
    });

    await context.test("concorrência mantém o maior asOf e conflito simultâneo não mistura referências", async () => {
      const monotonicOwner = owner("concurrent-monotonic");
      await references.compareAndStore({
        ownerId: monotonicOwner,
        portfolioId: "default",
        current: reference("2026-08-01T12:00:00.000Z", 1),
      });
      const middle = reference("2026-08-02T12:00:00.000Z", 1.1);
      const latest = reference("2026-08-03T12:00:00.000Z", 1.2);
      await Promise.allSettled([
        references.compareAndStore({ ownerId: monotonicOwner, portfolioId: "default", current: latest }),
        references.compareAndStore({ ownerId: monotonicOwner, portfolioId: "default", current: middle }),
      ]);
      const pair = await references.readPair({ ownerId: monotonicOwner, portfolioId: "default" });
      assert.equal(pair?.current.fingerprint, latest.fingerprint);
      assert.ok(pair?.previous);
      assert.ok(Date.parse(pair!.previous!.asOf) < Date.parse(pair!.current.asOf));

      const conflictOwner = owner("concurrent-conflict");
      const left = reference("2026-08-04T12:00:00.000Z", 1.3);
      const right = reference("2026-08-04T12:00:00.000Z", 1.4);
      const outcomes = await Promise.allSettled([
        references.compareAndStore({ ownerId: conflictOwner, portfolioId: "default", current: left }),
        references.compareAndStore({ ownerId: conflictOwner, portfolioId: "default", current: right }),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
      const conflictPair = await references.readPair({ ownerId: conflictOwner, portfolioId: "default" });
      assert.equal([left.fingerprint, right.fingerprint].includes(conflictPair!.current.fingerprint), true);
      assert.equal(conflictPair?.previous, null);
    });

    await context.test("isolamento e portfolioId default são impostos antes do acesso", async () => {
      const ownerId = owner("isolation-a");
      const otherOwner = owner("isolation-b");
      await references.compareAndStore({
        ownerId,
        portfolioId: "default",
        current: reference("2026-08-05T12:00:00.000Z"),
      });
      assert.equal(await references.readPair({ ownerId: otherOwner, portfolioId: "default" }), null);
      await assert.rejects(
        references.compareAndStore({
          ownerId,
          portfolioId: "retirement",
          current: reference("2026-08-06T12:00:00.000Z"),
        }),
        /PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED/,
      );
      assert.equal((await references.readPair({ ownerId, portfolioId: "default" }))?.current.asOf, "2026-08-05T12:00:00.000Z");
    });
  } finally {
    for (const ownerId of owners) {
      const user = db.collection("User").doc(ownerId);
      const snapshots = await user.collection("WalletSnapshots").get();
      await Promise.all(snapshots.docs.map((document) => document.ref.delete()));
      await user.delete();
      await referenceDocument(ownerId).delete();
      for (const year of [2025, 2026]) {
        await db.collection("UserPortfolioHistory").doc(portfolioHistoryAnnualDocumentId({
          ownerId,
          portfolioId: "default",
          competence: `${year}-01`,
        })).delete();
      }
    }
    await Promise.all([...sessionDocuments].map((documentId) => (
      db.collection("WalletSessions").doc(documentId).delete()
    )));
    await deleteApp(app);
  }
});
