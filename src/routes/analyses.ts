import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { buildCanonicalKey, snippetFrom } from "../lib/canonical.js";
import { toAnalysisJson, type AnalysisWithRelations } from "../lib/analysisJson.js";
import { buildPortalMeta } from "../lib/portalTiming.js";
import { AiServerError, runNewAnalysisVersion } from "../services/analysisRunner.js";
import { publishLog } from "../services/logPublisher.js";

const createBody = z
  .object({
    inputUrl: z.string().min(1).optional(),
    inputText: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.inputUrl?.trim() || b.inputText?.trim()), {
    message: "Provide inputUrl and/or inputText",
  });

export const analysesRouter = Router();

analysesRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const inputUrl = parsed.data.inputUrl?.trim() || undefined;
  const inputText = parsed.data.inputText?.trim() || undefined;

  let canonical: ReturnType<typeof buildCanonicalKey>;
  try {
    canonical = buildCanonicalKey({ inputUrl, inputText });
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Invalid input",
    });
    return;
  }

  const existing = await prisma.contentItem.findUnique({
    where: { canonicalKey: canonical.canonicalKey },
    include: {
      latestAnalysis: { include: { claims: true, sources: true } },
    },
  });

  if (existing?.latestAnalysis) {
    const row = existing.latestAnalysis;
    const meta = buildPortalMeta(existing, row, {
      fromCache: true,
      userId: req.userId,
      reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
      deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
    });

    publishLog({
      level: "info",
      event: "analysis.cache_hit",
      message: "Returned cached analysis",
      metadata: {
        contentItemId: existing.id,
        analysisId: row.id,
      },
    });

    res.status(200).json(toAnalysisJson(row, meta));
    return;
  }

  try {
    const now = new Date();
    let contentItem;
    try {
      contentItem = await prisma.contentItem.create({
        data: {
          kind: canonical.kind,
          canonicalKey: canonical.canonicalKey,
          displayUrl: canonical.displayUrl,
          snippet: snippetFrom(null, inputUrl ?? inputText ?? ""),
          firstSubmittedById: req.userId!,
          firstAnalyzedAt: now,
          lastAnalyzedAt: now,
          analysisCount: 0,
        },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        const raced = await prisma.contentItem.findUnique({
          where: { canonicalKey: canonical.canonicalKey },
          include: {
            latestAnalysis: { include: { claims: true, sources: true } },
          },
        });
        if (raced?.latestAnalysis) {
          const meta = buildPortalMeta(raced, raced.latestAnalysis, {
            fromCache: true,
            userId: req.userId,
            reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
            deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
          });
          res.status(200).json(toAnalysisJson(raced.latestAnalysis, meta));
          return;
        }
      }
      throw err;
    }

    const row = await runNewAnalysisVersion({
      contentItemId: contentItem.id,
      userId: req.userId!,
      versionNumber: 1,
      inputUrl,
      inputText,
      snippet: inputUrl ?? inputText ?? "",
      isNewContent: true,
    });

    const updatedItem = await prisma.contentItem.findUniqueOrThrow({
      where: { id: contentItem.id },
    });

    const meta = buildPortalMeta(updatedItem, row, {
      fromCache: false,
      userId: req.userId,
      reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
      deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
    });

    res.status(201).json(toAnalysisJson(row, meta));
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
});

analysesRouter.get("/", requireAuth, async (req, res) => {
  const rows = await prisma.analysis.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { claims: true, sources: true, contentItem: true },
  });

  const seen = new Set<string>();
  const items = [];
  for (const row of rows) {
    if (seen.has(row.contentItemId)) continue;
    seen.add(row.contentItemId);
    const meta = buildPortalMeta(row.contentItem, row, {
      fromCache: true,
      userId: req.userId,
      reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
      deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
    });
    items.push(toAnalysisJson(row as AnalysisWithRelations, meta));
  }

  res.json(items);
});

analysesRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid analysis id" });
    return;
  }

  const row = await prisma.analysis.findUnique({
    where: { id },
    include: { claims: true, sources: true, contentItem: true },
  });
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const meta = buildPortalMeta(row.contentItem, row, {
    fromCache: true,
    reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
    deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
  });

  res.json(toAnalysisJson(row, meta));
});

analysesRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid analysis id" });
    return;
  }

  const row = await prisma.analysis.findUnique({
    where: { id },
    include: { contentItem: true },
  });
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const item = row.contentItem;
  const { canDeleteContent } = await import("../lib/portalTiming.js");
  if (!canDeleteContent(item, req.userId!, env.DELETE_WINDOW_MINUTES)) {
    res.status(403).json({
      error:
        "Só quem publicou primeiro pode excluir, e apenas dentro do prazo permitido após a primeira análise.",
    });
    return;
  }

  await prisma.contentItem.delete({ where: { id: item.id } });
  res.status(204).send();
});
