export type IfixConstituent = { ticker: string; asset: string; weightPercent: number | null };

export type IfixComposition = {
  index: "IFIX";
  referenceDate: string;
  fetchedAt: string;
  source: string;
  total: number;
  constituents: IfixConstituent[];
};

export type IndexMembership = {
  status: "member" | "not_member" | "not_applicable" | "unknown";
  weightPercent: number | null;
  referenceDate: string | null;
  source: string | null;
};
