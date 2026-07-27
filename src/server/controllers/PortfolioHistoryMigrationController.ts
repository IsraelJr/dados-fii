import { NextResponse } from "next/server";
import { normalizeLegacyWalletSnapshots } from "@/lib/portfolio/LegacyPortfolioHistoryMigration";
import { PortfolioHistoryService } from "@/lib/portfolio/PortfolioHistoryService";
import { resolveWalletIdentity, WalletIdentityError } from "@/server/auth/WalletIdentityResolver";
import { FirestorePortfolioHistoryRepository } from "@/server/repositories/FirestorePortfolioHistoryRepository";

const service = new PortfolioHistoryService(new FirestorePortfolioHistoryRepository());

export async function POST(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const body = await request.json() as Record<string, unknown>;
    const portfolioId = String(body.portfolioId ?? "default");
    const normalized = normalizeLegacyWalletSnapshots(portfolioId, body.snapshots, new Date());
    const imported = await service.importLegacy({ ownerId: identity.ownerId }, normalized.entries);

    return NextResponse.json({
      ok: true,
      imported: imported.imported,
      skipped: imported.skipped,
      rejected: normalized.rejected,
    });
  } catch (error) {
    if (error instanceof WalletIdentityError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível migrar o histórico local." }, { status: 400 });
  }
}
