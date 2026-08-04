import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the protected manual bilingual CMS and live feed", async () => {
  const [shell,cards,media,feed,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/media/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0003_equal_misty_knight.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Manual CMS/); assert.match(shell,/Publish this language/); assert.match(shell,/60 words/);
  assert.match(cards,/requireAdmin/); assert.match(cards,/imageKey/); assert.match(media,/8 \* 1024 \* 1024/);
  assert.match(feed,/t\.published_at/); assert.match(feed,/t\.review_status = 'published'/); assert.doesNotMatch(feed,/review_status = 'approved'|story_clusters/);
  assert.doesNotMatch(schema,/aiRuns|sourceArticles|jobs =/); assert.match(migration,/DROP TABLE `ai_runs`/);
  await access(new URL("../dist/server/index.js",import.meta.url));
});

test("AI ingestion implementation is absent", async()=>{
  for(const path of ["../app/lib/ai-providers.ts","../app/lib/ingestion.ts","../app/api/v1/admin/ingest/route.ts"]){await assert.rejects(access(new URL(path,import.meta.url)))}
});
