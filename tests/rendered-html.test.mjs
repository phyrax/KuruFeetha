import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {freshnessGroup,maldivesDay} from "../app/lib/feed-ranking.ts";
import {detectSupportedImage} from "../app/lib/images.ts";
import {youtubeVideoId} from "../app/lib/youtube.ts";
import {articleSitemap,escapeXml,newsSitemap,publicSitemap,robotsResponse,sitemapIndex,sitemapSettings} from "../worker/seo-sitemaps.ts";

test("serves canonical scalable production sitemaps and robots directives",async()=>{
  const fakeDb={prepare(sql){const statement={bind(){return statement},async first(){return sql.includes("COUNT(*)")?{count:2}:null},async all(){if(sql.includes("FROM categories"))return{results:[{slug:"politics & law"}]};if(sql.includes("SELECT DISTINCT c.id"))return{results:[{id:"article-1",language:"en",modifiedAt:1723352400000},{id:"article-2",language:"dv",modifiedAt:1723352500000}]};return{results:[]}}};return statement}};
  const index=await sitemapIndex(fakeDb),publicXml=await publicSitemap(fakeDb),articles=await articleSitemap(fakeDb,1),robots=robotsResponse();
  assert.equal(index.status,200);assert.equal(index.headers.get("content-type"),"application/xml; charset=utf-8");assert.match(await index.text(),/<sitemapindex[^>]*>[\s\S]*https:\/\/kurufeetha\.com\/sitemaps\/public\.xml[\s\S]*articles-1\.xml/);
  const publicBody=await publicXml.text(),articleBody=await articles.text(),locations=[...publicBody.matchAll(/<loc>([^<]+)<\/loc>/g),...articleBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);assert.match(publicBody,/https:\/\/kurufeetha\.com\/<\/loc>/);assert.match(publicBody,/politics%20%26%20law/);assert.ok(locations.every(location=>location.startsWith("https://kurufeetha.com")&&!location.includes("www.")&&!location.includes("workers.dev")&&!location.includes("/api/")));
  assert.match(articleBody,/https:\/\/kurufeetha\.com\/en\/article\/article-1/);assert.match(articleBody,/<lastmod>2024-08-11T05:00:00\.000Z<\/lastmod>/);assert.doesNotMatch(articleBody,/draft/);
  assert.equal(escapeXml(`<&>'"`),"&lt;&amp;&gt;&apos;&quot;");assert.equal(sitemapSettings.articleChunkSize,10_000);
  const robotsBody=await robots.text();assert.match(robotsBody,/User-agent: \*/i);assert.match(robotsBody,/Allow: \//);assert.match(robotsBody,/Allow: \/api\/v1\/media\//);assert.match(robotsBody,/Disallow: \/api\//);assert.match(robotsBody,/Sitemap: https:\/\/kurufeetha\.com\/sitemap\.xml/);assert.doesNotMatch(robotsBody,/Disallow: \/$/m);
});

test("serves a fresh, published-only Google News sitemap",async()=>{
  const now=1_723_600_000_000,boundValues=[];let newsQuery="";
  const fakeDb={prepare(sql){newsQuery=sql;const statement={bind(...values){boundValues.push(...values);return statement},async all(){return{results:[
    {id:"english-story",language:"en",headline:"Markets & <weather>",publicationDate:now-60_000},
    {id:"ދިވެހި",language:"dv",headline:"ރާއްޖޭގެ & ޚަބަރު",publicationDate:now-120_000},
  ]}}};return statement}};
  const response=await newsSitemap(fakeDb,now),xml=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"application/xml; charset=utf-8");
  assert.match(xml,/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);assert.match(xml,/xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);
  assert.match(newsQuery,/c\.status='published'/);assert.match(newsQuery,/t\.review_status='published'/);assert.match(newsQuery,/t\.article_status='published'/);assert.match(newsQuery,/t\.article_content IS NOT NULL/);assert.match(newsQuery,/t\.article_published_at IS NOT NULL/);
  assert.match(newsQuery,/t\.language IN \('en','dv'\)/);assert.match(newsQuery,/t\.article_published_at>=\?/);assert.match(newsQuery,/t\.article_published_at<=\?/);assert.match(newsQuery,/LIMIT \?/);
  assert.deepEqual(boundValues,[now-sitemapSettings.newsFreshnessWindowMs,now,sitemapSettings.newsSitemapLimit]);assert.equal(sitemapSettings.newsSitemapLimit,1_000);
  assert.match(xml,/<loc>https:\/\/kurufeetha\.com\/en\/article\/english-story<\/loc>/);assert.match(xml,/<news:language>en<\/news:language>/);assert.match(xml,/<news:language>dv<\/news:language>/);
  assert.match(xml,/<news:publication_date>2024-08-14T01:45:40\.000Z<\/news:publication_date>/);assert.match(xml,/<news:title>Markets &amp; &lt;weather&gt;<\/news:title>/);assert.match(xml,/<news:name>Kurufeetha<\/news:name>/);
  const locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);assert.ok(locations.every(location=>location.startsWith("https://kurufeetha.com/")&&!location.includes("www.")&&!location.includes("workers.dev")&&!location.includes("/api/")&&!location.includes("draft")&&!location.includes("preview")));assert.equal((xml.match(/<url>/g)||[]).length,2);
  const robots=await robotsResponse().text();assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/sitemap\.xml/);assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/news-sitemap\.xml/);
});

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
  assert.match(shell,/Manual CMS/); assert.match(shell,/Publish this card language/); assert.match(shell,/70 words/);
  assert.match(shell,/CmsDateControls/); assert.match(shell,/Last 7 days/); assert.match(shell,/This month/); assert.match(shell,/type="month"/);
  assert.match(shell,/cmsDateLabel/); assert.match(shell,/matchesCmsDate/); assert.match(shell,/Published \$\{cmsDateLabel/);
  assert.match(shell,/onClick=\{\(\)=>setSelectedCategory\(c\.slug\)\}/); assert.match(shell,/aria-pressed=\{selectedCategory===c\.slug\}/);
  assert.match(shell,/className="nav-label-text"/); assert.match(shell,/aria-current=\{view==="feed"\?"page":undefined\}/); assert.match(shell,/aria-current=\{accountOpen\?"page":undefined\}/);
  assert.match(shell,/language-label/); assert.match(shell,/Switch to English/);
  assert.match(shell,/Welcome back/); assert.match(shell,/Continue with Google/); assert.match(shell,/Send sign-in link/); assert.match(shell,/password-free link/);
  assert.match(shell,/account-panel[\s\S]*dir="ltr"/);
  assert.match(styles,/\.auth-panel/); assert.match(styles,/\.google-signin/); assert.match(styles,/\.auth-divider/); assert.match(styles,/\.email-signin input:focus/);
  assert.match(shell,/kurufeetha-language/); assert.match(shell,/languageReady/); assert.match(shell,/localStorage\.setItem\("kurufeetha-language",language\)/);
  assert.match(shell,/searchOpen/); assert.match(shell,/aria-expanded=\{searchOpen\}/); assert.match(shell,/Search stories/);
  assert.match(shell,/navigator\.share/); assert.match(shell,/kurufeetha-bookmarks/); assert.match(shell,/\/api\/v1\/me\/bookmarks/);
  assert.match(shell,/publicationTime/); assert.match(shell,/Intl\.RelativeTimeFormat/); assert.match(shell,/<time dateTime=/);
  assert.match(shell,/މިނިޓް/); assert.match(shell,/ގަޑިއިރު/); assert.match(shell,/ދުވަސް/); assert.match(shell,/ހަފްތާ/); assert.match(shell,/ކުރިން/);
  assert.match(styles,/\.publication-details time/); assert.match(styles,/\.gallery-details time/);
  assert.match(shell,/view==="saved"/); assert.match(shell,/No saved stories yet/); assert.match(shell,/setView\("saved"\)/);
  assert.match(shell,/randomizedCardOrder/); assert.match(shell,/feedSeed/);
  assert.match(shell,/setView\("latest"\)/); assert.match(shell,/view==="saved"\|\|view==="latest"\?b\.publishedAt-a\.publishedAt/); assert.match(shell,/Latest/);
  assert.match(shell,/matchMedia\("\(max-width: 760px\)"\)/); assert.match(shell,/scrollTo\(\{top:0,behavior:"auto"\}\)/);
  assert.match(shell,/New stories are available/); assert.match(shell,/newContentAvailable/); assert.match(shell,/setInterval\(check,15_000\)/);
  assert.match(shell,/cache:"no-store"/); assert.match(shell,/setFeedRenderKey\(key=>key\+1\)/); assert.match(shell,/className="story-feed" key=\{feedRenderKey\}/);
  assert.match(shell,/kurufeetha-seen-content/); assert.match(shell,/IntersectionObserver/); assert.match(shell,/data-content-key/);
  assert.match(styles,/\.new-content-alert/); assert.match(styles,/\.new-content-alert button/); assert.match(styles,/\[dir="rtl"\] \.new-content-alert[\s\S]*font-family: "MV AammuFK"/);
  assert.doesNotMatch(shell,/<span>\{s\.source\}<\/span>/);
  assert.match(styles,/scroll-snap-type: y mandatory/); assert.match(styles,/\.feed-head \{ display: none; \}/);
  assert.match(styles,/height: calc\(100dvh - 52px\)/); assert.match(styles,/height: 100%; min-height: 100%; max-height: 100%/);
  assert.match(styles,/\.category-rail \{ position: absolute; inset: 52px 0 auto/); assert.match(styles,/linear-gradient\(to bottom, rgba\(8,18,15,\.62\)/);
  assert.match(styles,/\.bottom-nav \.nav-label-text \{ display: block;/); assert.match(styles,/\.bottom-nav button\.active::before/);
  assert.match(styles,/\.story-meta \{ position: absolute; inset-inline: 18px; top: 32%; transform: translateY\(-50%\)/);
  assert.match(styles,/@font-face \{ font-family: "MV AammuFK"/); assert.match(styles,/@font-face \{ font-family: "MV Typewriter"/);
  assert.match(styles,/\[dir="rtl"\] \.topbar \.brand small \{ font-family: "MV Typewriter"/);
  assert.match(styles,/\[dir="rtl"\] \.search input::placeholder \{ font-family: "MV Typewriter"/);
  assert.match(styles,/\.cms-form fieldset\[dir="rtl"\] \.rich-canvas,[\s\S]*font-family: "MV Typewriter"/);
  assert.match(styles,/\.language-label\.dv \{ font-family: "MV Typewriter"/); assert.match(styles,/\.language-switch::before/);
  assert.match(styles,/\.search\.open \{ position: absolute/); assert.match(styles,/\.search\.open input \{ display: block/);
  assert.match(styles,/width: min\(280px, 40vw\)/);
  assert.match(cards,/requireAdmin/); assert.match(cards,/imageKey/); assert.match(media,/8 \* 1024 \* 1024/); assert.match(media,/image\.contentType/);
  assert.match(feed,/t\.published_at/); assert.match(feed,/t\.review_status = 'published'/); assert.doesNotMatch(feed,/review_status = 'approved'|story_clusters/);
  assert.doesNotMatch(schema,/aiRuns|sourceArticles|jobs =/); assert.match(migration,/DROP TABLE `ai_runs`/);
  await access(new URL("../dist/server/index.js",import.meta.url));
  await Promise.all(["MV_AammuFK_Regular.ttf","MV_Typewriter_Regular.ttf","MV_Typewriter_Bold.ttf"].map(name=>access(new URL(`../public/fonts/${name}`,import.meta.url))));
});

test("accepts genuine AVIF uploads throughout the CMS",async()=>{
  const[shell,campaigns,media]=await Promise.all([readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/components/CampaignManager.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/media/route.ts",import.meta.url),"utf8")]);
  const avif=new Uint8Array([0,0,0,24,102,116,121,112,97,118,105,102,0,0,0,0,97,118,105,102,109,105,102,49]);
  const disguised=new Uint8Array([0,0,0,16,102,116,121,112,104,101,105,99,0,0,0,0]);
  assert.deepEqual(detectSupportedImage(avif),{contentType:"image/avif",extension:"avif"});assert.equal(detectSupportedImage(disguised),null);
  assert.match(shell,/image\/avif/);assert.match(shell,/\.avif/);assert.match(shell,/WebP or AVIF/);assert.match(campaigns,/image\/avif/);
  assert.match(media,/detectSupportedImage/);assert.match(media,/JPEG, PNG, WebP, or AVIF/);
});

test("AI ingestion implementation is absent", async()=>{
  for(const path of ["../app/lib/ai-providers.ts","../app/lib/ingestion.ts","../app/api/v1/admin/ingest/route.ts"]){await assert.rejects(access(new URL(path,import.meta.url)))}
});

test("supports safe YouTube videos as card visuals",async()=>{
  const[shell,styles,feed,admin,update,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/[id]/route.ts",import.meta.url),"utf8"),readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),readFile(new URL("../drizzle/0016_add_youtube_card_visual.sql",import.meta.url),"utf8")]);
  assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"),"dQw4w9WgXcQ");
  assert.equal(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),"dQw4w9WgXcQ");
  assert.equal(youtubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"),null);
  assert.match(shell,/YouTube video URL/);assert.match(shell,/YouTubeCardVisual/);assert.match(shell,/youtubeVideoId\?<YouTubeCardVisual/);
  assert.match(styles,/\.story-youtube iframe/);assert.match(feed,/youtube_video_id AS youtubeVideoId/);
  assert.match(admin,/INVALID_YOUTUBE_URL/);assert.match(update,/youtube_video_id=CASE/);assert.match(schema,/youtubeVideoId/);assert.match(migration,/ADD `youtube_video_id` text/);
});

test("forces the reader shell to revalidate after deployments",async()=>{
  const [headers,worker,layout,icon,vite]=await Promise.all([readFile(new URL("../public/_headers",import.meta.url),"utf8"),readFile(new URL("../worker/index.ts",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../public/kurufeetha-icon.svg",import.meta.url),"utf8"),readFile(new URL("../vite.config.ts",import.meta.url),"utf8")]);
  assert.match(headers,/Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(headers,/\/assets\/\*/);assert.match(headers,/immutable/);
  assert.match(worker,/shouldTransformDocument\(request,response\)/);assert.match(worker,/headers\.set\("Cache-Control", "no-cache, no-store, must-revalidate"\)/);
  assert.match(layout,/kurufeetha-icon\.svg/);assert.match(icon,/#006d65/);assert.match(icon,/ކ/);
  assert.match(vite,/keep_vars: true/);
});

test("ships owner-controlled administrator invitations and staff access management",async()=>{
  const[shell,manager,auth,invite,resend,userUpdate,userList,helper,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/components/UserAccessManager.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/lib/auth.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/users/invitations/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/users/invitations/[id]/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/users/[id]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/users/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/lib/staff-invitations.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),readFile(new URL("../drizzle/0017_add_staff_invitations.sql",import.meta.url),"utf8")]);
  assert.match(shell,/Users &amp; Access/);assert.match(shell,/UserAccessManager token/);
  assert.match(manager,/Invite administrator/);assert.match(manager,/Make admin/);assert.match(manager,/Remove admin/);assert.match(manager,/Resend/);assert.match(manager,/Revoke/);
  assert.match(invite,/requireOwner/);assert.match(invite,/promoted_existing/);assert.match(invite,/already_admin/);assert.match(invite,/delivery_failed/);
  assert.match(resend,/requireOwner/);assert.match(resend,/staff\.invitation_revoked/);assert.match(userUpdate,/OWNER_REQUIRED/);assert.match(userUpdate,/PROTECTED_ACCOUNT/);
  assert.match(userList,/requireAdmin/);assert.match(userList,/staff_invitations/);assert.match(helper,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(helper,/inviteUserByEmail/);assert.doesNotMatch(helper,/user_metadata/);
  assert.match(auth,/EMAIL_NOT_VERIFIED/);assert.match(auth,/status='pending'/);assert.match(auth,/staff\.invitation_accepted/);assert.match(auth,/user\.role="admin"/);
  assert.match(schema,/staffInvitations/);assert.match(migration,/CREATE TABLE `staff_invitations`/);assert.match(migration,/UNIQUE INDEX `staff_invitation_email_idx`/);
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

test("ships CMS-tagged breaking news alerts",async()=>{
  const[shell,styles,feed,adminCreate,adminUpdate,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/[id]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0008_cynical_jimmy_woo.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Breaking News/);assert.match(shell,/BREAKING NEWS/);assert.match(shell,/ކުއްލި ޚަބަރު/);
  assert.match(shell,/breakingAlert\.headline/);assert.match(shell,/setInterval\(check,15_000\)/);assert.match(shell,/story\.id}:\$\{story\.updatedAt/);
  assert.match(shell,/isRecentlyBreaking/);assert.match(shell,/30\*60_000/);assert.match(shell,/breaking-card-tag/);
  assert.match(styles,/\.breaking-news-alert/);assert.match(styles,/background: #b71927/);assert.match(styles,/\.breaking-check/);
  assert.match(styles,/\.breaking-card-tag/);assert.match(styles,/inset-inline-start: calc\(100% \+ 7px\)/);
  assert.match(feed,/c\.is_breaking AS breaking/);assert.match(feed,/c\.updated_at AS updatedAt/);
  assert.match(adminCreate,/is_breaking/);assert.match(adminUpdate,/is_breaking/);assert.match(schema,/isBreaking: integer\("is_breaking"/);
  assert.match(migration,/ALTER TABLE `news_cards` ADD `is_breaking`/);
});

test("ships professional profile controls and separately subscribed important alerts",async()=>{
  const[shell,styles,feed,me,adminCreate,adminUpdate,auth,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/me/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/[id]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/lib/auth.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0009_stiff_hellcat.sql",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Important Stories/);assert.match(shell,/Important Story/);assert.match(shell,/importantAlert\.headline/);assert.match(shell,/account-panel[\s\S]*dir="ltr"/);
  assert.match(shell,/kurufeetha-text-size/);assert.match(shell,/Extra large/);assert.match(shell,/notifyBreaking/);assert.match(shell,/notifyImportant/);
  assert.match(styles,/\.profile-hero/);assert.match(styles,/\.text-size-xlarge \.summary/);assert.match(styles,/\.important-news-alert/);assert.match(styles,/\.switch-control/);
  assert.match(feed,/c\.is_important AS important/);assert.match(me,/notify_breaking/);assert.match(me,/notify_important/);
  assert.match(adminCreate,/is_important/);assert.match(adminUpdate,/is_important/);assert.match(auth,/notifyImportant/);
  assert.match(schema,/isImportant: integer\("is_important"/);assert.match(schema,/notifyBreaking: integer\("notify_breaking"/);
  assert.match(migration,/ADD `is_important`/);assert.match(migration,/ADD `notify_breaking`/);assert.match(migration,/ADD `notify_important`/);
});

test("refresh alert opens the exact newly detected For You card",async()=>{
  const shell=await readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8");
  assert.match(shell,/newContentTargetRef/);
  assert.match(shell,/newItems\[0\]/);
  assert.match(shell,/card\.dataset\.contentKey===targetKey/);
  assert.match(shell,/target\.scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
});

test("places story timestamps above the footer divider",async()=>{
  const[shell,styles]=await Promise.all([readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(shell,/className="summary"[\s\S]*className="story-timestamp"[\s\S]*className="story-footer"/);
  assert.match(styles,/\.story-timestamp/);
});

test("ships independently published bilingual detailed articles",async()=>{
  const[shell,reader,articleApi,adminPublish,feed,schema,migration,styles]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/components/ArticleReader.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/articles/[id]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/cards/[id]/article/publish/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0010_many_trauma.sql",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/Detailed article/);assert.match(shell,/RichTextEditor/);assert.match(shell,/Publish detailed article/);assert.match(shell,/Read full article/);
  assert.doesNotMatch(shell,/href=\{item\.sourceUrl\}/);assert.match(feed,/article_status='published'/);assert.match(feed,/articleUrl/);
  assert.match(reader,/article-body/);assert.match(reader,/article-gallery/);assert.match(reader,/article-publish-meta/);assert.match(reader,/alt=\{article\.headline\}/);assert.match(reader,/kurufeetha-bookmarks/);assert.match(reader,/kurufeetha-likes/);
  assert.match(articleApi,/getPublicArticle/);assert.match(adminPublish,/requireAdmin/);assert.match(adminPublish,/article\.published/);
  assert.match(schema,/articleContent/);assert.match(schema,/articlePublishedAt/);assert.match(migration,/ADD `article_content`/);assert.match(styles,/\.article-page\[dir="rtl"\]/);
  assert.match(styles,/\.article-page \{[^}]*font-family: Inter/);assert.match(styles,/\.article-body \{[^}]*font-family: Inter[^}]*line-height: 1\.82/);assert.match(styles,/text-wrap: balance/);
});

test("new story saves complete without redundant publish requests and recover from expired sessions",async()=>{
  const[shell,feed,galleries]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/galleries/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/freshAccessToken/);assert.match(shell,/client\.auth\.refreshSession/);assert.match(shell,/if\(!story\.id\)\{notify\("Story saved"\);onDone\(\);return\}/);
  assert.match(shell,/finally\{setBusy\(false\)\}/);assert.match(shell,/Could not save story \(\$\{response\.status\}\)/);
  assert.match(feed,/error instanceof AuthError&&error\.status===401/);assert.match(galleries,/error instanceof AuthError&&error\.status===401/);
});

test("ships the protected revenue studio and transparent sponsored feed",async()=>{
  const[shell,manager,publicCampaigns,events,adminCampaigns,policy,archive,schema,migration]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/components/CampaignManager.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/campaigns/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/campaigns/events/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/admin/campaigns/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/advertising-policy/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/political-ads/page.tsx",import.meta.url),"utf8"),readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),readFile(new URL("../drizzle/0011_unusual_arclight.sql",import.meta.url),"utf8")]);
  assert.match(shell,/SponsoredCard/);assert.match(shell,/Paid for by/);assert.match(shell,/data-campaign-id/);assert.match(shell,/Math\.floor\(index\/7\)/);
  assert.match(manager,/MVR 4,900/);assert.match(manager,/Mark paid/);assert.match(manager,/Publish to feed/);assert.match(manager,/Political advertisement/);
  assert.match(publicCampaigns,/owner_approved_at IS NOT NULL/);assert.match(publicCampaigns,/payment_status='paid'/);assert.match(events,/INSERT OR IGNORE/);
  assert.match(adminCampaigns,/requireAdmin/);assert.match(adminCampaigns,/OWNER_APPROVAL_REQUIRED/);assert.match(adminCampaigns,/POLITICAL_VERIFICATION_REQUIRED/);
  assert.match(policy,/Advertising policy/);assert.match(policy,/Payment never gives an advertiser control/);assert.match(archive,/Political ad archive/);
  assert.match(schema,/contentEvents/);assert.match(schema,/idx_campaigns_delivery/);assert.match(migration,/UPDATE `campaign_events` SET `event_key`=`id`/);
});

test("campaign CMS lists editable advertisers and preserves revenue navigation",async()=>{
  const[shell,manager,advertiserUpdate]=await Promise.all([readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/components/CampaignManager.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/advertisers/[id]/route.ts",import.meta.url),"utf8")]);
  assert.match(shell,/revenue-nav-item/);assert.match(shell,/button\.textContent="\$ Campaigns"/);
  assert.match(manager,/Advertiser directory/);assert.match(manager,/Edit advertiser/);assert.match(manager,/Campaign saved as draft/);assert.match(manager,/Mark the invoice paid, then activate/);
  assert.match(manager,/new Date\(start\.getTime\(\)\+30\*86400_000\)/);assert.match(manager,/Could not complete that action/);
  assert.match(advertiserUpdate,/requireAdmin/);assert.match(advertiserUpdate,/advertiser\.updated/);assert.match(advertiserUpdate,/UPDATE campaigns SET sponsor_name/);
});

test("campaign validation identifies the exact invalid field",async()=>{const[manager,route]=await Promise.all([readFile(new URL("../app/components/CampaignManager.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/campaigns/route.ts",import.meta.url),"utf8")]);assert.match(manager,/destinationUrl=\/\^https/);assert.match(manager,/end date and time later than the start/);assert.match(route,/ADVERTISER_REQUIRED/);assert.match(route,/DESTINATION_REQUIRED/);assert.match(route,/START_DATE_REQUIRED/);assert.match(route,/END_DATE_INVALID/);assert.doesNotMatch(route,/Choose an advertiser, valid destination, and valid campaign dates/)});

test("sponsored cards render reliably on mobile with placement-level frequency caps",async()=>{const[shell,delivery]=await Promise.all([readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/placements/route.ts",import.meta.url),"utf8")]);assert.match(shell,/deliveryCounts=new Map/);assert.match(shell,/Math\.min\(2,campaign\.frequencyCap/);assert.doesNotMatch(shell,/sessionStorage\.getItem\(`kurufeetha-campaign/);assert.match(shell,/data-campaign-id/);assert.match(shell,/\/api\/v1\/placements/);assert.doesNotMatch(shell,/fetch\([`"]\/api\/v1\/campaigns/);assert.match(delivery,/campaigns\/route/)});

test("For You ranks fresh Maldives-day content before expired time-sensitive stories",async()=>{
  const[shell,ranking,feed,admin,schema,migration,backfill]=await Promise.all([
    readFile(new URL("../app/components/KuruFeethaApp.tsx",import.meta.url),"utf8"),readFile(new URL("../app/lib/feed-ranking.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/v1/admin/cards/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),readFile(new URL("../drizzle/0013_friendly_shen.sql",import.meta.url),"utf8"),readFile(new URL("../drizzle/0015_correct_weather_time_sensitive_backfill.sql",import.meta.url),"utf8")]);
  assert.match(ranking,/\+ 5 \* 60 \* 60_000/);assert.match(ranking,/age >= 24 \* 60 \* 60_000/);assert.match(ranking,/return 0/);
  assert.match(shell,/freshnessGroup\(b,timeNow\)-freshnessGroup\(a,timeNow\)/);assert.match(shell,/view==="saved"\|\|view==="latest"\?b\.publishedAt-a\.publishedAt/);
  assert.match(shell,/Time-sensitive story/);assert.match(feed,/is_time_sensitive AS timeSensitive/);assert.match(admin,/isTimeSensitive/);assert.match(schema,/isTimeSensitive/);assert.match(migration,/is_time_sensitive/);
  assert.match(backfill,/lower\(`name_en`\) = 'weather'/);assert.match(backfill,/lower\(`slug`\) LIKE 'weather%'/);assert.match(shell,/time-sensitive-badge/);
  const now=Date.UTC(2026,7,8,4),today=Date.UTC(2026,7,7,19,30),yesterday=Date.UTC(2026,7,7,18,30);
  assert.equal(maldivesDay(today),maldivesDay(now));assert.notEqual(maldivesDay(yesterday),maldivesDay(now));
  assert.equal(freshnessGroup({kind:"story",publishedAt:now-24*60*60_000,timeSensitive:true},now),0);
  assert.ok(freshnessGroup({kind:"story",publishedAt:now-24*60*60_000+1,timeSensitive:true},now)>0);
  assert.ok(freshnessGroup({kind:"story",publishedAt:now-24*60*60_000,timeSensitive:false},now)>freshnessGroup({kind:"story",publishedAt:now-48*60*60_000,timeSensitive:false},now));
  assert.equal(freshnessGroup({kind:"story",publishedAt:now-30*24*60*60_000,timeSensitive:false},now),1);
});
