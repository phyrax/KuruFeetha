import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";

export const dynamic="force-dynamic";
type Body={topic?:string;language?:"en"|"dv";categoryId?:string;relatedStoryId?:string|null;published?:boolean};

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  let actor;try{actor=await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const {id}=await context.params,body=await request.json().catch(()=>null) as Body|null;
  if(!body?.topic?.trim()||body.topic.trim().length>180||!["en","dv"].includes(body.language??"")||!body.categoryId)return Response.json({error:{code:"INVALID_GALLERY",message:"Add a valid topic, language and category"}},{status:400});
  const runtime=env as unknown as {DB:D1Database};if(!await runtime.DB.prepare("SELECT 1 FROM galleries WHERE id=?").bind(id).first())return Response.json({error:{code:"NOT_FOUND"}},{status:404});
  if(body.relatedStoryId&&!await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE id=? AND status!='archived'").bind(body.relatedStoryId).first())return Response.json({error:{code:"INVALID_STORY"}},{status:400});
  if(!await runtime.DB.prepare("SELECT 1 FROM categories WHERE id=? AND enabled=1").bind(body.categoryId).first())return Response.json({error:{code:"INVALID_CATEGORY"}},{status:400});
  const now=Date.now();await runtime.DB.batch([runtime.DB.prepare("UPDATE galleries SET topic=?,language=?,category_id=?,related_story_id=?,status=?,published_at=CASE WHEN ? THEN COALESCE(published_at,?) ELSE NULL END,updated_at=? WHERE id=?").bind(body.topic.trim(),body.language,body.categoryId,body.relatedStoryId||null,body.published?"published":"draft",body.published?1:0,now,now,id),runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"gallery.updated","gallery",id,now)]);return Response.json({id});
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}const{id}=await context.params,now=Date.now();await(env as unknown as{DB:D1Database}).DB.prepare("UPDATE galleries SET status='archived',updated_at=? WHERE id=?").bind(now,id).run();return Response.json({id,status:"archived"});}
