import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { extractFeedLinks } from "../../../../lib/ingestion";

export const dynamic = "force-dynamic";

type RuntimeEnv = { DB: D1Database; INGESTION_SECRET?: string };

export async function POST(request: Request) {
  const runtime = env as unknown as RuntimeEnv;
  const user = await getChatGPTUser();
  const secret = request.headers.get("x-ingestion-secret");
  if (!user && (!runtime.INGESTION_SECRET || secret !== runtime.INGESTION_SECRET)) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
  const sources = await runtime.DB.prepare("SELECT id, feed_url AS feedUrl FROM sources WHERE enabled=1 AND feed_url IS NOT NULL AND ingestion_method='rss'").all<{ id: string; feedUrl: string }>();
  const queued: Array<{ sourceId: string; url: string; status: number }> = [];
  for (const source of sources.results) {
    try {
      const feedResponse = await fetch(source.feedUrl, { headers: { "user-agent": "KuruFeethaBot/1.0" } });
      if (!feedResponse.ok) continue;
      const links = extractFeedLinks(await feedResponse.text(), source.feedUrl);
      for (const url of links.slice(0, 10)) {
        const response = await fetch(new URL("/api/v1/admin/ingest", request.url), {
          method: "POST",
          headers: { "content-type": "application/json", ...(runtime.INGESTION_SECRET ? { "x-ingestion-secret": runtime.INGESTION_SECRET } : {}), ...Object.fromEntries([...request.headers].filter(([key]) => key.startsWith("oai-authenticated-"))) },
          body: JSON.stringify({ url }),
        });
        queued.push({ sourceId: source.id, url, status: response.status });
      }
    } catch { /* One publisher must not block the others. */ }
  }
  return Response.json({ sourcesPolled: sources.results.length, articlesProcessed: queued.length, results: queued });
}
