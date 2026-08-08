import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor;
  try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { role?: "reader" | "admin"; status?: "active" | "suspended" };
  if (!body.role && !body.status) return Response.json({ error: { code: "NO_CHANGES" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database };
  const target = await runtime.DB.prepare("SELECT id,email,role,status FROM users WHERE id=?").bind(id).first<{ id: string; email: string; role: "reader" | "admin" | "owner"; status: "active" | "suspended" }>();
  if (!target) return Response.json({ error: { code: "USER_NOT_FOUND" } }, { status: 404 });
  if (target.role === "owner" || target.id === actor.id) return Response.json({ error: { code: "PROTECTED_ACCOUNT", message: "This account cannot be changed" } }, { status: 403 });
  if (body.role && actor.role !== "owner") return Response.json({ error: { code: "OWNER_REQUIRED" } }, { status: 403 });
  if (target.role === "admin" && actor.role !== "owner") return Response.json({ error: { code: "OWNER_REQUIRED" } }, { status: 403 });
  if (body.status && !["active", "suspended"].includes(body.status)) return Response.json({ error: { code: "INVALID_STATUS" } }, { status: 400 });
  if (body.role && !["reader", "admin"].includes(body.role)) return Response.json({ error: { code: "INVALID_ROLE" } }, { status: 400 });
  const now = Date.now();
  const next = { role: body.role ?? target.role, status: body.status ?? target.status };
  const statements = [
    runtime.DB.prepare("UPDATE users SET role=?,status=?,updated_at=? WHERE id=?").bind(next.role, next.status, now, id),
    runtime.DB.prepare("INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), actor.id, "user.access_updated", "user", id, JSON.stringify({ role: target.role, status: target.status }), JSON.stringify(next), now),
  ];
  if (body.role === "admin") statements.push(runtime.DB.prepare("UPDATE staff_invitations SET status='accepted',accepted_at=?,updated_at=? WHERE email=? AND status='pending'").bind(now,now,target.email));
  await runtime.DB.batch(statements);
  return Response.json({ id, ...next });
}
