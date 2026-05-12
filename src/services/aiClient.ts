import { z } from "zod";
import { env } from "../config/env.js";

const verdictSchema = z.enum(["RELIABLE", "SUSPICIOUS", "FAKE"]);

const claimResultSchema = z.object({
  text: z.string(),
  is_verified: z.boolean(),
  confidence: z.number(),
  source_url: z.string().nullable().optional(),
});

const sourceResultSchema = z.object({
  url: z.string(),
  domain: z.string(),
  reputation_score: z.number(),
  is_known_satire: z.boolean(),
});

export const analysisResultSchema = z.object({
  raw_text: z.string(),
  credibility_score: z.number(),
  verdict: verdictSchema,
  claims: z.array(claimResultSchema),
  sources: z.array(sourceResultSchema),
  explanation: z.string(),
});

export type AiAnalysisResult = z.infer<typeof analysisResultSchema>;

export class AiServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "AiServerError";
  }
}

export async function callAiAnalyze(body: {
  url?: string | null;
  text?: string | null;
}): Promise<AiAnalysisResult> {
  const url = `${env.AI_SERVER_URL.replace(/\/$/, "")}/ai/analyze`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: body.url ?? undefined,
        text: body.text ?? undefined,
      }),
    });
  } catch (e) {
    throw new AiServerError("Could not reach AI server", 502, String(e));
  }

  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      typeof json === "object" && json !== null && "detail" in json
        ? (json as { detail: unknown }).detail
        : json;
    throw new AiServerError(
      `AI server returned ${res.status}`,
      res.status >= 500 ? 502 : 422,
      detail
    );
  }

  const parsed = analysisResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiServerError("Invalid AI response shape", 502, parsed.error.flatten());
  }
  return parsed.data;
}
