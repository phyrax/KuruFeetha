import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";
import { validHttpUrl, validateTranslation, wordCount, type TranslationInput } from "../../../../lib/cms";
export const dynamic = "force-dynamic";
type Body = { categoryId?: string; imageKey?: string; sourceName?: string; sourceUrl?: string; isBreaking?: boolean; translations?: { en?: TranslationInput; dv?: TranslationInput } };

export async function GET(request: Request) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const runtime = env as unknown as { DB: D1Database };
  const url = new URL(request.url), status = url.searchParams.get("status"), search = `%${(url.searchParams.get("search") ?? "").slice(0,80)}%`;
  const rows = await runtime.DB.prepare(`SELECT c.id,c.status,c.image_key AS imageKey,c.source_name AS sourceName,c.source_url AS sourceUrl,c.is_breaking AS isBreaking,c.published_at AS publishedAt,
    cat.id AS categoryId,cat.name_en AS categoryEn,cat.name_dv AS categoryDv,
    json_group_array(json_object('language',t.language,'headline',t.headline,'summary',t.summary,'status',t.review_status)) AS translations
    FROM news_cards c LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN news_card_translations t ON t.card_id=c.id
    WHERE (? IS NULL OR c.status=?) AND (COALESCE(t.headline,'') LIKE ? OR COALESCE(c.source_name,'') LIKE ?)
    GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100`).bind(["draft","published","archived"].includes(status??"")?status:null,status,search,search).all();
  return Response.json({ items: rows.results });
}

export async function POST(request: Request) {
  let actor; try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.categoryId || !body.imageKey) return Response.json({ error: { code: "REQUIRED_FIELDS", message: "Photo and category are required" } }, { status: 400 });
  if (!validHttpUrl(body.sourceUrl)) return Response.json({ error: { code: "INVALID_SOURCE_URL", message: "Source URL must use http or https" } }, { status: 400 });
  try { validateTranslation(body.translations?.en, "en"); validateTranslation(body.translations?.dv, "dv"); } catch (error) { return Response.json({ error: { code: "INVALID_CONTENT", message: (error as Error).message } }, { status: 400 }); }
  const present = (["en","dv"] as const).filter((language) => body.translations?.[language]?.headline?.trim());
  if (!present.length) return Response.json({ error: { code: "CONTENT_REQUIRED", message: "Add English or Thaana content" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database; MEDIA: R2Bucket };
  const [category, image] = await Promise.all([runtime.DB.prepare("SELECT id FROM categories WHERE id=? AND enabled=1").bind(body.categoryId).first(), runtime.MEDIA.head(body.imageKey)]);
  if (!category || !image) return Response.json({ error: { code: "INVALID_REFERENCE", message: "Choose a valid category and uploaded photo" } }, { status: 400 });
  const id = crypto.randomUUID(), now = Date.now();
  const published = present.some((language) => body.translations?.[language]?.published);
  await runtime.DB.batch([
    runtime.DB.prepare("INSERT INTO news_cards (id,category_id,status,image_key,image_url,source_name,source_url,is_breaking,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,body.categoryId,published?"published":"draft",body.imageKey,`/api/v1/media/${body.imageKey}`,body.sourceName?.trim().slice(0,100)||null,body.sourceUrl?.trim()||null,body.isBreaking?1:0,published?now:null,now,now),
    ...present.map((language) => { const t=body.translations![language]!; return runtime.DB.prepare("INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,review_status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,language,t.headline!.trim(),t.summary!.trim(),wordCount(t.summary!),t.published?"published":"draft",t.published?now:null,now,now); }),
    runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"card.created","news_card",id,JSON.stringify({languages:present,isBreaking:!!body.isBreaking}),now),
  ]);
  return Response.json({ id }, { status: 201 });
}
