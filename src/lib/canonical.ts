import { createHash } from "node:crypto";
import { ContentKind } from "@prisma/client";

const STRIP_QUERY_PARAMS = new Set(
  (process.env.URL_STRIP_QUERY_PARAMS ??
    "utm_source,utm_medium,utm_campaign,utm_term,utm_content,fbclid,gclid,mc_cid,mc_eid"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const MIN_TEXT_LENGTH = 80;

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use http or https");
  }
  url.hash = "";
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (STRIP_QUERY_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  const search = params.toString();
  url.search = search ? `?${search}` : "";
  url.hostname = url.hostname.toLowerCase();
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname || "/";
  return url.toString();
}

export function hashText(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.length < MIN_TEXT_LENGTH) {
    throw new Error(`Text must be at least ${MIN_TEXT_LENGTH} characters`);
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function buildCanonicalKey(input: {
  inputUrl?: string;
  inputText?: string;
}): { kind: ContentKind; canonicalKey: string; displayUrl: string | null } {
  const url = input.inputUrl?.trim();
  if (url) {
    return {
      kind: ContentKind.URL,
      canonicalKey: `url:${normalizeUrl(url)}`,
      displayUrl: url,
    };
  }
  const text = input.inputText?.trim();
  if (!text) {
    throw new Error("Provide inputUrl and/or inputText");
  }
  return {
    kind: ContentKind.TEXT,
    canonicalKey: `text:${hashText(text)}`,
    displayUrl: null,
  };
}

export function snippetFrom(rawText: string | null | undefined, fallback: string): string {
  const base = (rawText || fallback).replace(/\s+/g, " ").trim();
  return base.length > 220 ? `${base.slice(0, 217)}…` : base;
}
