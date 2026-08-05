import { env } from "cloudflare:workers";
import { authErrorResponse, requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

type RuntimeEnv = { DB: D1Database; SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export async function GET(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const runtime = env as unknown as RuntimeEnv;
  const follows = await runtime.DB.prepare("SELECT category_id AS categoryId FROM category_follows WHERE user_id=?").bind(user.id).all<{ categoryId: string }>();
  return Response.json({ user, followedCategoryIds: follows.results.map((item) => item.categoryId) });
}

export async function PATCH(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => ({})) as { preferredLanguage?: "en" | "dv"; displayName?: string; onboardingComplete?: boolean; notifyBreaking?: boolean; notifyImportant?: boolean };
  if (body.preferredLanguage && !["en", "dv"].includes(body.preferredLanguage)) return Response.json({ error: { code: "INVALID_LANGUAGE" } }, { status: 400 });
  const runtime = env as unknown as RuntimeEnv;
  const now = Date.now();
  await runtime.DB.prepare(`UPDATE users SET preferred_language=COALESCE(?,preferred_language), display_name=COALESCE(?,display_name),
    notify_breaking=COALESCE(?,notify_breaking), notify_important=COALESCE(?,notify_important),
    onboarding_completed_at=CASE WHEN ?=1 THEN COALESCE(onboarding_completed_at,?) ELSE onboarding_completed_at END, updated_at=? WHERE id=?`)
    .bind(body.preferredLanguage ?? null, body.displayName?.trim().slice(0, 80) || null,typeof body.notifyBreaking==="boolean"?(body.notifyBreaking?1:0):null,typeof body.notifyImportant==="boolean"?(body.notifyImportant?1:0):null,body.onboardingComplete ? 1 : 0, now, now, user.id).run();
  return GET(request);
}

export async function DELETE(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  if (user.role === "owner") return Response.json({ error: { code: "OWNER_IMMUTABLE", message: "The owner account cannot be deleted" } }, { status: 403 });
  if (!user.authSubject) return Response.json({ error: { code: "IDENTITY_UNAVAILABLE", message: "This legacy account has no identity subject" } }, { status: 409 });
  const runtime = env as unknown as RuntimeEnv;
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: { code: "DELETION_NOT_CONFIGURED", message: "Account deletion is not configured" } }, { status: 503 });
  const deletion = await fetch(`${runtime.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(user.authSubject)}`, {
    method: "DELETE", headers: { apikey: runtime.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${runtime.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!deletion.ok) return Response.json({ error: { code: "IDENTITY_DELETION_FAILED", message: "Could not delete the identity account" } }, { status: 502 });
  await runtime.DB.batch([
    runtime.DB.prepare("DELETE FROM category_follows WHERE user_id=?").bind(user.id),
    runtime.DB.prepare("DELETE FROM bookmarks WHERE user_id=?").bind(user.id),
    runtime.DB.prepare("DELETE FROM devices WHERE user_id=?").bind(user.id),
    runtime.DB.prepare("UPDATE audit_events SET actor_id=NULL WHERE actor_id=?").bind(user.id),
    runtime.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id),
  ]);
  return Response.json({ deleted: true });
}
