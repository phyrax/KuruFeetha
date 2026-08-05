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
  assert.match(shell,/kurufeetha-language/); assert.match(shell,/languageReady/); assert.match(shell,/localStorage\.setItem\("kurufeetha-language",language\)/);
  assert.match(shell,/searchOpen/); assert.match(shell,/aria-expanded=\{searchOpen\}/); assert.match(shell,/Search stories/);
  assert.match(shell,/navigator\.share/); assert.match(shell,/kurufeetha-bookmarks/); assert.match(shell,/\/api\/v1\/me\/bookmarks/);
  assert.match(shell,/publicationTime/); assert.match(shell,/Intl\.RelativeTimeFormat/); assert.match(shell,/<time dateTime=/);
  assert.match(shell,/މިނިޓް/); assert.match(shell,/ގަޑިއިރު/); assert.match(shell,/ދުވަސް/); assert.match(shell,/ހަފްތާ/); assert.match(shell,/ކުރިން/);
  assert.match(styles,/\.publication-details time/); assert.match(styles,/\.gallery-details time/);
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
  assert.match(styles,/width: min\(280px, 40vw\)/);
  assert.match(cards,/requireAdmin/); assert.match(cards,/imageKey/); assert.match(media,/8 \* 1024 \* 1024/);
  assert.match(feed,/t\.published_at/); assert.match(feed,/t\.review_status = 'published'/); assert.doesNotMatch(feed,/review_status = 'approved'|story_clusters/);
  assert.doesNotMatch(schema,/aiRuns|sourceArticles|jobs =/); assert.match(migration,/DROP TABLE `ai_runs`/);
  await access(new URL("../dist/server/index.js",import.meta.url));
  await Promise.all(["MV_AammuFK_Regular.ttf","MV_Typewriter_Regular.ttf","MV_Typewriter_Bold.ttf"].map(name=>access(new URL(`../public/fonts/${name}`,import.meta.url))));
});

test("AI ingestion implementation is absent", async()=>{
  for(const path of ["../app/lib/ai-providers.ts","../app/lib/ingestion.ts","../app/api/v1/admin/ingest/route.ts"]){await assert.rejects(access(new URL(path,import.meta.url)))}
});

test("ships swipeable bilingual galleries with related story links",async()=>{
  const[shell,styles,publicApi,adminApi,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/galleries/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/galleries/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0005_ordinary_odin.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Photo gallery/);assert.match(shell,/View gallery/);assert.match(shell,/multiple accept=/);assert.match(shell,/gallery-track/);
  assert.match(shell,/Uploading photo/);assert.match(shell,/finally\{setUploading\(false\)/);assert.match(shell,/upload timed out/);
  assert.match(shell,/Upload at least 2 photos before saving/);assert.match(shell,/of at least 2 photos uploaded successfully/);assert.match(shell,/upload-error/);
  assert.match(shell,/prepareGalleryImage/);assert.match(shell,/optimizing large photo/);assert.match(shell,/onDrop=/);assert.match(shell,/drag them here/);
  assert.match(shell,/gallery-slide-bg/);assert.match(shell,/gallery-slide-main/);
  assert.match(shell,/naturalWidth>e\.currentTarget\.naturalHeight/);assert.match(shell,/GallerySlide/);
  assert.match(styles,/scroll-snap-type: x mandatory/);assert.match(styles,/linear-gradient\(to bottom, transparent/);assert.match(styles,/touch-action: pan-x pan-y/);
  assert.match(styles,/\.gallery-slide-bg \{ display: block; object-fit: cover; filter: blur\(26px\)/);assert.match(styles,/\.gallery-slide-main \{ object-fit: contain; \}/);
  assert.match(styles,/\.gallery-slide\.landscape \.gallery-slide-main \{ top: 0; bottom: auto; height: calc\(100% - 170px\)/);
  assert.match(publicApi,/g\.status='published'/);assert.match(adminApi,/requireAdmin/);assert.match(adminApi,/between 2 and 20 different images/);
  assert.match(schema,/galleryImages/);assert.match(schema,/relatedStoryId/);assert.match(migration,/PRAGMA optimize/);
});

test("ships likes, gallery categories, and category-affinity ranking",async()=>{
  const[shell,feed,galleries,likes,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/galleries/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/me/likes/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0006_sour_leopardon.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/toggleLike/);assert.match(shell,/Like story/);assert.match(shell,/Like gallery/);assert.match(shell,/kurufeetha-likes/);
  assert.match(shell,/categoryLikes/);assert.match(shell,/gallery-topline/);assert.match(shell,/Choose a category/);
  assert.match(feed,/content_likes/);assert.match(feed,/ORDER BY followed DESC, affinity DESC/);
  assert.match(galleries,/categoryName/);assert.match(galleries,/ORDER BY affinity DESC/);assert.match(likes,/requireUser/);
  assert.match(schema,/contentLikes/);assert.match(schema,/content_like_user_content_idx/);assert.match(migration,/ALTER TABLE `galleries` ADD `category_id`/);assert.match(migration,/PRAGMA optimize/);
});
