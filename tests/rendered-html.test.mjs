import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the protected manual bilingual CMS and live feed", async () => {
  const [shell,styles,cards,media,feed,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/media/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0003_equal_misty_knight.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Manual CMS/); assert.match(shell,/Publish this language/); assert.match(shell,/60 words/);
  assert.match(shell,/onClick=\{\(\)=>setSelectedCategory\(c\.slug\)\}/); assert.match(shell,/aria-pressed=\{selectedCategory===c\.slug\}/);
  assert.match(shell,/className="nav-label-text"/); assert.match(shell,/aria-label=\{profile\?"Account":"Sign in"\}/);
  assert.match(shell,/language-label/); assert.match(shell,/Switch to English/);
  assert.match(shell,/searchOpen/); assert.match(shell,/aria-expanded=\{searchOpen\}/); assert.match(shell,/Search stories/);
  assert.match(shell,/navigator\.share/); assert.match(shell,/kurufeetha-bookmarks/); assert.match(shell,/\/api\/v1\/me\/bookmarks/);
  assert.match(shell,/view==="saved"/); assert.match(shell,/No saved stories yet/); assert.match(shell,/setView\("saved"\)/);
  assert.doesNotMatch(shell,/<span>\{s\.source\}<\/span>/);
  assert.match(styles,/scroll-snap-type: y mandatory/); assert.match(styles,/\.feed-head \{ display: none; \}/);
  assert.match(styles,/height: calc\(100dvh - 52px\)/); assert.match(styles,/height: 100%; min-height: 100%; max-height: 100%/);
  assert.match(styles,/\.category-rail \{ position: absolute; inset: 52px 0 auto/); assert.match(styles,/linear-gradient\(to bottom, rgba\(8,18,15,\.62\)/);
  assert.match(styles,/\.bottom-nav \.nav-label-text \{ display: none; \}/);
  assert.match(styles,/\.story-meta \{ position: absolute; inset-inline: 18px; top: 32%; transform: translateY\(-50%\)/);
  assert.match(styles,/@font-face \{ font-family: "MV AammuFK"/); assert.match(styles,/@font-face \{ font-family: "MV Typewriter"/);
  assert.match(styles,/\.language-label\.dv \{ font-family: "MV Typewriter"/); assert.match(styles,/\.language-switch::before/);
  assert.match(styles,/\.search\.open \{ position: absolute/); assert.match(styles,/\.search\.open input \{ display: block/);
  assert.match(cards,/requireAdmin/); assert.match(cards,/imageKey/); assert.match(media,/8 \* 1024 \* 1024/);
  assert.match(feed,/t\.published_at/); assert.match(feed,/t\.review_status = 'published'/); assert.doesNotMatch(feed,/review_status = 'approved'|story_clusters/);
  assert.doesNotMatch(schema,/aiRuns|sourceArticles|jobs =/); assert.match(migration,/DROP TABLE `ai_runs`/);
  await access(new URL("../dist/server/index.js",import.meta.url));
  await Promise.all(["MV_AammuFK_Regular.ttf","MV_Typewriter_Regular.ttf","MV_Typewriter_Bold.ttf"].map(name=>access(new URL(`../public/fonts/${name}`,import.meta.url))));
});

test("AI ingestion implementation is absent", async()=>{
  for(const path of ["../app/lib/ai-providers.ts","../app/lib/ingestion.ts","../app/api/v1/admin/ingest/route.ts"]){await assert.rejects(access(new URL(path,import.meta.url)))}
});
