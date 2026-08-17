export const PORTFOLIO_HISTORY_PERSISTED_EVENT = "dados-fii-portfolio-history-persisted";

export type PortfolioHistoryFlushEntry = Readonly<{
  competence: string;
  dividends: number | null;
}>;

export type PortfolioHistoryFlushMethod = "POST" | "PATCH" | "DELETE";

export type PortfolioHistoryFlushEvent =
  | "history_month_added"
  | "history_month_updated"
  | "history_month_deleted";

export type PortfolioHistoryPendingOperations<T extends PortfolioHistoryFlushEntry> = Readonly<{
  upserts: Readonly<Record<string, T>>;
  deletes: readonly string[];
}>;

export function reconcilePortfolioHistoryQueueAfterFlush<T extends PortfolioHistoryFlushEntry>(
  current: PortfolioHistoryPendingOperations<T>,
  captured: PortfolioHistoryPendingOperations<T>,
): PortfolioHistoryPendingOperations<T> {
  const upserts = { ...current.upserts };
  for (const [competence, capturedEntry] of Object.entries(captured.upserts)) {
    if (upserts[competence] === capturedEntry) delete upserts[competence];
  }
  const capturedDeletes = new Set(captured.deletes);
  const deletes = current.deletes.filter((competence) => !capturedDeletes.has(competence));
  return Object.freeze({ upserts: Object.freeze(upserts), deletes: Object.freeze([...deletes]) });
}

export type PortfolioHistoryFlushInput = Readonly<{
  upserts: readonly PortfolioHistoryFlushEntry[];
  deletes: readonly string[];
  isPersisted: (competence: string) => boolean;
  refreshPersisted: () => Promise<void>;
  request: (
    method: PortfolioHistoryFlushMethod,
    body: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
  markPersisted: (competence: string) => void;
  markDeleted: (competence: string) => void;
  track: (event: PortfolioHistoryFlushEvent) => void;
  onPersisted: () => void;
}>;

/**
 * Flushes the optimistic history queue and publishes only after the complete
 * remote batch succeeds. The callback intentionally receives no payload so a
 * browser event cannot carry portfolio or identity data.
 */
export async function flushPortfolioHistoryOperations(
  input: PortfolioHistoryFlushInput,
): Promise<boolean> {
  let remoteStateConfirmed = false;
  if (!input.upserts.length && !input.deletes.length) return false;
  const previouslyPersistedDeletes = new Set(
    input.deletes.filter((competence) => input.isPersisted(competence)),
  );
  await input.refreshPersisted();

  for (const entry of input.upserts) {
    if (input.isPersisted(entry.competence)) {
      await input.request("PATCH", {
        competence: entry.competence,
        dividends: entry.dividends,
      });
      input.track("history_month_updated");
    } else {
      const [year, month] = entry.competence.split("-").map(Number);
      await input.request("POST", { year, month, dividends: entry.dividends });
      input.markPersisted(entry.competence);
      input.track("history_month_added");
    }
    remoteStateConfirmed = true;
  }

  for (const competence of input.deletes) {
    if (!input.isPersisted(competence)) {
      if (previouslyPersistedDeletes.has(competence)) {
        input.markDeleted(competence);
        input.track("history_month_deleted");
        remoteStateConfirmed = true;
      }
      continue;
    }
    await input.request("DELETE", { competence });
    input.markDeleted(competence);
    input.track("history_month_deleted");
    remoteStateConfirmed = true;
  }

  if (remoteStateConfirmed) input.onPersisted();
  return remoteStateConfirmed;
}
