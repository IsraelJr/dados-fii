import { PortfolioIntelligenceService } from "@/lib/portfolio-intelligence/PortfolioIntelligenceService";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { FirestorePortfolioIntelligenceReferenceRepository } from "@/server/repositories/FirestorePortfolioIntelligenceReferenceRepository";
import { FirestorePortfolioIntelligenceSourceRepository } from "@/server/repositories/FirestorePortfolioIntelligenceSourceRepository";
import { PortfolioIntelligenceCanonicalInputService } from "./PortfolioIntelligenceCanonicalInputService";
import { PortfolioIntelligenceReferenceFactory } from "./PortfolioIntelligenceReferenceFactory";
import { PortfolioIncrementalServerAnalysisService } from "./PortfolioIncrementalServerAnalysisService";
import { PortfolioIncrementalStoredComparisonService } from "./PortfolioIncrementalStoredComparisonService";

export function createPortfolioIncrementalServerAnalysisService() {
  const source = new FirestorePortfolioIntelligenceSourceRepository();
  return new PortfolioIncrementalServerAnalysisService({
    input: new PortfolioIntelligenceCanonicalInputService({
      source,
      regulatory: regulatoryDataService,
    }),
    analyzer: new PortfolioIntelligenceService(),
    references: new FirestorePortfolioIntelligenceReferenceRepository(),
    referenceFactory: new PortfolioIntelligenceReferenceFactory(),
  });
}

export function createPortfolioIncrementalStoredComparisonService() {
  return new PortfolioIncrementalStoredComparisonService(
    new FirestorePortfolioIntelligenceReferenceRepository(),
  );
}
