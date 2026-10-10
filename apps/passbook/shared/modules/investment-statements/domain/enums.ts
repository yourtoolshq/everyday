export const enrichmentKinds = ["investment_statement"] as const;
export type EnrichmentKind = (typeof enrichmentKinds)[number];

export const sectionCoverages = ["not_entered", "partial", "complete"] as const;
export type SectionCoverage = (typeof sectionCoverages)[number];

export const enrichmentReviewStatuses = ["draft", "reviewed"] as const;
export type EnrichmentReviewStatus = (typeof enrichmentReviewStatuses)[number];

export const totalScopes = ["account_total", "currency_component"] as const;
export type TotalScope = (typeof totalScopes)[number];

export const positionLineKinds = ["investment", "cash", "other"] as const;
export type PositionLineKind = (typeof positionLineKinds)[number];
