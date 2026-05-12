import { Router } from "express";
import { z } from "zod";
import type { Analysis, Claim, AnalysisSource } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { AiServerError, callAiAnalyze } from "../services/aiClient.js";

const createBody = z
  .object({
    inputUrl: z.string().min(1).optional(),
    inputText: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.inputUrl?.trim() || b.inputText?.trim()), {
    message: "Provide inputUrl and/or inputText",
  });

export const analysesRouter = Router();

type AnalysisWithRelations = Analysis & {
  claims: Claim[];
  sources: AnalysisSource[];
};

function toAnalysisJson(row: AnalysisWithRelations) {
  return {
    id: row.id,
    userId: row.userId,
    inputUrl: row.inputUrl,
    inputText: row.inputText,
    rawText: row.rawText,
    credibilityScore: row.credibilityScore,
    verdict: row.verdict,
    explanation: row.explanation,
    createdAt: row.createdAt.toISOString(),
    claims: row.claims.map((c) => ({
      id: c.id,
      analysisId: c.analysisId,
      text: c.text,
      isVerified: c.isVerified,
      confidence: c.confidence,
      sourceUrl: c.sourceUrl,
    })),
    sources: row.sources.map((s) => ({
      id: s.id,
      analysisId: s.analysisId,
      url: s.url,
      domain: s.domain,
      reputationScore: s.reputationScore,
      isKnownSatire: s.isKnownSatire,
    })),
  };
}

analysesRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const inputUrl = parsed.data.inputUrl?.trim() || undefined;
  const inputText = parsed.data.inputText?.trim() || undefined;

  let ai;
  try {
    ai = await callAiAnalyze({ url: inputUrl ?? null, text: inputText ?? null });
  } catch (e) {
    if (e instanceof AiServerError) {
      res.status(e.status === 502 ? 502 : 422).json({
        error: e.message,
        detail: e.detail,
      });
      return;
    }
    throw e;
  }

  const row = await prisma.analysis.create({
    data: {
      userId: req.userId!,
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
    },
    include: { claims: true, sources: true },
  });

  res.status(201).json(toAnalysisJson(row));
});

analysesRouter.get("/", requireAuth, async (req, res) => {
  const rows = await prisma.analysis.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { claims: true, sources: true },
  });
  res.json(rows.map(toAnalysisJson));
});

analysesRouter.get("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid analysis id" });
    return;
  }
  const row = await prisma.analysis.findFirst({
    where: { id, userId: req.userId! },
    include: { claims: true, sources: true },
  });
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.json(toAnalysisJson(row));
});

analysesRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid analysis id" });
    return;
  }
  const result = await prisma.analysis.deleteMany({
    where: { id, userId: req.userId! },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.status(204).send();
});
