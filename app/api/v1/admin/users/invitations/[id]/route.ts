import { env } from "cloudflare:workers";
import { authErrorResponse,requireOwner } from "../../../../../../lib/auth";
import { deliverStaffInvite,type StaffAuthRuntime } from "../../../../../../lib/staff-invitations";
export const dynamic="force-dynamic";
type Runtime=StaffAuthRuntime&{DB:D1Database};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  let actor;try{actor=await requireOwner(request)}catch(error){return authErrorResponse(error)}
  const{id}=await params,runtime=env as unknown as Runtime,invite=await runtime.DB.prepare("SELECT id,email,status FROM staff_invitations WHERE id=?").bind(id).first<{id:string;email:string;status:string}>();
  if(!invite)return Response.json({error:{code:"INVITATION_NOT_FOUND"}},{status:404});
  if(!["pending","delivery_failed"].includes(invite.status))return Response.json({error:{code:"INVITATION_NOT_PENDING",message:"Only pending invitations can be resent"}},{status:409});
  const now=Date.now(),delivery=await deliverStaffInvite(runtime,invite.email,`${new URL(request.url).origin}/?staff=invited`);
  if(!delivery.ok&&!delivery.alreadyRegistered){await runtime.DB.prepare("UPDATE staff_invitations SET status='delivery_failed',delivery_error=?,updated_at=? WHERE id=?").bind(delivery.error,now,id).run();return Response.json({outcome:"delivery_failed",error:{code:"DELIVERY_FAILED",message:delivery.error}},{status:502})}
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE staff_invitations SET status='pending',delivered_at=?,delivery_error=NULL,updated_at=? WHERE id=?").bind(delivery.ok?now:null,now,id),
    runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"staff.invitation_resent","staff_invitation",id,JSON.stringify({email:invite.email,delivery:delivery.ok?"sent":"existing_auth_account"}),now),
  ]);
  return Response.json({outcome:"invited",delivery:delivery.ok?"sent":"existing_auth_account"});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  let actor;try{actor=await requireOwner(request)}catch(error){return authErrorResponse(error)}
  const{id}=await params,runtime=env as unknown as Runtime,invite=await runtime.DB.prepare("SELECT id,email,status FROM staff_invitations WHERE id=?").bind(id).first<{id:string;email:string;status:string}>();
  if(!invite)return Response.json({error:{code:"INVITATION_NOT_FOUND"}},{status:404});
  if(invite.status==="accepted")return Response.json({error:{code:"INVITATION_ACCEPTED",message:"Demote the administrator from the user list instead"}},{status:409});
  const now=Date.now();await runtime.DB.batch([
    runtime.DB.prepare("UPDATE staff_invitations SET status='revoked',revoked_at=?,updated_at=? WHERE id=?").bind(now,now,id),
    runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"staff.invitation_revoked","staff_invitation",id,JSON.stringify({email:invite.email}),now),
  ]);return Response.json({id,status:"revoked"});
}
