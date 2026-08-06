import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../../../lib/auth";
import { richTextHasContent, validateRichText } from "../../../../../../../lib/cms";

export const dynamic = "force-dynamic";

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  let actor;try{actor=await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const {id}=await context.params;
  const body=await request.json().catch(()=>null) as {language?:"en"|"dv";published?:boolean}|null;
  if(!body?.language||typeof body.published!=="boolean")return Response.json({error:{code:"INVALID_INPUT"}},{status:400});
  const db=(env as unknown as {DB:D1Database}).DB;
  const translation=await db.prepare("SELECT article_content AS articleContent,review_status AS cardStatus FROM news_card_translations WHERE card_id=? AND language=?").bind(id,body.language).first<{articleContent:string|null;cardStatus:string}>();
  if(!translation)return Response.json({error:{code:"TRANSLATION_REQUIRED",message:"Complete this language before publishing its article"}},{status:400});
  const content=validateRichText(translation.articleContent?JSON.parse(translation.articleContent):null);
  if(body.published&&(translation.cardStatus!=="published"||!richTextHasContent(content)))return Response.json({error:{code:"ARTICLE_NOT_READY",message:"Publish the card translation and add article content first"}},{status:400});
  const now=Date.now();
  await db.batch([
    db.prepare("UPDATE news_card_translations SET article_status=?,article_published_at=?,updated_at=? WHERE card_id=? AND language=?").bind(body.published?"published":"draft",body.published?now:null,now,id,body.language),
    db.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,body.published?"article.published":"article.unpublished","news_card",id,JSON.stringify({language:body.language}),now),
  ]);
  return Response.json({id,language:body.language,published:body.published});
}
