import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the KuruFeetha product shell and live API routes", async () => {
  const [page, shell, ingestion, feed] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/KuruFeethaApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/admin/ingest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /KuruFeethaApp/);
  assert.match(shell, /Maldives, in brief/);
  assert.match(shell, /api\/v1\/admin\/ingest/);
  assert.match(ingestion, /generateWithFallback/);
  assert.match(feed, /review_status = 'approved'/);
  await access(new URL("../dist/server/index.js", import.meta.url));
});
