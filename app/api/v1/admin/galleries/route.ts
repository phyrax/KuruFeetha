import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";

export const dynamic="force-dynamic";
type Body={topicEn?:string;topicDv?:string;publishedEn?:boolean;publishedDv?:boolean;categoryId?:string;relatedStoryEnId?:string|null;relatedStoryDvId?:string|null;imageKeys?:string[]};

function validate(body:Body|null){
  const en=body?.topicEn?.trim(),dv=body?.topicDv?.trim();
  if(!en&&!dv)return "Add an English or Thaana topic";
  if((en?.length??0)>180||(dv?.length??0)>180)return "Topics must be 180 characters or fewer";
  if(body?.publishedEn&&!en)return "Add an English topic before publishing English";
  if(body?.publishedDv&&!dv)return "Add a Thaana topic before publishing Thaana";
  if(!body?.categoryId)return "Choose a category";
  if(!Array.isArray(body.imageKeys)||body.imageKeys.length<2||body.imageKeys.length>20||new Set(body.imageKeys).size!==body.imageKeys.length)return "Add between 2 and 20 different images";
  return null;
}

export async function GET(request:Request){try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}const db=(env as unknown as{DB:D1Database}).DB;const result=await db.prepare(`SELECT g.id,g.topic_en AS topicEn,g.topic_dv AS topicDv,g.published_en AS publishedEn,g.published_dv AS publishedDv,g.category_id AS categoryId,cat.name_en AS categoryEn,cat.name_dv AS categoryDv,g.related_story_en_id AS relatedStoryEnId,g.related_story_dv_id AS relatedStoryDvId,g.status,g.published_at AS publishedAt,json_group_array(json_object('id',i.id,'key',i.image_key,'url',i.image_url,'sortOrder',i.sort_order)) AS images FROM galleries g LEFT JOIN categories cat ON cat.id=g.category_id LEFT JOIN gallery_images i ON i.gallery_id=g.id GROUP BY g.id ORDER BY g.updated_at DESC LIMIT 100`).all();return Response.json({items:result.results})}

export async function POST(request:Request){let actor;try{actor=await requireAdmin(request)}catch(error){return authErrorResponse(error)}const body=await request.json().catch(()=>null) as Body|null,problem=validate(body);if(problem)return Response.json({error:{code:"INVALID_GALLERY",message:problem}},{status:400});const runtime=env as unknown as{DB:D1Database;MEDIA:R2Bucket},db=runtime.DB;
  if(!await db.prepare("SELECT 1 FROM categories WHERE id=? AND enabled=1").bind(body!.categoryId).first())return Response.json({error:{code:"INVALID_CATEGORY",message:"Choose an enabled category"}},{status:400});
  for(const storyId of [body!.relatedStoryEnId,body!.relatedStoryDvId])if(storyId&&!await db.prepare("SELECT 1 FROM news_cards WHERE id=? AND status!='archived'").bind(storyId).first())return Response.json({error:{code:"INVALID_STORY",message:"Choose valid related stories"}},{status:400});
  for(const key of body!.imageKeys!)if(!key.startsWith("news/")||!await runtime.MEDIA.head(key))return Response.json({error:{code:"INVALID_IMAGE",message:"One or more images could not be found"}},{status:400});
  const en=body!.topicEn?.trim()||null,dv=body!.topicDv?.trim()||null,published=!!(body!.publishedEn||body!.publishedDv),id=crypto.randomUUID(),now=Date.now();const statements=[db.prepare("INSERT INTO galleries (id,topic,language,topic_en,topic_dv,published_en,published_dv,category_id,related_story_id,related_story_en_id,related_story_dv_id,status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,en||dv,en?"en":"dv",en,dv,body!.publishedEn?1:0,body!.publishedDv?1:0,body!.categoryId,body!.relatedStoryEnId||body!.relatedStoryDvId||null,body!.relatedStoryEnId||null,body!.relatedStoryDvId||null,published?"published":"draft",published?now:null,now,now)];
  body!.imageKeys!.forEach((key,index)=>statements.push(db.prepare("INSERT INTO gallery_images (id,gallery_id,image_key,image_url,sort_order,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),id,key,`/api/v1/media/${key}`,index,now)));
  statements.push(db.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,after,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"gallery.created","gallery",id,JSON.stringify({publishedEn:body!.publishedEn,publishedDv:body!.publishedDv}),now));await db.batch(statements);return Response.json({id},{status:201})}
