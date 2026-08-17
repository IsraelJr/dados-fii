import { createHash } from "node:crypto";
import { FundRadarBatchProcessor, type FundRadarEmailGateway, type FundRadarOwnerSource } from "@/lib/fund-radar/FundRadarBatchProcessor";
import type { FundRadarUpdate } from "@/lib/fund-radar/FundRadar";
import { adminDb } from "@/lib/firebaseAdmin";
import { resolvePremiumEntitlement } from "@/lib/premiumSecurity";
import { createFundRadarRuntime } from "./FundRadarRuntime";

function validEmail(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

class FirestoreFundRadarOwnerSource implements FundRadarOwnerSource {
  async list(limit: number) {
    const snapshot = await adminDb.collectionGroup("FundRadar")
      .where("schemaVersion", "==", 1)
      .limit(limit)
      .get();
    const owners = await Promise.all(snapshot.docs.flatMap((document) => {
      const user = document.ref.parent.parent;
      return user ? [user.get()] : [];
    }));
    return Promise.all(owners.filter((owner) => owner.exists).map(async (owner) => {
      const data = owner.data() || {};
      const email = validEmail(data.email || (owner.id.includes("@") ? owner.id : null));
      const entitlement = email ? await resolvePremiumEntitlement({ uid: owner.id, email, claims: {} }) : null;
      return Object.freeze({ ownerId: owner.id, email, plan: entitlement?.plan || "free" });
    }));
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

class ResendFundRadarEmailGateway implements FundRadarEmailGateway {
  async send(email: string, updates: readonly FundRadarUpdate[]) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !updates.length) return false;
    const from = process.env.WALLET_EMAIL_FROM || "Dados FII <no-reply@dadosfii.com.br>";
    const siteUrl = String(process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || "https://www.dadosfii.com.br").replace(/\/$/, "");
    const content = updates.map((update) => `${update.ticker} — ${update.title}\n${update.whatChanged}\n${update.whyItMatters}\nFonte: ${update.source}`).join("\n\n");
    const idempotencyKey = createHash("sha256")
      .update("fund-radar-email:v1\0", "utf8")
      .update(updates.map((update) => update.fingerprint).sort().join(":"), "utf8")
      .digest("hex");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: `[Dados FII] ${updates.length} atualização(ões) no Radar`,
          text: `${content}\n\nAbra o Radar: ${siteUrl}/radar\n\nConteúdo informativo; não é recomendação de compra ou venda.`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Atualizações no Radar</h1><pre style="white-space:pre-wrap">${escapeHtml(content)}</pre><p><a href="${siteUrl}/radar">Abrir o Radar</a></p><p>Conteúdo informativo; não é recomendação de compra ou venda.</p></div>`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function createFundRadarBatchRuntime() {
  const runtime = createFundRadarRuntime();
  return new FundRadarBatchProcessor(
    new FirestoreFundRadarOwnerSource(),
    runtime.repository,
    runtime.service,
    new ResendFundRadarEmailGateway(),
  );
}

export async function processFundRadarUpdates(limit?: number) {
  return createFundRadarBatchRuntime().run(limit);
}
