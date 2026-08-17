import { FundRadarService } from "@/lib/fund-radar/FundRadarService";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { FirestoreFundRadarRepository } from "@/server/repositories/FirestoreFundRadarRepository";

export function createFundRadarRuntime() {
  const repository = new FirestoreFundRadarRepository();
  return Object.freeze({
    repository,
    service: new FundRadarService(repository, regulatoryDataService),
  });
}
