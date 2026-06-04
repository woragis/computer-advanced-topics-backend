import type { ContentItem } from "@prisma/client";

export function reanalyzeCooldownMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

export function deleteWindowMs(minutes: number): number {
  return minutes * 60 * 1000;
}

export function nextReanalyzeAt(lastAnalyzedAt: Date, cooldownHours: number): Date {
  return new Date(lastAnalyzedAt.getTime() + reanalyzeCooldownMs(cooldownHours));
}

export function canReanalyzeNow(lastAnalyzedAt: Date, cooldownHours: number, now = new Date()): boolean {
  return now.getTime() >= nextReanalyzeAt(lastAnalyzedAt, cooldownHours).getTime();
}

export function deleteExpiresAt(firstAnalyzedAt: Date, windowMinutes: number): Date {
  return new Date(firstAnalyzedAt.getTime() + deleteWindowMs(windowMinutes));
}

export function canDeleteContent(
  item: ContentItem,
  userId: string,
  windowMinutes: number,
  now = new Date()
): boolean {
  if (item.firstSubmittedById !== userId) return false;
  return now.getTime() <= deleteExpiresAt(item.firstAnalyzedAt, windowMinutes).getTime();
}

export function buildPortalMeta(
  item: ContentItem,
  row: { createdAt: Date; versionNumber: number },
  opts: {
    fromCache: boolean;
    userId?: string;
    reanalyzeCooldownHours: number;
    deleteWindowMinutes: number;
  }
) {
  const analyzedAt = row.createdAt.toISOString();
  const canReanalyze = canReanalyzeNow(item.lastAnalyzedAt, opts.reanalyzeCooldownHours);
  const nextAt = canReanalyze
    ? null
    : nextReanalyzeAt(item.lastAnalyzedAt, opts.reanalyzeCooldownHours).toISOString();
  const canDelete = opts.userId
    ? canDeleteContent(item, opts.userId, opts.deleteWindowMinutes)
    : false;
  const deleteExp = opts.userId
    ? deleteExpiresAt(item.firstAnalyzedAt, opts.deleteWindowMinutes).toISOString()
    : null;

  return {
    fromCache: opts.fromCache,
    analyzedAt,
    contentItemId: item.id,
    versionNumber: row.versionNumber,
    analysisCount: item.analysisCount,
    canReanalyze,
    nextReanalyzeAt: nextAt,
    canDelete,
    deleteExpiresAt: canDelete ? deleteExp : null,
  };
}
