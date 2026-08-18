import assert from "node:assert/strict";
import test from "node:test";
import {advertiseMetadata,advertisingPolicyMetadata,homeMetadata,politicalAdsMetadata} from "../app/lib/static-page-metadata.ts";
import {publicSitemap,robotsResponse} from "../worker/seo-sitemaps.ts";

const emptyDb={prepare(){return{bind(){return this},async all(){return{results:[]}},async first(){return null}}}};

test("public media remains crawlable while non-public APIs stay blocked",async()=>{
  const robots=await robotsResponse().text();
  assert.match(robots,/^Allow: \/api\/v1\/media\/$/m);
  assert.match(robots,/^Disallow: \/api\/$/m);
  for(const path of ["/api/v1/admin/cards","/api/v1/me","/api/v1/feed","/api/v1/analytics/events","/api/v1/campaigns"]){
    assert.ok(path.startsWith("/api/")&&!path.startsWith("/api/v1/media/"));
  }
  assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/sitemap\.xml/);
  assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/news-sitemap\.xml/);
});

test("public sitemap emits the final canonical homepage URL",async()=>{
  const xml=await publicSitemap(emptyDb).then(response=>response.text());
  assert.match(xml,/<loc>https:\/\/kurufeetha\.com\/<\/loc>/);
  assert.doesNotMatch(xml,/<loc>https:\/\/kurufeetha\.com<\/loc>/);
  for(const canonical of [homeMetadata,advertiseMetadata,advertisingPolicyMetadata,politicalAdsMetadata].map(metadata=>metadata.alternates.canonical)){
    assert.match(xml,new RegExp(`<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}</loc>`));
  }
});

test("public static routes and query variants share clean absolute canonicals",()=>{
  const cases=[
    [homeMetadata,"https://kurufeetha.com/",["/","/?utm_source=test"]],
    [advertiseMetadata,"https://kurufeetha.com/advertise",["/advertise","/advertise?utm_source=test"]],
    [advertisingPolicyMetadata,"https://kurufeetha.com/advertising-policy",["/advertising-policy","/advertising-policy?utm_source=test"]],
    [politicalAdsMetadata,"https://kurufeetha.com/political-ads",["/political-ads","/political-ads?utm_source=test"]],
  ];
  for(const[metadata,canonical,variants]of cases){
    assert.equal(metadata.alternates.canonical,canonical);
    assert.equal(metadata.openGraph.url,canonical);
    for(const variant of variants)assert.equal(new URL(metadata.alternates.canonical).search,"",variant);
  }
});
