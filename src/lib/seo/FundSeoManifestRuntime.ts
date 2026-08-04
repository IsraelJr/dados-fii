import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { fundSeoManifestRepository } from "./FundSeoManifestRepository";
import { FundSeoManifestService } from "./FundSeoManifestService";

export const fundSeoManifestService = new FundSeoManifestService(
  regulatoryDataService,
  fundSeoManifestRepository,
);
