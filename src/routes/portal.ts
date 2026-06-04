import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  toAnalysisJson,
  toPortalItemSummary,
  toVersionSummary,
  type AnalysisWithRelations,
} from "../lib/analysisJson.js";
import { buildPortalMeta, canReanalyzeNow, nextReanalyzeAt, canDeleteContent } from "../lib/portalTiming.js";
import { AiServerError, runNewAnalysisVersion } from "../services/analysisRunner.js";

export const portalRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  verdict: z.enum(["RELIABLE", "SUSPICIOUS", "FAKE"]).optional(),
  q: z.string().optional(),
});

portalRouter.get("/items", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { page, verdict, q } = parsed.data;
  const take = env.PORTAL_PAGE_SIZE;
  const skip = (page - 1) * take;

  const items = await prisma.contentItem.findMany({
    orderBy: { lastAnalyzedAt: "desc" },
    skip,
    take: take + 1,
    include: {
      latestAnalysis: true,
    },
  });

  let filtered = items;
  if (verdict) {
    filtered = filtered.filter((i) => i.latestAnalysis?.verdict === verdict);
  }
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.snippet?.toLowerCase().includes(needle) ||
        i.displayUrl?.toLowerCase().includes(needle) ||
        i.canonicalKey.toLowerCase().includes(needle)
    );
  }

  const pageItems = filtered.slice(0, take);
  const hasMore = filtered.length > take;

  res.json({
    items: pageItems.map((item) =>
      toPortalItemSummary(item, item.latestAnalysis as AnalysisWithRelations | null)
    ),
    page,
    pageSize: take,
    hasMore,
  });
});

portalRouter.get("/items/:contentItemId", async (req, res) => {
  const id = req.params.contentItemId;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid content item id" });
    return;
  }

  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      latestAnalysis: { include: { claims: true, sources: true } },
    },
  });
  if (!item?.latestAnalysis) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  const row = item.latestAnalysis;
  const meta = buildPortalMeta(item, row, {
    fromCache: true,
    reanalyzeCooldownHours: env.REANALYZE_COOLDOWN_HOURS,
    deleteWindowMinutes: env.DELETE_WINDOW_MINUTES,
  });

  res.json({
    item: toPortalItemSummary(item, row),
    analysis: toAnalysisJson(row, meta),
  });
});

portalRouter.get("/items/:contentItemId/versions", async (req, res) => {
  const id = req.params.contentItemId;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid content item id" });
    return;
  }

  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  const versions = await prisma.analysis.findMany({
    where: { contentItemId: id },
    orderBy: { versionNumber: "desc" },
  });

  res.json({
    contentItemId: id,
    versions: versions.map(toVersionSummary),
  });
});

portalRouter.post("/items/:contentItemId/reanalyze", requireAuth, async (req, res) => {
  const contentItemId = req.params.contentItemId;
  if (!z.string().uuid().safeParse(contentItemId).success) {
    res.status(400).json({ error: "Invalid content item id" });
    return;
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: { latestAnalysis: true },
  });
  if (!item?.latestAnalysis) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  if (!canReanalyzeNow(item.lastAnalyzedAt, env.REANALYZE_COOLDOWN_HOURS)) {
    res.status(429).json({
      error: "Aguarde antes de solicitar uma nova análise.",
      nextReanalyzeAt: nextReanalyzeAt(
        item.lastAnalyzedAt,
        env.REANALYZE_COOLDOWN_HOURS
      ).toISOString(),
    });
    return;
  }

  const latest = item.latestAnalysis;
  const inputUrl = latest.inputUrl ?? undefined;
  const inputText = latest.inputText ?? undefined;

  try {
    const row = await runNewAnalysisVersion({
      contentItemId: item.id,
      userId: req.userId!,
      versionNumber: item.analysisCount + 1,
      inputUrl,
      inputText: inputUrl ? undefined : inputText,
      snippet: item.snippet ?? inputUrl ?? inputText ?? "",
      isNewContent: false,
    });

    const updatedItem = await prisma.contentItem.findUniqueOrThrow({
      where: { id: item.id },
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

portalRouter.delete("/items/:contentItemId", requireAuth, async (req, res) => {
  const contentItemId = req.params.contentItemId;
  if (!z.string().uuid().safeParse(contentItemId).success) {
    res.status(400).json({ error: "Invalid content item id" });
    return;
  }

  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  if (!canDeleteContent(item, req.userId!, env.DELETE_WINDOW_MINUTES)) {
    res.status(403).json({
      error:
        "Só quem publicou primeiro pode excluir, e apenas dentro do prazo permitido após a primeira análise.",
    });
    return;
  }

  await prisma.contentItem.delete({ where: { id: contentItemId } });
  res.status(204).send();
});
