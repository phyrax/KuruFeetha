import assert from "node:assert/strict";
import test from "node:test";
import {CATEGORY_PAGE_SIZE,categoryArchivePath,getCategoryArchivePage,getHomepageArticleLinks,missingCategoryArchivePage,parseCategoryPage} from "../app/lib/crawl-discovery.ts";
import {readFile} from "node:fs/promises";

const categories=[{id:"cat-maldives",slug:"maldives",nameEn:"Maldives",nameDv:"ދިވެހިރާއްޖެ"}];
const fixtures=Array.from({length:CATEGORY_PAGE_SIZE*2+5},(_,index)=>({
  id:`article-${String(index+1).padStart(3,"0")}`,language:index%2?"dv":"en",headline:`Headline ${index+1}`,summary:`Summary ${index+1}`,imageUrl:null,
  articlePublishedAt:2_000_000-index,categorySlug:"maldives",categoryName:index%2?categories[0].nameDv:categories[0].nameEn,
}));

function fixtureDb(rows=fixtures){
  const queries=[];
  return{queries,prepare(query){queries.push(query);return{values:[],bind(...values){this.values=values;return this},async all(){
    if(query.includes("t.language IN"))return{results:rows.filter(row=>rows.filter(candidate=>candidate.language===row.language).indexOf(row)<this.values[0])};
    const[language,slug,limit,offset]=this.values;
    return{results:rows.filter(row=>row.language===language&&row.categorySlug===slug).slice(offset,offset+limit)};
  }}}};
}

test("homepage initial markup exposes genuine article and bilingual category anchors",async()=>{
  const db=fixtureDb(),articles=await getHomepageArticleLinks(db,6),component=await readFile(new URL("../app/components/HomepageDiscoveryContent.tsx",import.meta.url),"utf8");
  assert.equal(articles[0].articleUrl,"/en/article/article-001");
  assert.equal(articles[1].articleUrl,"/dv/article/article-002");
  assert.match(component,/<a href=\{article\.articleUrl\}/);
  assert.match(component,/`\/en\/category\/\$\{encodeURIComponent\(category\.slug\)\}`/);
  assert.match(component,/`\/dv\/category\/\$\{encodeURIComponent\(category\.slug\)\}`/);
  const query=db.queries[0];
  for(const eligibility of ["c.status='published'","t.review_status='published'","t.article_status='published'","t.article_content IS NOT NULL","t.article_published_at IS NOT NULL","cat.enabled=1"])assert.match(query,new RegExp(eligibility.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(query,/PARTITION BY t\.language ORDER BY t\.article_published_at DESC,c\.id/);
  assert.equal(articles.filter(article=>article.language==="en").length,3);
  assert.equal(articles.filter(article=>article.language==="dv").length,3);
});

test("category pages form a stable, non-overlapping crawl path for every eligible article",async()=>{
  for(const language of ["en","dv"]){
    const languageRows=fixtures.filter(row=>row.language===language),db=fixtureDb(),pages=[];
    for(let page=1;;page++){
      const archive=await getCategoryArchivePage(db,language,"maldives",page);pages.push(archive);
      if(!archive.hasNext)break;
    }
    const ids=pages.flatMap(page=>page.articles.map(article=>article.id));
    assert.deepEqual(ids,languageRows.map(article=>article.id));
    assert.equal(new Set(ids).size,ids.length);
    assert.equal(pages[0].hasPrevious,false);
    assert.equal(pages.at(-1).hasNext,false);
    assert.equal(missingCategoryArchivePage(pages.length+1,(await getCategoryArchivePage(db,language,"maldives",pages.length+1)).articles.length),true);
  }
});

test("pagination paths and parsing produce clean finite canonicals",()=>{
  assert.equal(parseCategoryPage(undefined),1);
  assert.equal(parseCategoryPage("1"),1);
  assert.equal(parseCategoryPage("2"),2);
  for(const invalid of ["0","-1","1.5","abc",String(Number.MAX_SAFE_INTEGER),["1","2"]])assert.equal(parseCategoryPage(invalid),null);
  assert.equal(categoryArchivePath("en","maldives",1),"/en/category/maldives");
  assert.equal(categoryArchivePath("en","maldives",2),"/en/category/maldives?page=2");
  assert.equal(categoryArchivePath("dv","maldives",2),"/dv/category/maldives?page=2");
});

test("route implementation 404s exhausted pages and keeps query canonicals deterministic",async()=>{
  const route=await readFile(new URL("../app/[language]/category/[slug]/page.tsx",import.meta.url),"utf8"),home=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(route,/missingCategoryArchivePage\(page,result\.archive\.articles\.length\)\)notFound\(\)/);
  assert.match(route,/canonical:absoluteUrl\(path\)/);
  assert.match(route,/categoryArchivePath\(language,slug,page\)/);
  assert.match(route,/href=\{categoryArchivePath\(language,slug,page[+-]1\)\}/);
  assert.match(home,/<HomepageDiscovery\/>/);
});
