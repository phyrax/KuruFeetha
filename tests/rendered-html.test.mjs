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
  assert.match(shell,/Manual CMS/); assert.match(shell,/Publish this card language/); assert.match(shell,/60 words/);
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

test("forces the reader shell to revalidate after deployments",async()=>{
  const [headers,worker]=await Promise.all([readFile(new URL("../public/_headers",import.meta.url),"utf8"),readFile(new URL("../worker/index.ts",import.meta.url),"utf8")]);
  assert.match(headers,/Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(headers,/\/assets\/\*/);assert.match(headers,/immutable/);
  assert.match(worker,/acceptsHtml/);assert.match(worker,/headers\.set\("Cache-Control", "no-cache, no-store, must-revalidate"\)/);
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
  assert.match(reader,/article-body/);assert.match(reader,/article-gallery/);assert.match(reader,/kurufeetha-bookmarks/);assert.match(reader,/kurufeetha-likes/);
  assert.match(articleApi,/getPublicArticle/);assert.match(adminPublish,/requireAdmin/);assert.match(adminPublish,/article\.published/);
  assert.match(schema,/articleContent/);assert.match(schema,/articlePublishedAt/);assert.match(migration,/ADD `article_content`/);assert.match(styles,/\.article-page\[dir="rtl"\]/);
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
