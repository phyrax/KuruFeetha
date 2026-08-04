import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
type Body={topic?:string;language?:"en"|"dv";relatedStoryId?:string|null;imageKeys?:string[];published?:boolean};

function validate(body:Body|null){
  if(!body?.topic?.trim()||body.topic.trim().length>180) return "Add a topic of up to 180 characters";
  if(!["en","dv"].includes(body.language??"")) return "Choose English or Thaana";
  if(!Array.isArray(body.imageKeys)||body.imageKeys.length<2||body.imageKeys.length>20||new Set(body.imageKeys).size!==body.imageKeys.length) return "Add between 2 and 20 different images";
  return null;
}

export async function GET(request:Request){
  try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const runtime=env as unknown as {DB:D1Database};
  const result=await runtime.DB.prepare(`SELECT g.id,g.topic,g.language,g.related_story_id AS relatedStoryId,g.status,g.published_at AS publishedAt,
    json_group_array(json_object('id',i.id,'key',i.image_key,'url',i.image_url,'sortOrder',i.sort_order)) AS images
    FROM galleries g LEFT JOIN gallery_images i ON i.gallery_id=g.id GROUP BY g.id ORDER BY g.updated_at DESC LIMIT 100`).all();
  return Response.json({items:result.results});
}

export async function POST(request:Request){
  let actor;try{actor=await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const body=await request.json().catch(()=>null) as Body|null,problem=validate(body);if(problem)return Response.json({error:{code:"INVALID_GALLERY",message:problem}},{status:400});
  const runtime=env as unknown as {DB:D1Database;MEDIA:R2Bucket};
  if(body!.relatedStoryId&&!await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE id=? AND status!='archived'").bind(body!.relatedStoryId).first())return Response.json({error:{code:"INVALID_STORY",message:"Choose a valid related story"}},{status:400});
  for(const key of body!.imageKeys!)if(!key.startsWith("news/")||!await runtime.MEDIA.head(key))return Response.json({error:{code:"INVALID_IMAGE",message:"One or more images could not be found"}},{status:400});
  const id=crypto.randomUUID(),now=Date.now(),statements=[runtime.DB.prepare("INSERT INTO galleries (id,topic,language,related_story_id,status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,body!.topic!.trim(),body!.language,body!.relatedStoryId||null,body!.published?"published":"draft",body!.published?now:null,now,now)];
  body!.imageKeys!.forEach((key,index)=>statements.push(runtime.DB.prepare("INSERT INTO gallery_images (id,gallery_id,image_key,image_url,sort_order,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),id,key,`/api/v1/media/${key}`,index,now)));
  statements.push(runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"gallery.created","gallery",id,JSON.stringify({language:body!.language,published:body!.published}),now));
  await runtime.DB.batch(statements);return Response.json({id},{status:201});
}
