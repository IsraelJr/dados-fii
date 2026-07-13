// Compatibilidade para execuções históricas e imports anteriores do piloto TGAR11.
// Novas execuções devem importar fundIngestionWorkflow de ./fundIngestion.
export {
  fundIngestionWorkflow,
  fundIngestionWorkflow as fiiIngestionWorkflow,
  fundIngestionWorkflow as tgar11IngestionWorkflow,
} from "./fundIngestion";
export type { FundIngestionInput } from "./fundIngestion";
