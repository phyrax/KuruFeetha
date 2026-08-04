import { createHash } from "node:crypto";
import { normalizeArticleUrl } from "./news";

export type ExtractedArticle = {
  canonicalUrl: string;
  title: string;
  description: string;
  body: string;
  imageUrl: string | null;
  publishedAt: string | null;
  language: "en" | "dv";
  contentHash: string;
};

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?)/i;

export function assertSafeArticleUrl(input: string): URL {
  const normalized = normalizeArticleUrl(input);
  const url = new URL(normalized);
  if (PRIVATE_HOST.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new Error("Private network URLs are not allowed");
  }
  return url;
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? null;
}

export async function extractArticle(input: string): Promise<ExtractedArticle> {
  const url = assertSafeArticleUrl(input);
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "KuruFeethaBot/1.0 (+https://kurufeetha-maldives.hussainfiraz.chatgpt.site)", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`Publisher returned ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) throw new Error("URL is not an HTML article");
  const html = (await response.text()).slice(0, 2_000_000);
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ?? response.url;
  const title = decode(meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = decode(meta(html, "og:description") ?? meta(html, "description") ?? "");
  const articleHtml = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const paragraphs = [...articleHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => decode(match[1])).filter((text) => text.length > 40);
  const body = paragraphs.join("\n\n").slice(0, 60_000);
  if (!title || body.length < 120) throw new Error("Could not extract enough article text");
  const sample = `${title} ${body.slice(0, 500)}`;
  const language = /[\u0780-\u07BF]/u.test(sample) ? "dv" : "en";
  return {
    canonicalUrl: normalizeArticleUrl(new URL(canonical, response.url).toString()),
    title,
    description,
    body,
    imageUrl: meta(html, "og:image"),
    publishedAt: meta(html, "article:published_time"),
    language,
    contentHash: createHash("sha256").update(`${title}\n${body}`).digest("hex"),
  };
}

export function extractFeedLinks(xml: string, baseUrl: string): string[] {
  const links = [...xml.matchAll(/<(?:link|guid)[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^<\s\]]+)/gi)].map((match) => match[1].trim());
  return [...new Set(links)].filter((link) => {
    try { return new URL(link, baseUrl).protocol.startsWith("http"); } catch { return false; }
  }).slice(0, 30);
}
