import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AiServerError, callAiAnalyze } from "./aiClient.js";
import { publishLog } from "./logPublisher.js";
import { snippetFrom } from "../lib/canonical.js";

type AiResult = Awaited<ReturnType<typeof callAiAnalyze>>;

function analysisCreateData(
  ai: AiResult,
  userId: string,
  contentItemId: string,
  versionNumber: number,
  inputUrl: string | undefined,
  inputText: string | undefined
): Prisma.AnalysisCreateInput {
  return {
    contentItem: { connect: { id: contentItemId } },
    user: { connect: { id: userId } },
    versionNumber,
    inputUrl: inputUrl ?? null,
    inputText: inputText ?? null,
    rawText: ai.raw_text,
    credibilityScore: ai.credibility_score,
    verdict: ai.verdict,
    explanation: ai.explanation,
    claims: {
      create: ai.claims.map((c) => ({
        text: c.text,
        isVerified: c.is_verified,
        confidence: c.confidence,
        sourceUrl: c.source_url ?? null,
      })),
    },
    sources: {
      create: ai.sources.map((s) => ({
        url: s.url,
        domain: s.domain,
        reputationScore: s.reputation_score,
        isKnownSatire: s.is_known_satire,
      })),
    },
  };
}

export async function runNewAnalysisVersion(opts: {
  contentItemId: string;
  userId: string;
  versionNumber: number;
  inputUrl?: string;
  inputText?: string;
  snippet: string;
  isNewContent: boolean;
}) {
  const ai = await callAiAnalyze({
    url: opts.inputUrl ?? null,
    text: opts.inputUrl ? null : (opts.inputText ?? null),
  });

  const row = await prisma.$transaction(async (tx) => {
    const analysis = await tx.analysis.create({
      data: analysisCreateData(
        ai,
        opts.userId,
        opts.contentItemId,
        opts.versionNumber,
        opts.inputUrl,
        opts.inputText
      ),
      include: { claims: true, sources: true },
    });

    const now = analysis.createdAt;
    await tx.contentItem.update({
      where: { id: opts.contentItemId },
      data: {
        snippet: snippetFrom(ai.raw_text, opts.snippet),
        lastAnalyzedAt: now,
        analysisCount: opts.versionNumber,
        latestAnalysisId: analysis.id,
        ...(opts.isNewContent ? { firstAnalyzedAt: now } : {}),
      },
    });

    return analysis;
  });

  publishLog({
    level: "info",
    event: "analysis.created",
    message: "Analysis version created",
    metadata: {
      analysisId: row.id,
      contentItemId: opts.contentItemId,
      versionNumber: opts.versionNumber,
      verdict: row.verdict,
    },
  });

  return row;
}

export { AiServerError };
