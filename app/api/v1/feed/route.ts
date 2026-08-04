import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("language") === "dv" ? "dv" : "en";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const cursor = Number(url.searchParams.get("cursor")) || Date.now();
  const runtime = env as unknown as { DB: D1Database };
  const result = await runtime.DB.prepare(`
    SELECT c.id, c.breaking, c.image_url AS imageUrl, c.published_at AS publishedAt,
      t.headline, t.summary, t.word_count AS wordCount,
      s.name AS source, a.canonical_url AS sourceUrl, cat.slug AS category
    FROM news_cards c
    JOIN news_card_translations t ON t.card_id = c.id AND t.language = ? AND t.review_status = 'approved'
    LEFT JOIN story_clusters sc ON sc.id = c.cluster_id
    LEFT JOIN cluster_articles ca ON ca.cluster_id = sc.id
    LEFT JOIN source_articles a ON a.id = ca.article_id
    LEFT JOIN sources s ON s.id = a.source_id
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published' AND c.published_at < ?
    GROUP BY c.id
    ORDER BY c.boost DESC, c.published_at DESC
    LIMIT ?
  `).bind(language, cursor, limit + 1).all();
  const rows = result.results as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return Response.json({ items, nextCursor: hasMore ? items.at(-1)?.publishedAt : null });
}
