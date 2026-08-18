import {env} from "cloudflare:workers";
import {authErrorResponse,requireAdmin} from "../../../../../../lib/auth";
import {ContentTypeUpdateError,parseContentTypeUpdate,updateContentTypeOnly} from "../../../../../../lib/content-type-update";

export const dynamic="force-dynamic";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  let actor;try{actor=await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const{id}=await context.params,body=await request.json().catch(()=>null);
  try{
    const input=parseContentTypeUpdate(body,id),result=await updateContentTypeOnly((env as unknown as{DB:D1Database}).DB,input,actor.id);
    return Response.json(result);
  }catch(error){
    if(error instanceof ContentTypeUpdateError)return Response.json({error:{code:error.code,message:error.message}},{status:error.status});
    throw error;
  }
}
