import { env } from "cloudflare:workers";
import { authErrorResponse, requireUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const runtime = env as unknown as { DB: D1Database };
  const result = await runtime.DB.prepare("SELECT card_id AS cardId, created_at AS createdAt FROM bookmarks WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all();
  return Response.json({ items: result.results });
}

export async function PUT(request: Request) {
  let user;
  try { user = await requireUser(request); } catch (error) { return authErrorResponse(error); }
  const body = await request.json().catch(() => null) as { cardId?: string; saved?: boolean } | null;
  if (!body?.cardId || typeof body.saved !== "boolean") return Response.json({ error: { code: "INVALID_BOOKMARK" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database };
  if (body.saved) await runtime.DB.prepare("INSERT OR IGNORE INTO bookmarks (user_id,card_id,created_at) VALUES (?,?,?)").bind(user.id, body.cardId, Date.now()).run();
  else await runtime.DB.prepare("DELETE FROM bookmarks WHERE user_id=? AND card_id=?").bind(user.id, body.cardId).run();
  return Response.json({ cardId: body.cardId, saved: body.saved });
}
