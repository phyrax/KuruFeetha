import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {documentLanguageForPath} from "../app/lib/document-language.ts";
import {approvedTransparencyPages,transparencyMetadata} from "../app/lib/transparency.ts";
import {newsSitemap,publicSitemap} from "../worker/seo-sitemaps.ts";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");
const emptyDb={prepare(){const statement={bind(){return statement},async all(){return{results:[]}}};return statement}};

test("completed English transparency pages use verified facts and canonical metadata",async()=>{
  assert.deepEqual(approvedTransparencyPages,["about","contact","editorial-standards","corrections"]);
  for(const page of approvedTransparencyPages){
    const source=await read(`../app/[language]/${page}/page.tsx`),metadata=transparencyMetadata("en",page);
    assert.equal(metadata.alternates.canonical,`https://kurufeetha.com/en/${page}`);
    assert.equal(metadata.openGraph.url,`https://kurufeetha.com/en/${page}`);
    assert.equal(metadata.robots,undefined);
    assert.equal(metadata.alternates.languages,undefined);
    assert.match(source,/language!=="en"&&language!=="dv"/);
  }
  const[about,contact,standards,corrections]=await Promise.all(approvedTransparencyPages.map(page=>read(`../app/[language]/${page}/page.tsx`)));
  assert.match(about,/operated by Epsilon in the Maldives/);assert.match(about,/Fathimath Reesha/);
  assert.doesNotMatch(about,/incorporat|register|politically independent|funded by/i);
  assert.match(contact,/mailto:\$\{contactEmail\}/);assert.match(contact,/tel:\+9609781818/);assert.match(contact,/publicAddress/);
  assert.match(standards,/News, Opinion, Editorial and Press Release/);assert.match(standards,/English News Desk and Dhivehi News Desk/);
  assert.doesNotMatch(standards,/confidential source|conflict of interest|artificial intelligence/i);
  assert.match(corrections,/reviewed by editors/);assert.match(corrections,/correct, clarify or retract/);assert.match(corrections,/visible note/);
  assert.doesNotMatch(corrections,/within \d+|appeal|guarantee/i);
});

test("unapproved Dhivehi and legal scaffolds are noindex without fabricated alternates",async()=>{
  for(const page of [...approvedTransparencyPages,"privacy","terms"]){
    const metadata=transparencyMetadata("dv",page);
    assert.deepEqual(metadata.robots,{index:false,follow:false});
    assert.equal(metadata.alternates.canonical,`https://kurufeetha.com/dv/${page}`);
    assert.equal(metadata.alternates.languages,undefined);
  }
  for(const page of ["privacy","terms"]){
    for(const language of ["en","dv"]){
      const metadata=transparencyMetadata(language,page),source=await read(`../app/[language]/${page}/page.tsx`);
      assert.deepEqual(metadata.robots,{index:false,follow:false});assert.match(source,/require legal review/);
    }
  }
  const component=await read("../app/components/TransparencyPage.tsx");
  assert.match(component,/Policy content is being finalized/);assert.doesNotMatch(component,/href={`\/${language}\/privacy`}|href={`\/${language}\/terms`}/);
  assert.deepEqual(documentLanguageForPath("/en/about"),{language:"en",direction:"ltr"});
  assert.deepEqual(documentLanguageForPath("/dv/about"),{language:"dv",direction:"rtl"});
});

test("footer navigation is language-aware and article pages expose transparency links",async()=>{
  const[links,home,reader]=await Promise.all([read("../app/components/TransparencyPage.tsx"),read("../app/page.tsx"),read("../app/components/ArticleReader.tsx")]);
  for(const page of ["about","contact","editorial-standards","corrections"])assert.match(links,new RegExp(`\\/\\$\\{language\\}\\/${page}`));
  assert.match(home,/public-transparency-footer/);assert.match(links,/MutationObserver/);
  assert.match(reader,/TransparencyLinks language=\{article\.language\}/);
  assert.doesNotMatch(links,/\/privacy|\/terms/);
});

test("regular sitemap includes only approved English transparency pages and News sitemap excludes them",async()=>{
  const publicResponse=await publicSitemap(emptyDb),publicXml=await publicResponse.text();
  for(const page of approvedTransparencyPages)assert.match(publicXml,new RegExp(`<loc>https:\\/\\/kurufeetha\\.com\\/en\\/${page}<\\/loc>`));
  assert.doesNotMatch(publicXml,/\/(dv\/(about|contact|editorial-standards|corrections)|en\/(privacy|terms)|dv\/(privacy|terms))<\/loc>/);
  const news=await newsSitemap(emptyDb,1_800_000_000_000),newsXml=await news.text();
  assert.doesNotMatch(newsXml,/about|contact|editorial-standards|corrections|privacy|terms/);
});
