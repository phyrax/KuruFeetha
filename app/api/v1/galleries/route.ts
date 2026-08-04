import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("language") === "dv" ? "dv" : "en";
  const runtime = env as unknown as { DB: D1Database };
  const result = await runtime.DB.prepare(`
    SELECT g.id,g.topic,g.language,g.related_story_id AS relatedStoryId,g.published_at AS publishedAt,
      json_group_array(json_object('id',i.id,'url',i.image_url,'sortOrder',i.sort_order)) AS images
    FROM galleries g JOIN gallery_images i ON i.gallery_id=g.id
    WHERE g.status='published' AND g.language=?
    GROUP BY g.id ORDER BY g.published_at DESC LIMIT 50
  `).bind(language).all();
  return Response.json({ items: result.results });
}
