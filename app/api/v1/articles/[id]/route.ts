import { env } from "cloudflare:workers";
import { getPublicArticle } from "../../../../lib/articles";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;const language=new URL(request.url).searchParams.get("language")==="dv"?"dv":"en";const article=await getPublicArticle((env as unknown as{DB:D1Database}).DB,id,language);if(!article)return Response.json({error:{code:"NOT_FOUND",message:"Article not found"}},{status:404});return Response.json(article,{headers:{"cache-control":"no-store"}})}
