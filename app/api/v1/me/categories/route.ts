import { env } from "cloudflare:workers";
import { authErrorResponse, requireUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => null) as { categoryIds?: string[] } | null;
  if (!Array.isArray(body?.categoryIds) || body.categoryIds.length > 20 || body.categoryIds.some((id) => typeof id !== "string" || id.length > 80)) {
    return Response.json({ error: { code: "INVALID_CATEGORIES" } }, { status: 400 });
  }
  const ids = [...new Set(body.categoryIds)];
  const runtime = env as unknown as { DB: D1Database };
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const valid = await runtime.DB.prepare(`SELECT id FROM categories WHERE enabled=1 AND id IN (${placeholders})`).bind(...ids).all<{ id: string }>();
    if (valid.results.length !== ids.length) return Response.json({ error: { code: "UNKNOWN_CATEGORY" } }, { status: 400 });
  }
  const now = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare("DELETE FROM category_follows WHERE user_id=?").bind(user.id),
    ...ids.map((id) => runtime.DB.prepare("INSERT INTO category_follows (user_id,category_id,created_at) VALUES (?,?,?)").bind(user.id, id, now)),
    runtime.DB.prepare("UPDATE users SET onboarding_completed_at=COALESCE(onboarding_completed_at,?), updated_at=? WHERE id=?").bind(now, now, user.id),
  ]);
  return Response.json({ followedCategoryIds: ids, user: { ...user, onboardingCompletedAt: user.onboardingCompletedAt ?? now } });
}
