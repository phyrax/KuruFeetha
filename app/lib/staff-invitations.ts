import { createClient } from "@supabase/supabase-js";

export type StaffAuthRuntime={SUPABASE_URL?:string;SUPABASE_SERVICE_ROLE_KEY?:string};

export function normalizeStaffEmail(value:unknown):string|null{
  const email=typeof value==="string"?value.trim().toLowerCase():"";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254?email:null;
}

export async function deliverStaffInvite(runtime:StaffAuthRuntime,email:string,redirectTo:string){
  if(!runtime.SUPABASE_URL||!runtime.SUPABASE_SERVICE_ROLE_KEY)return{ok:false as const,alreadyRegistered:false,error:"Administrator invitations are not configured"};
  const client=createClient(runtime.SUPABASE_URL,runtime.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  const {error}=await client.auth.admin.inviteUserByEmail(email,{redirectTo});
  if(!error)return{ok:true as const,alreadyRegistered:false,error:null};
  const message=error.message||"Invitation delivery failed",alreadyRegistered=/already.{0,20}(registered|exists)|user.{0,20}(registered|exists)/i.test(message);
  return{ok:false as const,alreadyRegistered,error:message.slice(0,500)};
}
