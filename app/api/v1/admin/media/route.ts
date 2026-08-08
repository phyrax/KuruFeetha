import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";
import { detectSupportedImage } from "../../../../lib/images";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: { code: "FILE_REQUIRED", message: "Choose an image" } }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: { code: "FILE_TOO_LARGE", message: "Images must be 8 MB or smaller" } }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image=detectSupportedImage(bytes);
  if (!image) return Response.json({ error: { code: "UNSUPPORTED_IMAGE", message: "Use a JPEG, PNG, WebP, or AVIF image" } }, { status: 415 });
  const key = `news/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${image.extension}`;
  const runtime = env as unknown as { MEDIA: R2Bucket };
  await runtime.MEDIA.put(key, bytes, { httpMetadata: { contentType: image.contentType, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ key, url: `/api/v1/media/${key}` }, { status: 201 });
}

export async function DELETE(request: Request) {
  try { await requireAdmin(request); } catch (error) { return authErrorResponse(error); }
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("news/")) return Response.json({ error: { code: "INVALID_KEY" } }, { status: 400 });
  const runtime = env as unknown as { DB: D1Database; MEDIA: R2Bucket };
  const used = await runtime.DB.prepare("SELECT 1 FROM news_cards WHERE image_key=? UNION ALL SELECT 1 FROM gallery_images WHERE image_key=? UNION ALL SELECT 1 FROM campaigns WHERE image_key=? OR mobile_image_key=? OR desktop_image_key=? LIMIT 1").bind(key,key,key,key,key).first();
  if (used) return Response.json({ error: { code: "IMAGE_IN_USE" } }, { status: 409 });
  await runtime.MEDIA.delete(key); return Response.json({ deleted: true });
}
