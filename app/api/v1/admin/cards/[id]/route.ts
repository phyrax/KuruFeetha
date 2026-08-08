import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";
import { validHttpUrl, validateRichText, validateTranslation, wordCount, type RichTextDocument, type TranslationInput } from "../../../../../lib/cms";
export const dynamic = "force-dynamic";
type Body = { categoryId?: string; imageKey?: string; sourceName?: string|null; sourceUrl?: string|null; isBreaking?: boolean; isImportant?: boolean; status?: "draft"|"archived"; translations?: { en?: TranslationInput; dv?: TranslationInput } };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params; const runtime = env as unknown as { DB: D1Database };
  const card = await runtime.DB.prepare("SELECT id,category_id AS categoryId,status,image_key AS imageKey,image_url AS imageUrl,source_name AS sourceName,source_url AS sourceUrl,is_breaking AS isBreaking,is_important AS isImportant,published_at AS publishedAt FROM news_cards WHERE id=?").bind(id).first();
  if (!card) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const translations = await runtime.DB.prepare("SELECT language,headline,summary,review_status AS status,published_at AS publishedAt,article_content AS articleContent,article_status AS articleStatus,article_published_at AS articlePublishedAt FROM news_card_translations WHERE card_id=?").bind(id).all();
  return Response.json({ ...card, translations: translations.results });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor; try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params; const body = await request.json().catch(() => null) as Body|null;
  if (!body || !validHttpUrl(body.sourceUrl)) return Response.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });
  const articles:Partial<Record<"en"|"dv",RichTextDocument|null>>={};try { for(const language of ["en","dv"] as const){validateTranslation(body.translations?.[language],language);if(body.translations?.[language]&&Object.prototype.hasOwnProperty.call(body.translations[language],"articleContent"))articles[language]=validateRichText(body.translations[language]?.articleContent)} } catch (error) { return Response.json({ error: { code: "INVALID_CONTENT", message: (error as Error).message } }, { status: 400 }); }
  const runtime = env as unknown as { DB: D1Database; MEDIA: R2Bucket }; const existing = await runtime.DB.prepare("SELECT image_key AS imageKey FROM news_cards WHERE id=?").bind(id).first<{imageKey:string|null}>();
  if (!existing) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (body.imageKey && !await runtime.MEDIA.head(body.imageKey)) return Response.json({ error: { code: "INVALID_IMAGE" } }, { status: 400 });
  const now=Date.now(); const statements=[runtime.DB.prepare(`UPDATE news_cards SET category_id=COALESCE(?,category_id),image_key=COALESCE(?,image_key),image_url=CASE WHEN ? IS NULL THEN image_url ELSE ? END,
    source_name=?,source_url=?,is_breaking=COALESCE(?,is_breaking),is_important=COALESCE(?,is_important),status=COALESCE(?,status),updated_at=? WHERE id=?`).bind(body.categoryId??null,body.imageKey??null,body.imageKey??null,body.imageKey?`/api/v1/media/${body.imageKey}`:null,body.sourceName?.trim().slice(0,100)||null,body.sourceUrl?.trim()||null,typeof body.isBreaking==="boolean"?(body.isBreaking?1:0):null,typeof body.isImportant==="boolean"?(body.isImportant?1:0):null,body.status??null,now,id)];
  for (const language of ["en","dv"] as const) { const t=body.translations?.[language]; if (!t?.headline?.trim()) continue; const articleProvided=Object.prototype.hasOwnProperty.call(t,"articleContent");statements.push(runtime.DB.prepare(`INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,article_content,review_status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'draft',NULL,?,?)
    ON CONFLICT(card_id,language) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,word_count=excluded.word_count,article_content=CASE WHEN ? THEN excluded.article_content ELSE news_card_translations.article_content END,article_status=CASE WHEN ? AND excluded.article_content IS NULL THEN 'draft' ELSE news_card_translations.article_status END,article_published_at=CASE WHEN ? AND excluded.article_content IS NULL THEN NULL ELSE news_card_translations.article_published_at END,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),id,language,t.headline.trim(),t.summary!.trim(),wordCount(t.summary!),articles[language]?JSON.stringify(articles[language]):null,now,now,articleProvided?1:0,articleProvided?1:0,articleProvided?1:0)); }
  const articleEdited=(["en","dv"] as const).some(language=>body.translations?.[language]&&Object.prototype.hasOwnProperty.call(body.translations[language],"articleContent"));statements.push(runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,articleEdited?"article.updated":"card.updated","news_card",id,articleEdited?JSON.stringify({languages:(["en","dv"] as const).filter(language=>body.translations?.[language]&&Object.prototype.hasOwnProperty.call(body.translations[language],"articleContent"))}):null,now)); await runtime.DB.batch(statements);
  if (body.imageKey && existing.imageKey && existing.imageKey!==body.imageKey) { const reference=await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE image_key=? LIMIT 1").bind(existing.imageKey).first(); if(!reference) await runtime.MEDIA.delete(existing.imageKey); }
  return GET(request,context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor; try { actor=await requireAdmin(request); } catch (error) { return authErrorResponse(error); } const {id}=await context.params,now=Date.now(),runtime=env as unknown as {DB:D1Database;MEDIA:R2Bucket};
  const card=await runtime.DB.prepare("SELECT image_key AS imageKey,status FROM news_cards WHERE id=?").bind(id).first<{imageKey:string|null;status:string}>();
  if(!card)return Response.json({error:{code:"NOT_FOUND"}},{status:404});
  if(new URL(request.url).searchParams.get("permanent")!=="true"){await runtime.DB.batch([runtime.DB.prepare("UPDATE news_cards SET status='archived',updated_at=? WHERE id=?").bind(now,id),runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"card.archived","news_card",id,now)]);return Response.json({id,status:"archived"});}
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE galleries SET related_story_id=NULL WHERE related_story_id=?").bind(id),
    runtime.DB.prepare("UPDATE galleries SET related_story_en_id=NULL WHERE related_story_en_id=?").bind(id),
    runtime.DB.prepare("UPDATE galleries SET related_story_dv_id=NULL WHERE related_story_dv_id=?").bind(id),
    runtime.DB.prepare("DELETE FROM bookmarks WHERE card_id=?").bind(id),
    runtime.DB.prepare("DELETE FROM content_likes WHERE content_type='story' AND content_id=?").bind(id),
    runtime.DB.prepare("DELETE FROM content_events WHERE content_type IN ('story','article') AND content_id=?").bind(id),
    runtime.DB.prepare("DELETE FROM news_card_translations WHERE card_id=?").bind(id),
    runtime.DB.prepare("DELETE FROM news_cards WHERE id=?").bind(id),
    runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"card.deleted","news_card",id,JSON.stringify({status:card.status}),now),
  ]);
  if(card.imageKey){const reference=await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE image_key=? UNION ALL SELECT 1 FROM gallery_images WHERE image_key=? UNION ALL SELECT 1 FROM campaigns WHERE image_key=? OR mobile_image_key=? OR desktop_image_key=? LIMIT 1").bind(card.imageKey,card.imageKey,card.imageKey,card.imageKey,card.imageKey).first();if(!reference)await runtime.MEDIA.delete(card.imageKey)}
  return Response.json({id,deleted:true});
}
