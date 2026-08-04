import { env } from "cloudflare:workers";
import { authErrorResponse, optionalUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("language") === "dv" ? "dv" : "en";
  const runtime = env as unknown as { DB: D1Database };
  let user=null;try{user=await optionalUser(request)}catch(error){return authErrorResponse(error)}
  const result = await runtime.DB.prepare(`
    SELECT g.id,g.topic,g.language,g.related_story_id AS relatedStoryId,g.published_at AS publishedAt,cat.slug AS category,
      CASE WHEN ?='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName,
      ((SELECT COUNT(*) FROM content_likes l JOIN news_cards lc ON lc.id=l.content_id WHERE l.user_id=? AND l.content_type='story' AND lc.category_id=g.category_id) +
       (SELECT COUNT(*) FROM content_likes l JOIN galleries lg ON lg.id=l.content_id WHERE l.user_id=? AND l.content_type='gallery' AND lg.category_id=g.category_id)) AS affinity,
      json_group_array(json_object('id',i.id,'url',i.image_url,'sortOrder',i.sort_order)) AS images
    FROM galleries g LEFT JOIN categories cat ON cat.id=g.category_id JOIN gallery_images i ON i.gallery_id=g.id
    WHERE g.status='published' AND g.language=?
    GROUP BY g.id ORDER BY affinity DESC,g.published_at DESC LIMIT 50
  `).bind(language,user?.id??null,user?.id??null,language).all();
  return Response.json({ items: result.results });
}
