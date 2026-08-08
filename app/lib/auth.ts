import { env } from "cloudflare:workers";

export type AppRole = "reader" | "admin" | "owner";
export type AppUser = {
  id: string;
  authSubject: string | null;
  email: string;
  displayName: string | null;
  role: AppRole;
  status: "active" | "suspended";
  preferredLanguage: "en" | "dv";
  notifyBreaking: boolean;
  notifyImportant: boolean;
  onboardingCompletedAt: number | null;
};

type RuntimeEnv = {
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  OWNER_EMAIL?: string;
};

type SupabaseIdentity = { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: { full_name?: string; name?: string } };

export class AuthError extends Error {
  constructor(public status: 401 | 403 | 503, public code: string, message: string) { super(message); }
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  throw error;
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

async function verifySupabaseToken(request: Request, runtime: RuntimeEnv): Promise<SupabaseIdentity | null> {
  const token = bearerToken(request);
  if (!token) return null;
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_ANON_KEY) throw new AuthError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured");
  const response = await fetch(`${runtime.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: runtime.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new AuthError(401, "INVALID_SESSION", "Your session is invalid or expired");
  return response.json() as Promise<SupabaseIdentity>;
}

export async function optionalUser(request: Request): Promise<AppUser | null> {
  const runtime = env as unknown as RuntimeEnv;
  const identity = await verifySupabaseToken(request, runtime);
  if (!identity) return null;
  if (!identity.email) throw new AuthError(403, "EMAIL_REQUIRED", "A verified email address is required");
  if (!identity.email_confirmed_at) throw new AuthError(403, "EMAIL_NOT_VERIFIED", "Verify your email address before signing in");
  const now = Date.now();
  const ownerEmail = (runtime.OWNER_EMAIL || "hussainfiraz@gmail.com").toLowerCase();
  const role: AppRole = identity.email.toLowerCase() === ownerEmail ? "owner" : "reader";
  const displayName = identity.user_metadata?.full_name || identity.user_metadata?.name || identity.email.split("@")[0];
  await runtime.DB.prepare(`INSERT INTO users (id,auth_subject,email,display_name,role,status,preferred_language,last_active_at,created_at,updated_at)
    VALUES (?,?,?,?,?,'active','en',?,?,?)
    ON CONFLICT DO UPDATE SET auth_subject=excluded.auth_subject, email=excluded.email, display_name=excluded.display_name,
      role=CASE WHEN users.role='owner' THEN 'owner' ELSE users.role END, last_active_at=excluded.last_active_at, updated_at=excluded.updated_at`)
    .bind(identity.id, identity.id, identity.email.toLowerCase(), displayName, role, now, now, now).run();
  const user = await runtime.DB.prepare(`SELECT id, auth_subject AS authSubject, email, display_name AS displayName, role, status,
    preferred_language AS preferredLanguage, notify_breaking AS notifyBreaking, notify_important AS notifyImportant,
    onboarding_completed_at AS onboardingCompletedAt FROM users WHERE auth_subject=?`)
    .bind(identity.id).first<AppUser>();
  if (!user) throw new AuthError(401, "PROFILE_UNAVAILABLE", "Could not load your profile");
  if (user.status === "suspended") throw new AuthError(403, "ACCOUNT_SUSPENDED", "This account is suspended");
  if(user.role==="reader"){
    const invitation=await runtime.DB.prepare("SELECT id,invited_by AS invitedBy FROM staff_invitations WHERE email=? AND status='pending' LIMIT 1").bind(user.email.toLowerCase()).first<{id:string;invitedBy:string}>();
    if(invitation){
      await runtime.DB.batch([
        runtime.DB.prepare("UPDATE users SET role='admin',updated_at=? WHERE id=? AND role='reader' AND status='active'").bind(now,user.id),
        runtime.DB.prepare("UPDATE staff_invitations SET status='accepted',accepted_at=?,updated_at=? WHERE id=? AND status='pending'").bind(now,now,invitation.id),
        runtime.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),invitation.invitedBy,"staff.invitation_accepted","user",user.id,JSON.stringify({email:user.email,role:"admin"}),now),
      ]);
      user.role="admin";
    }
  }
  return user;
}

export async function requireUser(request: Request): Promise<AppUser> {
  const user = await optionalUser(request);
  if (!user) throw new AuthError(401, "AUTH_REQUIRED", "Sign in to continue");
  return user;
}

export async function requireAdmin(request: Request): Promise<AppUser> {
  const user = await requireUser(request);
  if (user.role !== "admin" && user.role !== "owner") throw new AuthError(403, "ADMIN_REQUIRED", "Administrator access is required");
  return user;
}

export async function requireOwner(request: Request): Promise<AppUser> {
  const user = await requireUser(request);
  if (user.role !== "owner") throw new AuthError(403, "OWNER_REQUIRED", "Owner access is required");
  return user;
}
