import { env } from "cloudflare:workers";
import { authErrorResponse, requireUser } from "../../../../lib/auth";

export const dynamic="force-dynamic";
type ContentType="story"|"gallery";

export async function GET(request:Request){let user;try{user=await requireUser(request)}catch(error){return authErrorResponse(error)}const result=await(env as unknown as{DB:D1Database}).DB.prepare("SELECT content_type AS contentType,content_id AS contentId,created_at AS createdAt FROM content_likes WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all();return Response.json({items:result.results})}

export async function PUT(request:Request){let user;try{user=await requireUser(request)}catch(error){return authErrorResponse(error)}const body=await request.json().catch(()=>null) as{contentType?:ContentType;contentId?:string;liked?:boolean}|null;if(!body?.contentId||!["story","gallery"].includes(body.contentType??"")||typeof body.liked!=="boolean")return Response.json({error:{code:"INVALID_LIKE"}},{status:400});const db=(env as unknown as{DB:D1Database}).DB;const table=body.contentType==="story"?"news_cards":"galleries";if(!await db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND status='published'`).bind(body.contentId).first())return Response.json({error:{code:"CONTENT_NOT_FOUND"}},{status:404});if(body.liked)await db.prepare("INSERT OR IGNORE INTO content_likes (id,user_id,content_type,content_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.id,body.contentType,body.contentId,Date.now()).run();else await db.prepare("DELETE FROM content_likes WHERE user_id=? AND content_type=? AND content_id=?").bind(user.id,body.contentType,body.contentId).run();return Response.json(body)}
