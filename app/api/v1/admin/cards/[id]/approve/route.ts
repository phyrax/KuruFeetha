import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../../lib/auth";
import { sendExpoPush } from "../../../../../../lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { language?: "en" | "dv"; publish?: boolean };
  if (body.language !== "en" && body.language !== "dv") return Response.json({ error: { code: "LANGUAGE_REQUIRED" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database; EXPO_ACCESS_TOKEN?: string };
  const now = Date.now();
  await runtime.DB.prepare("UPDATE news_card_translations SET review_status='approved', reviewed_by=?, reviewed_at=?, updated_at=? WHERE card_id=? AND language=?")
    .bind(user.id, now, now, id, body.language).run();
  const approvals = await runtime.DB.prepare("SELECT language, review_status FROM news_card_translations WHERE card_id=?").bind(id).all<{ language: string; review_status: string }>();
  const bilingual = ["en", "dv"].every((language) => approvals.results.some((row) => row.language === language && row.review_status === "approved"));
  if (body.publish && bilingual) {
    await runtime.DB.prepare("UPDATE news_cards SET status='published', published_at=?, updated_at=? WHERE id=?").bind(now, now, id).run();
    const [translation, devices] = await Promise.all([
      runtime.DB.prepare("SELECT headline, summary FROM news_card_translations WHERE card_id=? AND language='en'").bind(id).first<{ headline: string; summary: string }>(),
      runtime.DB.prepare("SELECT push_token FROM devices WHERE enabled=1").all<{ push_token: string }>(),
    ]);
    if (translation) await sendExpoPush(devices.results.map((device) => device.push_token), { title: translation.headline, body: translation.summary, data: { cardId: id } }, runtime.EXPO_ACCESS_TOKEN).catch(() => undefined);
  }
  else if (bilingual) await runtime.DB.prepare("UPDATE news_cards SET status='approved', updated_at=? WHERE id=?").bind(now, id).run();
  return Response.json({ id, language: body.language, bilingualApproved: bilingual, published: Boolean(body.publish && bilingual) });
}
