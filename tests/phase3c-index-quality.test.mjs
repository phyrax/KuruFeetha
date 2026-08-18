import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {categoryRobots,getPopulatedCategoryLanguages,missingCategoryArchivePage} from "../app/lib/crawl-discovery.ts";
import {articleSitemap,newsContentTypePolicy,newsSitemap,publicSitemap,sitemapSettings} from "../worker/seo-sitemaps.ts";

const locations=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);

function categoryDb(rows){let query="";return{get query(){return query},prepare(sql){query=sql;return{bind(){return this},async all(){return{results:rows}},async first(){return null}}}}}

test("empty category languages are noindex and absent while populated languages remain indexable",async()=>{
  assert.deepEqual(categoryRobots(0),{index:false,follow:true});
  assert.deepEqual(categoryRobots(1),{index:true,follow:true});
  const asymmetric=categoryDb([{slug:"sports",language:"dv"},{slug:"business",language:"en"},{slug:"business",language:"dv"}]),xml=await publicSitemap(asymmetric).then(response=>response.text()),urls=locations(xml);
  assert.ok(urls.includes("https://kurufeetha.com/dv/category/sports"));
  assert.ok(!urls.includes("https://kurufeetha.com/en/category/sports"));
  assert.ok(urls.includes("https://kurufeetha.com/en/category/business"));
  assert.ok(urls.includes("https://kurufeetha.com/dv/category/business"));
  for(const condition of ["cat.enabled=1","c.status='published'","t.review_status='published'","t.article_status='published'","t.article_content IS NOT NULL","t.article_published_at IS NOT NULL"])assert.match(asymmetric.query,new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  const populated=categoryDb([{slug:"sports",language:"en"},{slug:"sports",language:"dv"}]),updatedUrls=locations(await publicSitemap(populated).then(response=>response.text()));
  assert.ok(updatedUrls.includes("https://kurufeetha.com/en/category/sports"));
  const availability=categoryDb([{language:"dv"}]);assert.deepEqual(await getPopulatedCategoryLanguages(availability,"sports"),["dv"]);
});

test("News sitemap enforces the approved content-type matrix and all publication guards",async()=>{
  const now=1_800_000_000_000,base={language:"en",headline:"Headline",cardStatus:"published",reviewStatus:"published",articleStatus:"published",articleContent:true,publicationDate:now-60_000};
  const fixtures=[
    {...base,id:"news",contentType:"news"},{...base,id:"opinion",contentType:"opinion"},{...base,id:"editorial",contentType:"editorial"},{...base,id:"legacy-null",contentType:null},
    {...base,id:"press-release",contentType:"press_release"},{...base,id:"old",contentType:"news",publicationDate:now-sitemapSettings.newsFreshnessWindowMs-1},
    {...base,id:"future",contentType:"news",publicationDate:now+1},{...base,id:"draft-card",contentType:"news",cardStatus:"draft"},{...base,id:"archived",contentType:"news",cardStatus:"archived"},
    {...base,id:"unpublished-translation",contentType:"news",reviewStatus:"draft"},{...base,id:"article-draft",contentType:"news",articleStatus:"draft"},{...base,id:"missing-detail",contentType:"news",articleContent:false},
  ];
  let query="",bounds=[];const db={prepare(sql){query=sql;return{bind(...values){bounds=values;return this},async all(){const[threshold,ceiling,limit]=bounds,eligibleTypes=new Set(newsContentTypePolicy.eligible);return{results:fixtures.filter(item=>item.cardStatus==="published"&&item.reviewStatus==="published"&&item.articleStatus==="published"&&item.articleContent&&item.publicationDate>=threshold&&item.publicationDate<=ceiling&&(item.contentType===null&&newsContentTypePolicy.legacyNullEligible||eligibleTypes.has(item.contentType))).slice(0,limit)}}}}};
  const xml=await newsSitemap(db,now).then(response=>response.text()),urls=locations(xml),included=id=>urls.some(url=>url.endsWith(`/article/${id}`));
  for(const id of ["news","opinion","editorial","legacy-null"])assert.equal(included(id),true,id);
  for(const id of ["press-release","old","future","draft-card","archived","unpublished-translation","article-draft","missing-detail"])assert.equal(included(id),false,id);
  assert.deepEqual(newsContentTypePolicy,{eligible:["news","opinion","editorial"],legacyNullEligible:true});
  assert.match(query,/t\.content_type IS NULL/);assert.match(query,/t\.content_type IN \('news','opinion','editorial'\)/);assert.doesNotMatch(query,/press_release/);
});

test("Press Releases remain eligible for the standard article sitemap",async()=>{
  let query="";const db={prepare(sql){query=sql;return{bind(){return this},async all(){return{results:[{id:"press-release",language:"en",modifiedAt:1_800_000_000_000}]}},async first(){return null}}}};
  const xml=await articleSitemap(db,1).then(response=>response.text());
  assert.match(xml,/https:\/\/kurufeetha\.com\/en\/article\/press-release/);
  assert.doesNotMatch(query,/content_type/);
});

test("category metadata and pagination preserve valid and exhausted-page behavior",async()=>{
  const route=await readFile(new URL("../app/[language]/category/[slug]/page.tsx",import.meta.url),"utf8");
  assert.match(route,/robots:categoryRobots\(result\.archive\.articles\.length\)/);
  assert.match(route,/result\.availableLanguages\.map/);
  assert.deepEqual(categoryRobots(30),{index:true,follow:true});
  assert.equal(missingCategoryArchivePage(2,30),false);
  assert.equal(missingCategoryArchivePage(2,0),true);
  assert.equal(missingCategoryArchivePage(1,0),false);
  assert.match(route,/missingCategoryArchivePage\(page,result\.archive\.articles\.length\)\)notFound\(\)/);
});

test("CMS warns when a published detailed article lacks an explicit content type",async()=>{
  const cms=await readFile(new URL("../app/components/AttributionFields.tsx",import.meta.url),"utf8");
  assert.match(cms,/missingContentType=!!value\.articlePublished&&!value\.contentType/);
  assert.match(cms,/Published articles should have an explicit content type/);
  assert.doesNotMatch(cms,/update\(\{contentType:"news"\}\)|contentType\?\?"news"/);
});
