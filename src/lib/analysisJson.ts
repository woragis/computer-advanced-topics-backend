import type { Analysis, Claim, AnalysisSource, ContentItem } from "@prisma/client";

export type AnalysisWithRelations = Analysis & {
  claims: Claim[];
  sources: AnalysisSource[];
};

export type PortalMeta = {
  fromCache: boolean;
  analyzedAt: string;
  contentItemId: string;
  versionNumber: number;
  analysisCount: number;
  canReanalyze: boolean;
  nextReanalyzeAt: string | null;
  canDelete: boolean;
  deleteExpiresAt: string | null;
};

export function toAnalysisJson(
  row: AnalysisWithRelations,
  meta: PortalMeta
) {
  return {
    id: row.id,
    contentItemId: row.contentItemId,
    userId: row.userId,
    versionNumber: row.versionNumber,
    inputUrl: row.inputUrl,
    inputText: row.inputText,
    rawText: row.rawText,
    credibilityScore: row.credibilityScore,
    verdict: row.verdict,
    explanation: row.explanation,
    createdAt: row.createdAt.toISOString(),
    analyzedAt: meta.analyzedAt,
    fromCache: meta.fromCache,
    canReanalyze: meta.canReanalyze,
    nextReanalyzeAt: meta.nextReanalyzeAt,
    canDelete: meta.canDelete,
    deleteExpiresAt: meta.deleteExpiresAt,
    analysisCount: meta.analysisCount,
    claims: row.claims.map((c) => ({
      id: c.id,
      text: c.text,
      isVerified: c.isVerified,
      confidence: c.confidence,
      sourceUrl: c.sourceUrl,
    })),
    sources: row.sources.map((s) => ({
      id: s.id,
      url: s.url,
      domain: s.domain,
      reputationScore: s.reputationScore,
      isKnownSatire: s.isKnownSatire,
    })),
  };
}

export function toPortalItemSummary(
  item: ContentItem,
  latest: AnalysisWithRelations | null
) {
  return {
    contentItemId: item.id,
    kind: item.kind,
    displayUrl: item.displayUrl,
    snippet: item.snippet,
    lastAnalyzedAt: item.lastAnalyzedAt.toISOString(),
    firstAnalyzedAt: item.firstAnalyzedAt.toISOString(),
    analysisCount: item.analysisCount,
    verdict: latest?.verdict ?? null,
    credibilityScore: latest?.credibilityScore ?? null,
    latestAnalysisId: item.latestAnalysisId,
  };
}

export function toVersionSummary(row: Analysis) {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    verdict: row.verdict,
    credibilityScore: row.credibilityScore,
    analyzedAt: row.createdAt.toISOString(),
    triggeredByUserId: row.userId,
  };
}
