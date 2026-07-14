export type RegulatoryTimelineType = "document" | "event" | "material_fact" | "assembly" | "regulation";

export type RegulatoryTimelineItem = {
  id: string;
  ticker: string;
  type: RegulatoryTimelineType;
  title: string;
  summary?: string | null;
  occurredAt: string | null;
  publishedAt?: string | null;
  url?: string | null;
  source: string;
  documentNumber?: string | null;
  version?: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type RegulatoryTimelineResponse = {
  ticker: string;
  generatedAt: string;
  items: RegulatoryTimelineItem[];
  total: number;
  counts: Record<RegulatoryTimelineType, number>;
  appliedTypes: RegulatoryTimelineType[];
  nextCursor: string | null;
  sources: string[];
};

export type TimelineRecord = {
  id: string;
  data: Record<string, unknown>;
};
