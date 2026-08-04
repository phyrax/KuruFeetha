import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = env as unknown as { DB: D1Database };
  const result = await runtime.DB.prepare("SELECT id, slug, name_en AS nameEn, name_dv AS nameDv FROM categories WHERE enabled=1 ORDER BY sort_order, name_en").all();
  return Response.json({ items: result.results });
}
