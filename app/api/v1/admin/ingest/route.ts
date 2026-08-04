import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { extractArticle } from "../../../../lib/ingestion";
import { generateWithFallback } from "../../../../lib/ai-providers";
import { countWords } from "../../../../lib/news";

export const dynamic = "force-dynamic";

type RuntimeEnv = Record<string, string | undefined> & { DB: D1Database };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const runtime = env as unknown as RuntimeEnv;
  const trustedWorker = Boolean(runtime.INGESTION_SECRET && request.headers.get("x-ingestion-secret") === runtime.INGESTION_SECRET);
  if (!user && !trustedWorker) return Response.json({ error: { code: "AUTH_REQUIRED", message: "Sign in to use the editorial desk" } }, { status: 401 });
  const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 120);
  const input = await request.json().catch(() => null) as { url?: string } | null;
  if (!input?.url) return Response.json({ error: { code: "URL_REQUIRED", message: "Article URL is required" } }, { status: 400 });

  try {
    const article = await extractArticle(input.url);
    const existing = await runtime.DB.prepare("SELECT id FROM source_articles WHERE canonical_url = ? OR content_hash = ? LIMIT 1").bind(article.canonicalUrl, article.contentHash).first<{ id: string }>();
    if (existing) return Response.json({ articleId: existing.id, duplicate: true, status: "already_ingested" });

    const now = Date.now();
    const sourceId = `source_${new URL(article.canonicalUrl).hostname.replace(/[^a-z0-9]+/gi, "_")}`;
    const articleId = crypto.randomUUID();
    await runtime.DB.batch([
      runtime.DB.prepare("INSERT OR IGNORE INTO sources (id,name,domain,language,ingestion_method,poll_minutes,image_use_allowed,enabled,created_at,updated_at) VALUES (?,?,?,?,?,15,0,0,?,?)")
        .bind(sourceId, new URL(article.canonicalUrl).hostname, new URL(article.canonicalUrl).hostname, article.language, "manual", now, now),
      runtime.DB.prepare("INSERT INTO source_articles (id,source_id,canonical_url,title,body,content_hash,published_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(articleId, sourceId, article.canonicalUrl, article.title, article.body, article.contentHash, article.publishedAt ? Date.parse(article.publishedAt) : null, "extracted", now, now),
    ]);

    const generated = await generateWithFallback({ title: article.title, body: article.body, language: article.language }, runtime);
    const cardId = crypto.randomUUID();
    await runtime.DB.batch([
      runtime.DB.prepare("INSERT INTO news_cards (id,status,breaking,boost,image_url,created_at,updated_at) VALUES (?, 'needs_review',0,0,?,?,?)")
        .bind(cardId, article.imageUrl, now, now),
      runtime.DB.prepare("INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,review_status,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?)")
        .bind(crypto.randomUUID(), cardId, "en", generated.draft.headline.en, generated.draft.summary.en, countWords(generated.draft.summary.en), now, now),
      runtime.DB.prepare("INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,review_status,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?)")
        .bind(crypto.randomUUID(), cardId, "dv", generated.draft.headline.dv, generated.draft.summary.dv, countWords(generated.draft.summary.dv), now, now),
      runtime.DB.prepare("INSERT INTO ai_runs (id,article_id,provider,model,prompt_version,confidence,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), articleId, generated.provider, generated.provider === "openai" ? runtime.OPENAI_MODEL || "gpt-5.6-sol" : runtime.GEMINI_MODEL || "gemini-2.5-flash", "news-card-v1", generated.draft.confidence, "complete", now),
      runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), null, "article.ingested", "news_card", cardId, JSON.stringify({ articleId, idempotencyKey, provider: generated.provider, editor: user?.email ?? "scheduled-worker" }), now),
    ]);
    return Response.json({ articleId, cardId, status: "needs_review", provider: generated.provider, draft: generated.draft }, { status: 201 });
  } catch (error) {
    return Response.json({ error: { code: "INGESTION_FAILED", message: error instanceof Error ? error.message : "Ingestion failed" } }, { status: 422 });
  }
}
