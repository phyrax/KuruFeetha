import { env } from "cloudflare:workers";
import { authErrorResponse,requireOwner } from "../../../../../lib/auth";
import { deliverStaffInvite,normalizeStaffEmail,type StaffAuthRuntime } from "../../../../../lib/staff-invitations";
export const dynamic="force-dynamic";
type Runtime=StaffAuthRuntime&{DB:D1Database};

export async function POST(request:Request){
  let actor;try{actor=await requireOwner(request)}catch(error){return authErrorResponse(error)}
  const body=await request.json().catch(()=>null) as {email?:string}|null,email=normalizeStaffEmail(body?.email);
  if(!email)return Response.json({error:{code:"INVALID_EMAIL",message:"Enter a valid email address"}},{status:400});
  const runtime=env as unknown as Runtime,existing=await runtime.DB.prepare("SELECT id,role,status FROM users WHERE email=?").bind(email).first<{id:string;role:"reader"|"admin"|"owner";status:"active"|"suspended"}>(),now=Date.now();
  if(existing?.status==="suspended")return Response.json({error:{code:"SUSPENDED_USER",message:"Restore this account before granting administrator access"}},{status:409});
  if(existing?.role==="admin"||existing?.role==="owner")return Response.json({outcome:"already_admin",userId:existing.id});
  if(existing){
    await runtime.DB.batch([
      runtime.DB.prepare("UPDATE users SET role='admin',updated_at=? WHERE id=? AND role='reader'").bind(now,existing.id),
      runtime.DB.prepare("UPDATE staff_invitations SET status='accepted',accepted_at=?,updated_at=? WHERE email=? AND status='pending'").bind(now,now,email),
      runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before,after,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"user.promoted_to_admin","user",existing.id,JSON.stringify({role:"reader"}),JSON.stringify({role:"admin"}),now),
    ]);
    return Response.json({outcome:"promoted_existing",userId:existing.id});
  }
  const invitationId=crypto.randomUUID();
  await runtime.DB.prepare(`INSERT INTO staff_invitations(id,email,status,invited_by,created_at,updated_at) VALUES(?,?,'delivery_failed',?,?,?)
    ON CONFLICT(email) DO UPDATE SET id=excluded.id,status='delivery_failed',invited_by=excluded.invited_by,delivered_at=NULL,accepted_at=NULL,revoked_at=NULL,delivery_error=NULL,updated_at=excluded.updated_at`).bind(invitationId,email,actor.id,now,now).run();
  const delivery=await deliverStaffInvite(runtime,email,`${new URL(request.url).origin}/?staff=invited`);
  if(delivery.ok||delivery.alreadyRegistered){
    await runtime.DB.batch([
      runtime.DB.prepare("UPDATE staff_invitations SET status='pending',delivered_at=?,delivery_error=NULL,updated_at=? WHERE id=?").bind(delivery.ok?now:null,now,invitationId),
      runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"staff.invitation_created","staff_invitation",invitationId,JSON.stringify({email,delivery:delivery.ok?"sent":"existing_auth_account"}),now),
    ]);
    return Response.json({outcome:"invited",invitationId,delivery:delivery.ok?"sent":"existing_auth_account"},{status:201});
  }
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE staff_invitations SET status='delivery_failed',delivery_error=?,updated_at=? WHERE id=?").bind(delivery.error,now,invitationId),
    runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,"staff.invitation_delivery_failed","staff_invitation",invitationId,JSON.stringify({email}),now),
  ]);
  return Response.json({outcome:"delivery_failed",error:{code:"DELIVERY_FAILED",message:delivery.error}},{status:502});
}
