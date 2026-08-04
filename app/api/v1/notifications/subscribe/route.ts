import { env } from "cloudflare:workers";
import { authErrorResponse, requireUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => null) as { token?: string; platform?: "web" | "ios" | "android"; language?: "en" | "dv"; topics?: string[] } | null;
  if (!body?.token || !body.platform) return Response.json({ error: { code: "INVALID_SUBSCRIPTION" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database };
  const now = Date.now();
  await runtime.DB.prepare(`INSERT INTO devices (id,user_id,platform,push_token,language,topics,enabled,created_at,updated_at)
    VALUES (?,?,?,?,?,?,1,?,?) ON CONFLICT(push_token) DO UPDATE SET user_id=excluded.user_id, language=excluded.language, topics=excluded.topics, enabled=1, updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(), user.id, body.platform, body.token, body.language ?? "en", JSON.stringify(body.topics ?? []), now, now).run();
  return Response.json({ subscribed: true });
}
