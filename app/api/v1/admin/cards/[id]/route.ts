import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";
import { validHttpUrl, validateTranslation, wordCount, type TranslationInput } from "../../../../../lib/cms";
export const dynamic = "force-dynamic";
type Body = { categoryId?: string; imageKey?: string; sourceName?: string|null; sourceUrl?: string|null; isBreaking?: boolean; isImportant?: boolean; status?: "draft"|"archived"; translations?: { en?: TranslationInput; dv?: TranslationInput } };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params; const runtime = env as unknown as { DB: D1Database };
  const card = await runtime.DB.prepare("SELECT id,category_id AS categoryId,status,image_key AS imageKey,image_url AS imageUrl,source_name AS sourceName,source_url AS sourceUrl,is_breaking AS isBreaking,is_important AS isImportant,published_at AS publishedAt FROM news_cards WHERE id=?").bind(id).first();
  if (!card) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const translations = await runtime.DB.prepare("SELECT language,headline,summary,review_status AS status,published_at AS publishedAt FROM news_card_translations WHERE card_id=?").bind(id).all();
  return Response.json({ ...card, translations: translations.results });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor; try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params; const body = await request.json().catch(() => null) as Body|null;
  if (!body || !validHttpUrl(body.sourceUrl)) return Response.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });
  try { validateTranslation(body.translations?.en,"en"); validateTranslation(body.translations?.dv,"dv"); } catch (error) { return Response.json({ error: { code: "INVALID_CONTENT", message: (error as Error).message } }, { status: 400 }); }
  const runtime = env as unknown as { DB: D1Database; MEDIA: R2Bucket }; const existing = await runtime.DB.prepare("SELECT image_key AS imageKey FROM news_cards WHERE id=?").bind(id).first<{imageKey:string|null}>();
  if (!existing) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (body.imageKey && !await runtime.MEDIA.head(body.imageKey)) return Response.json({ error: { code: "INVALID_IMAGE" } }, { status: 400 });
  const now=Date.now(); const statements=[runtime.DB.prepare(`UPDATE news_cards SET category_id=COALESCE(?,category_id),image_key=COALESCE(?,image_key),image_url=CASE WHEN ? IS NULL THEN image_url ELSE ? END,
    source_name=?,source_url=?,is_breaking=COALESCE(?,is_breaking),is_important=COALESCE(?,is_important),status=COALESCE(?,status),updated_at=? WHERE id=?`).bind(body.categoryId??null,body.imageKey??null,body.imageKey??null,body.imageKey?`/api/v1/media/${body.imageKey}`:null,body.sourceName?.trim().slice(0,100)||null,body.sourceUrl?.trim()||null,typeof body.isBreaking==="boolean"?(body.isBreaking?1:0):null,typeof body.isImportant==="boolean"?(body.isImportant?1:0):null,body.status??null,now,id)];
  for (const language of ["en","dv"] as const) { const t=body.translations?.[language]; if (!t?.headline?.trim()) continue; statements.push(runtime.DB.prepare(`INSERT INTO news_card_translations (id,card_id,language,headline,summary,word_count,review_status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',NULL,?,?)
    ON CONFLICT(card_id,language) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,word_count=excluded.word_count,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),id,language,t.headline.trim(),t.summary!.trim(),wordCount(t.summary!),now,now)); }
  statements.push(runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"card.updated","news_card",id,now)); await runtime.DB.batch(statements);
  if (body.imageKey && existing.imageKey && existing.imageKey!==body.imageKey) { const reference=await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE image_key=? LIMIT 1").bind(existing.imageKey).first(); if(!reference) await runtime.MEDIA.delete(existing.imageKey); }
  return GET(request,context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); } const {id}=await context.params; const now=Date.now();
  await (env as unknown as {DB:D1Database}).DB.prepare("UPDATE news_cards SET status='archived',updated_at=? WHERE id=?").bind(now,id).run(); return Response.json({id,status:"archived"});
}
