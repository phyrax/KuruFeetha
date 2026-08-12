import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {articleCanonical,articleJsonLd,articleMetadata,safeJsonLd} from "../app/lib/article-seo.ts";
import {documentLanguageForPath} from "../app/lib/document-language.ts";
import {maldivesPublicationTime} from "../app/lib/publication-time.ts";
import {newsSitemap,robotsResponse,sitemapIndex} from "../worker/seo-sitemaps.ts";

const base={id:"card-1",headline:"Headline & facts",summary:"Verified article summary.",articleContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Article body"}]}]},imageUrl:"/api/v1/media/news/photo.jpg",category:"maldives",categoryName:"Maldives",breaking:0,important:0,publishedAt:1_723_599_000_000,articlePublishedAt:1_723_600_000_000,contentType:null,authors:[],availableLanguages:["en","dv"],relatedGallery:null};

test("article metadata uses absolute self canonicals and reciprocal published hreflang",()=>{
  for(const language of ["en","dv"]){const article={...base,language},metadata=articleMetadata(article);assert.equal(metadata.alternates.canonical,`https://kurufeetha.com/${language}/article/card-1`);assert.deepEqual(metadata.alternates.languages,{en:"https://kurufeetha.com/en/article/card-1",dv:"https://kurufeetha.com/dv/article/card-1"});assert.equal(metadata.openGraph.url,metadata.alternates.canonical);assert.equal(metadata.openGraph.type,"article");assert.equal(metadata.openGraph.siteName,"KuruFeetha");assert.equal(metadata.openGraph.images[0].url,"https://kurufeetha.com/api/v1/media/news/photo.jpg");assert.equal(metadata.twitter.images[0],"https://kurufeetha.com/api/v1/media/news/photo.jpg");assert.equal(metadata.openGraph.publishedTime,"2024-08-14T01:46:40.000Z");assert.equal(metadata.openGraph.modifiedTime,undefined);assert.equal(metadata.other["article:section"],"Maldives")}
  assert.equal(articleCanonical("en","card-1"),"https://kurufeetha.com/en/article/card-1");
  assert.equal(articleCanonical("dv","card-1"),"https://kurufeetha.com/dv/article/card-1");
});

test("article metadata never advertises an unpublished translation",()=>{
  const metadata=articleMetadata({...base,language:"en",availableLanguages:["en"]});assert.deepEqual(metadata.alternates.languages,{en:"https://kurufeetha.com/en/article/card-1"});assert.equal(metadata.alternates.languages.dv,undefined);
});

test("server JSON-LD contains verified facts and no fabricated authors or modification date",async()=>{
  const article={...base,language:"en"},jsonLd=articleJsonLd(article),parsed=JSON.parse(safeJsonLd(jsonLd));assert.equal(parsed["@type"],"NewsArticle");assert.equal(parsed.url,"https://kurufeetha.com/en/article/card-1");assert.equal(parsed.mainEntityOfPage["@id"],parsed.url);assert.equal(parsed.image[0],"https://kurufeetha.com/api/v1/media/news/photo.jpg");assert.equal(parsed.datePublished,"2024-08-14T01:46:40.000Z");assert.equal(parsed.headline,article.headline);assert.equal(parsed.description,article.summary);assert.equal(parsed.inLanguage,"en");assert.equal(parsed.articleSection,"Maldives");assert.equal(parsed.author,undefined);assert.equal(parsed.dateModified,undefined);assert.deepEqual(parsed.publisher,{"@type":"Organization",name:"KuruFeetha",url:"https://kurufeetha.com"});
  const page=await readFile(new URL("../app/[language]/article/[id]/page.tsx",import.meta.url),"utf8");assert.match(page,/type="application\/ld\+json"/);assert.match(page,/safeJsonLd\(jsonLd\)/);
});

test("publication display is absolute Maldives time and document language is route-derived",()=>{
  assert.match(maldivesPublicationTime(base.articlePublishedAt,"en"),/14 August 2024.*06:46/i);assert.ok(maldivesPublicationTime(base.articlePublishedAt,"dv").length>5);assert.deepEqual(documentLanguageForPath("/en/article/card-1"),{language:"en",direction:"ltr"});assert.deepEqual(documentLanguageForPath("/dv/article/card-1"),{language:"dv",direction:"rtl"});assert.equal(documentLanguageForPath("/article/card-1"),null);
});

test("query variants resolve to the same clean canonical helper",()=>{
  const requested=new URL("https://kurufeetha.com/en/article/card-1?utm_source=test");assert.equal(articleCanonical("en",requested.pathname.split("/").at(-1)),"https://kurufeetha.com/en/article/card-1");
});

test("Phase 1 leaves the sitemap, News sitemap and robots generators unchanged",async()=>{
  const db={prepare(sql){const statement={bind(){return statement},async first(){return sql.includes("COUNT(*)")?{count:0}:null},async all(){return{results:[]}}};return statement}};
  const[index,news,robots]=await Promise.all([sitemapIndex(db).then(response=>response.text()),newsSitemap(db,base.articlePublishedAt).then(response=>response.text()),robotsResponse().text()]);assert.match(index,/https:\/\/kurufeetha\.com\/sitemaps\/public\.xml/);assert.match(news,/xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/sitemap\.xml/);assert.match(robots,/Sitemap: https:\/\/kurufeetha\.com\/news-sitemap\.xml/);
});
