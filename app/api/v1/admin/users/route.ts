import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let actor;
  try { actor = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const url = new URL(request.url);
  const search = `%${(url.searchParams.get("search") ?? "").slice(0, 80)}%`;
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");
  const runtime = env as unknown as { DB: D1Database };
  const [result,invitations] = await Promise.all([runtime.DB.prepare(`SELECT id,email,display_name AS displayName,role,status,preferred_language AS preferredLanguage,
    created_at AS createdAt,last_active_at AS lastActiveAt FROM users
    WHERE (email LIKE ? OR COALESCE(display_name,'') LIKE ?) AND (? IS NULL OR role=?) AND (? IS NULL OR status=?)
    ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at DESC LIMIT 100`)
    .bind(search, search, ["reader", "admin", "owner"].includes(role ?? "") ? role : null, role, ["active", "suspended"].includes(status ?? "") ? status : null, status).all(),runtime.DB.prepare(`SELECT i.id,i.email,i.status,i.delivered_at AS deliveredAt,i.created_at AS createdAt,i.updated_at AS updatedAt,u.email AS invitedByEmail
      FROM staff_invitations i JOIN users u ON u.id=i.invited_by WHERE i.status IN ('pending','delivery_failed') AND i.email LIKE ? ORDER BY i.created_at DESC LIMIT 100`).bind(search).all()]);
  return Response.json({ actorRole: actor.role, items: result.results, invitations: invitations.results });
}
