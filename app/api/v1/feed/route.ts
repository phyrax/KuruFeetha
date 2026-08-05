import { env } from "cloudflare:workers";
import { authErrorResponse, optionalUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("language") === "dv" ? "dv" : "en";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const cursor = Number(url.searchParams.get("cursor")) || Date.now();
  const runtime = env as unknown as { DB: D1Database };
  let user = null;
  try { user = await optionalUser(request); } catch (error) { return authErrorResponse(error); }
  const result = await runtime.DB.prepare(`
    SELECT c.id, c.image_url AS imageUrl, t.published_at AS publishedAt,
      t.headline, t.summary, t.word_count AS wordCount,
      c.source_name AS source, c.source_url AS sourceUrl, cat.slug AS category,
      CASE WHEN ?='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName,
      (SELECT g.id FROM galleries g WHERE (CASE WHEN ?='dv' THEN g.related_story_dv_id ELSE g.related_story_en_id END)=c.id AND g.status='published' AND (CASE WHEN ?='dv' THEN g.published_dv=1 ELSE g.published_en=1 END) ORDER BY g.published_at DESC LIMIT 1) AS relatedGalleryId,
      ((SELECT COUNT(*) FROM content_likes l JOIN news_cards lc ON lc.id=l.content_id WHERE l.user_id=? AND l.content_type='story' AND lc.category_id=c.category_id) +
       (SELECT COUNT(*) FROM content_likes l JOIN galleries lg ON lg.id=l.content_id WHERE l.user_id=? AND l.content_type='gallery' AND lg.category_id=c.category_id)) AS affinity,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM category_follows cf WHERE cf.user_id=? AND cf.category_id=c.category_id
      ) THEN 1 ELSE 0 END AS followed
    FROM news_cards c
    JOIN news_card_translations t ON t.card_id = c.id AND t.language = ? AND t.review_status = 'published'
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published' AND t.published_at < ?
    ORDER BY followed DESC, affinity DESC, t.published_at DESC
    LIMIT ?
  `).bind(language, language, language, user?.id ?? null, user?.id ?? null, user?.id ?? null, user?.id ?? null, language, cursor, limit + 1).all();
  const rows = result.results as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return Response.json({ items, nextCursor: hasMore ? items.at(-1)?.publishedAt : null });
}
