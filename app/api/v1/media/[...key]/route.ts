import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const object = await (env as unknown as { MEDIA: R2Bucket }).MEDIA.get(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
