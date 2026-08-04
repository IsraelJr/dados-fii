import assert from "node:assert/strict";
import test from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createManualPortfolioHistoryEntry } from "../src/lib/portfolio/PortfolioHistory";
import { PortfolioHistoryService } from "../src/lib/portfolio/PortfolioHistoryService";
import { portfolioHistoryAnnualDocumentId } from "../src/lib/portfolio/PortfolioHistoryRepository";
import {
  FirestorePortfolioHistoryRepositoryCore,
  type PortfolioHistoryStorageDiagnostic,
} from "../src/server/repositories/FirestorePortfolioHistoryRepositoryCore";

const EMULATOR_AVAILABLE = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const NOW = new Date("2026-07-27T12:00:00.000Z");
const COLLECTION = "UserPortfolioHistory";
const PORTFOLIO = "default";

function storedMonth(dividends: number, source: "manual" | "automatic_snapshot" | "legacy" = "manual") {
  return {
    dividends,
    source,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
  };
}

test("Firestore anual usa mapa canônico, migra legado lazy e mantém cleanup idempotente", {
  skip: !EMULATOR_AVAILABLE,
  timeout: 60_000,
}, async (context) => {
  const app = initializeApp(
    { projectId: "demo-dados-fii" },
    `portfolio-history-${process.pid}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const diagnostics: PortfolioHistoryStorageDiagnostic[] = [];
  const repository = new FirestorePortfolioHistoryRepositoryCore({
    db,
    fieldValue: FieldValue,
    diagnose: (diagnostic) => diagnostics.push(diagnostic),
  });
  const service = new PortfolioHistoryService(repository, () => NOW);
  const owners = new Set<string>();

  function owner(label: string) {
    const value = `history-hotfix-${process.pid}-${label}`;
    owners.add(value);
    return value;
  }

  function annualReference(ownerId: string, year: number) {
    return db.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId({
      ownerId,
      portfolioId: PORTFOLIO,
      competence: `${year}-01`,
    }));
  }

  async function seedAnnual(
    ownerId: string,
    year: number,
    data: FirebaseFirestore.DocumentData,
  ) {
    await annualReference(ownerId, year).set({
      ownerId,
      portfolioId: PORTFOLIO,
      year,
      schemaVersion: 2,
      ...data,
    });
  }

  async function rawAnnual(ownerId: string, year: number) {
    return (await annualReference(ownerId, year).get()).data() || {};
  }

  try {
    await context.test("aceita meses 01 a 12 sem criar campos literais", async () => {
      const ownerId = owner("all-months");
      for (let month = 1; month <= 12; month += 1) {
        await service.createManual({ ownerId }, {
          portfolioId: PORTFOLIO,
          year: 2025,
          month,
          dividends: month,
        });
      }

      const entries = await service.list({ ownerId }, PORTFOLIO);
      assert.equal(entries.length, 12);
      assert.deepEqual(entries.map((entry) => entry.competence), Array.from(
        { length: 12 },
        (_, index) => `2025-${String(index + 1).padStart(2, "0")}`,
      ));
      const raw = await rawAnnual(ownerId, 2025);
      assert.deepEqual(Object.keys(raw.months).sort(), Array.from(
        { length: 12 },
        (_, index) => String(index + 1).padStart(2, "0"),
      ));
      assert.equal(Object.keys(raw).some((field) => /^months\./.test(field)), false);
    });

    await context.test("preserva meses, campos auxiliares e gravações concorrentes", async () => {
      const ownerId = owner("concurrent");
      await seedAnnual(ownerId, 2025, { auditMarker: "preserve", months: {} });
      await Promise.all([
        service.createManual({ ownerId }, { portfolioId: PORTFOLIO, year: 2025, month: 5, dividends: 50 }),
        service.createManual({ ownerId }, { portfolioId: PORTFOLIO, year: 2025, month: 6, dividends: 60 }),
      ]);

      const raw = await rawAnnual(ownerId, 2025);
      assert.equal(raw.auditMarker, "preserve");
      assert.equal(raw.months["05"].dividends, 50);
      assert.equal(raw.months["06"].dividends, 60);
    });

    await context.test("virada de ano usa documentos anuais independentes", async () => {
      const ownerId = owner("year-boundary");
      await service.createManual({ ownerId }, { portfolioId: PORTFOLIO, year: 2025, month: 12, dividends: 12 });
      await service.createManual({ ownerId }, { portfolioId: PORTFOLIO, year: 2026, month: 1, dividends: 1 });
      assert.deepEqual(
        (await service.list({ ownerId }, PORTFOLIO)).map((entry) => entry.competence),
        ["2025-12", "2026-01"],
      );
      assert.equal((await annualReference(ownerId, 2025).get()).exists, true);
      assert.equal((await annualReference(ownerId, 2026).get()).exists, true);
    });

    await context.test("POST repetido é determinístico e não duplica", async () => {
      const ownerId = owner("duplicate");
      const input = { portfolioId: PORTFOLIO, year: 2026, month: 2, dividends: 450.03 } as const;
      await service.createManual({ ownerId }, input);
      await assert.rejects(service.createManual({ ownerId }, input), /HISTORY_ENTRY_ALREADY_EXISTS/);
      assert.equal((await service.list({ ownerId }, PORTFOLIO)).length, 1);
    });

    await context.test("migra campo literal legado para o mapa canônico na leitura", async () => {
      const ownerId = owner("legacy-only");
      await seedAnnual(ownerId, 2026, { "months.02": storedMonth(450.03) });

      const listed = await service.list({ ownerId }, PORTFOLIO);
      assert.equal(listed.length, 1);
      assert.equal(listed[0].competence, "2026-02");
      assert.equal(listed[0].dividends, 450.03);
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(raw.months["02"].dividends, 450.03);
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months.02"), false);
    });

    await context.test("remove legado idêntico e preserva o canônico", async () => {
      const ownerId = owner("legacy-identical");
      const february = storedMonth(450.03);
      await seedAnnual(ownerId, 2026, { months: { "02": february }, "months.02": february });

      assert.equal((await repository.findByCompetence({
        ownerId,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      }))?.dividends, 450.03);
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(raw.months["02"].dividends, 450.03);
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months.02"), false);
    });

    await context.test("migração preserva origem legado e mantém registro imutável", async () => {
      const ownerId = owner("legacy-source");
      await seedAnnual(ownerId, 2026, { "months.02": storedMonth(450.03, "legacy") });
      const key = { ownerId, portfolioId: PORTFOLIO, competence: "2026-02" as const };

      const found = await repository.findByCompetence(key);
      assert.equal(found?.source, "legacy");
      await assert.rejects(repository.deleteManual(key), /Somente registros manuais/);
      assert.equal((await rawAnnual(ownerId, 2026)).months["02"].source, "legacy");
    });

    await context.test("conflito usa canônico e preserva legado com diagnóstico sem conteúdo", async () => {
      const ownerId = owner("legacy-conflict");
      await seedAnnual(ownerId, 2026, {
        months: { "02": storedMonth(100) },
        "months.02": storedMonth(451),
      });

      const before = diagnostics.length;
      const found = await repository.findByCompetence({
        ownerId,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      });
      assert.equal(found?.dividends, 100);
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(raw.months["02"].dividends, 100);
      assert.equal(raw["months.02"].dividends, 451);
      assert.deepEqual(diagnostics.slice(before), [{
        code: "PORTFOLIO_HISTORY_LEGACY_CONFLICT",
        year: 2026,
        month: "02",
      }]);
      const diagnosticText = JSON.stringify(diagnostics.at(-1));
      assert.equal(diagnosticText.includes(ownerId), false);
      assert.equal(diagnosticText.includes("451"), false);
    });

    await context.test("entrada persistida inválida falha fechado sem sobrescrever o legado", async () => {
      const ownerId = owner("invalid-legacy");
      await seedAnnual(ownerId, 2026, {
        "months.02": { ...storedMonth(450.03), dividends: "invalid" },
      });

      assert.deepEqual(await service.list({ ownerId }, PORTFOLIO), []);
      await assert.rejects(
        service.createManual({ ownerId }, {
          portfolioId: PORTFOLIO,
          year: 2026,
          month: 2,
          dividends: 450.03,
        }),
        /HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION/,
      );
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months.02"), true);
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months"), false);
    });

    await context.test("atualização migra legado válido e preserva origem e outros meses", async () => {
      const ownerId = owner("legacy-update");
      await seedAnnual(ownerId, 2026, {
        months: { "01": storedMonth(47) },
        "months.02": storedMonth(450.03),
      });
      const key = {
        ownerId,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      } as const;
      const replacement = createManualPortfolioHistoryEntry({
        portfolioId: PORTFOLIO,
        year: 2026,
        month: 2,
        dividends: 500,
      }, NOW);

      await repository.updateManual(key, replacement);
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(raw.months["01"].dividends, 47);
      assert.equal(raw.months["02"].dividends, 500);
      assert.equal(raw.months["02"].source, "manual");
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months.02"), false);
    });

    await context.test("DELETE remove canônico e literal exatos, preserva outros meses e é idempotente", async () => {
      const ownerId = owner("delete-both");
      await seedAnnual(ownerId, 2026, {
        months: { "01": storedMonth(47), "02": storedMonth(450.03), "03": storedMonth(87.06) },
        "months.02": storedMonth(451),
        auditMarker: "preserve",
      });
      const key = { ownerId, portfolioId: PORTFOLIO, competence: "2026-02" as const };

      await repository.deleteManual(key);
      await repository.deleteManual(key);
      const raw = await rawAnnual(ownerId, 2026);
      assert.equal(raw.auditMarker, "preserve");
      assert.equal(Object.prototype.hasOwnProperty.call(raw.months, "02"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(raw, "months.02"), false);
      assert.deepEqual(Object.keys(raw.months).sort(), ["01", "03"]);
      assert.equal(await repository.findByCompetence(key), null);
    });

    await context.test("cleanup recupera falha parcial com somente um dos formatos", async () => {
      const canonicalOwner = owner("partial-canonical");
      const legacyOwner = owner("partial-legacy");
      await seedAnnual(canonicalOwner, 2026, { months: { "02": storedMonth(450.03) } });
      await seedAnnual(legacyOwner, 2026, { "months.02": storedMonth(450.03) });

      for (const ownerId of [canonicalOwner, legacyOwner]) {
        const key = { ownerId, portfolioId: PORTFOLIO, competence: "2026-02" as const };
        await repository.deleteManual(key);
        await repository.deleteManual(key);
        assert.equal(await repository.findByCompetence(key), null);
      }
    });

    await context.test("não exclui snapshot automático nem histórico de outro usuário", async () => {
      const snapshotOwner = owner("immutable");
      const otherOwner = owner("isolated");
      await seedAnnual(snapshotOwner, 2026, { months: { "02": storedMonth(450.03, "automatic_snapshot") } });
      await seedAnnual(otherOwner, 2026, { months: { "02": storedMonth(99) } });

      await assert.rejects(repository.deleteManual({
        ownerId: snapshotOwner,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      }), /Somente registros manuais/);
      assert.equal((await repository.findByCompetence({
        ownerId: otherOwner,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      }))?.dividends, 99);
    });

    await context.test("reproduz os seis POSTs, GET/DELETE de fevereiro e cleanup do Functional QA", async () => {
      const ownerId = owner("functional-qa");
      const artificial = [
        [1, 47],
        [2, 450.03],
        [3, 87.06],
        [4, 40],
        [5, 50],
        [6, 60],
      ] as const;

      const created = [];
      for (const [month, dividends] of artificial) {
        created.push(await service.createManual({ ownerId }, {
          portfolioId: PORTFOLIO,
          year: 2026,
          month,
          dividends,
        }));
      }
      assert.equal(created.length, 6);
      assert.equal((await repository.findByCompetence({
        ownerId,
        portfolioId: PORTFOLIO,
        competence: "2026-02",
      }))?.dividends, 450.03);

      await service.deleteManualByCompetence({ ownerId }, PORTFOLIO, "2026-02");
      assert.deepEqual(
        (await service.list({ ownerId }, PORTFOLIO)).map((entry) => entry.competence),
        ["2026-01", "2026-03", "2026-04", "2026-05", "2026-06"],
      );

      for (const [month] of artificial) {
        const competence = `2026-${String(month).padStart(2, "0")}`;
        await service.deleteManualByCompetence({ ownerId }, PORTFOLIO, competence);
        await service.deleteManualByCompetence({ ownerId }, PORTFOLIO, competence);
      }
      assert.deepEqual(await service.list({ ownerId }, PORTFOLIO), []);
    });
  } finally {
    for (const ownerId of owners) {
      for (const year of [2025, 2026]) await annualReference(ownerId, year).delete();
    }
    await deleteApp(app);
  }
});
