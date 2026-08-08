import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";
import { richTextHasContent, validHttpUrl, validateRichText, validateTranslation, wordCount, type RichTextDocument, type TranslationInput } from "../../../../lib/cms";
import { youtubeVideoId } from "../../../../lib/youtube";
export const dynamic = "force-dynamic";
type Body = { categoryId?: string; imageKey?: string; youtubeUrl?: string; sourceName?: string; sourceUrl?: string; isBreaking?: boolean; isImportant?: boolean; isTimeSensitive?: boolean; translations?: { en?: TranslationInput; dv?: TranslationInput } };

export async function GET(request: Request) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const runtime = env as unknown as { DB: D1Database };
  const url = new URL(request.url), status = url.searchParams.get("status"), search = `%${(url.searchParams.get("search") ?? "").slice(0,80)}%`;
  const rows = await runtime.DB.prepare(`SELECT c.id,c.status,c.image_key AS imageKey,c.youtube_video_id AS youtubeVideoId,c.source_name AS sourceName,c.source_url AS sourceUrl,c.is_breaking AS isBreaking,c.is_important AS isImportant,c.is_time_sensitive AS isTimeSensitive,c.published_at AS publishedAt,
    cat.id AS categoryId,cat.name_en AS categoryEn,cat.name_dv AS categoryDv,
    json_group_array(json_object('language',t.language,'headline',t.headline,'summary',t.summary,'status',t.review_status,'articleContent',json(t.article_content),'articleStatus',t.article_status,'articlePublishedAt',t.article_published_at)) AS translations
    FROM news_cards c LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN news_card_translations t ON t.card_id=c.id
    WHERE (? IS NULL OR c.status=?) AND (COALESCE(t.headline,'') LIKE ? OR COALESCE(c.source_name,'') LIKE ?)
    GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100`).bind(["draft","published","archived"].includes(status??"")?status:null,status,search,search).all();
  return Response.json({ items: rows.results });
}

export async function POST(request: Request) {
  let actor; try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => null) as Body | null;
  const videoId=youtubeVideoId(body?.youtubeUrl);
  if (!body?.categoryId || (!body.imageKey&&!videoId)) return Response.json({ error: { code: "REQUIRED_FIELDS", message: "Add a photo or YouTube video, and choose a category" } }, { status: 400 });
  if(body.youtubeUrl?.trim()&&!videoId)return Response.json({error:{code:"INVALID_YOUTUBE_URL",message:"Enter a valid YouTube video URL"}},{status:400});
  if (!validHttpUrl(body.sourceUrl)) return Response.json({ error: { code: "INVALID_SOURCE_URL", message: "Source URL must use http or https" } }, { status: 400 });
  const articles: Partial<Record<"en"|"dv",RichTextDocument|null>>={};
  try { for(const language of ["en","dv"] as const){const translation=body.translations?.[language];validateTranslation(translation,language);articles[language]=validateRichText(translation?.articleContent);if(translation?.articlePublished&&!richTextHasContent(articles[language]))throw new Error(`${language.toUpperCase()} article content is required before publishing`);if(translation?.articlePublished&&!translation.published)throw new Error(`${language.toUpperCase()} card language must be published before its article`)} } catch (error) { return Response.json({ error: { code: "INVALID_CONTENT", message: (error as Error).message } }, { status: 400 }); }
  const present = (["en","dv"] as const).filter((language) => body.translations?.[language]?.headline?.trim());
  if (!present.length) return Response.json({ error: { code: "CONTENT_REQUIRED", message: "Add English or Thaana content" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database; MEDIA: R2Bucket };
  const [category, image] = await Promise.all([runtime.DB.prepare("SELECT id FROM categories WHERE id=? AND enabled=1").bind(body.categoryId).first(),body.imageKey?runtime.MEDIA.head(body.imageKey):Promise.resolve(true)]);
  if (!category || !image) return Response.json({ error: { code: "INVALID_REFERENCE", message: "Choose a valid category and uploaded photo" } }, { status: 400 });
  const id = crypto.randomUUID(), now = Date.now();
  const published = present.some((language) => body.translations?.[language]?.published);
  await runtime.DB.batch([
    runtime.DB.prepare("INSERT INTO news_cards (id,category_id,status,image_key,image_url,youtube_video_id,source_name,source_url,is_breaking,is_important,is_time_sensitive,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,body.categoryId,published?"published":"draft",body.imageKey||null,body.imageKey?`/api/v1/media/${body.imageKey}`:null,videoId,body.sourceName?.trim().slice(0,100)||null,body.sourceUrl?.trim()||null,body.isBreaking?1:0,body.isImportant?1:0,body.isTimeSensitive?1:0,published?now:null,now,now),
    ...present.map((language) => { const t=body.translations![language]!;const articlePublished=!!t.articlePublished&&richTextHasContent(articles[language]); return runtime.DB.prepare("INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,article_content,article_status,article_published_at,review_status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,language,t.headline!.trim(),t.summary!.trim(),wordCount(t.summary!),articles[language]?JSON.stringify(articles[language]):null,articlePublished?"published":"draft",articlePublished?now:null,t.published?"published":"draft",t.published?now:null,now,now); }),
    runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"card.created","news_card",id,JSON.stringify({languages:present,isBreaking:!!body.isBreaking,isImportant:!!body.isImportant,isTimeSensitive:!!body.isTimeSensitive}),now),
  ]);
  return Response.json({ id }, { status: 201 });
}
