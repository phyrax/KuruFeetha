import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {documentLanguageForPath,isHtmlResponse,shouldTransformDocument} from "../app/lib/document-language.ts";

const html=new Response("<html lang=\"en\"><body>Page</body></html>",{headers:{"content-type":"text/html; charset=utf-8"}});

test("route language deterministically maps public English and Dhivehi pages",()=>{
  for(const path of ["/en/article/card-1","/en/about"])assert.deepEqual(documentLanguageForPath(path),{language:"en",direction:"ltr"});
  for(const path of ["/dv/article/card-1","/dv/about"])assert.deepEqual(documentLanguageForPath(path),{language:"dv",direction:"rtl"});
});

test("HTML detection uses response content type rather than the request Accept header",()=>{
  assert.equal(isHtmlResponse(html),true);
  for(const accept of ["text/html","text/html,application/xhtml+xml,*/*;q=0.8","*/*",null]){
    const headers=accept?{accept}:undefined;
    assert.equal(shouldTransformDocument(new Request("https://kurufeetha.com/dv/article/card-1",{headers}),html),true);
  }
});

test("non-HTML, API and non-GET responses remain outside document transformation",()=>{
  for(const contentType of ["application/json","application/xml; charset=utf-8","image/avif","text/plain"]){
    const response=new Response("body",{headers:{"content-type":contentType}});
    assert.equal(shouldTransformDocument(new Request("https://kurufeetha.com/dv/about"),response),false);
  }
  assert.equal(shouldTransformDocument(new Request("https://kurufeetha.com/api/v1/feed"),html),false);
  assert.equal(shouldTransformDocument(new Request("https://kurufeetha.com/dv/about",{method:"HEAD"}),html),false);
});

test("Worker applies only the narrow HTML rewrite and leaves SEO/authorship generators unchanged",async()=>{
  const [worker,seo,articleSeo,reader]=await Promise.all([
    readFile(new URL("../worker/index.ts",import.meta.url),"utf8"),
    readFile(new URL("../worker/seo-sitemaps.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/lib/article-seo.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/components/ArticleReader.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(worker,/shouldTransformDocument\(request,response\)/);
  assert.match(worker,/element\.setAttribute\("lang",documentLanguage\.language\)/);
  assert.match(worker,/element\.setAttribute\("dir",documentLanguage\.direction\)/);
  assert.doesNotMatch(worker,/acceptsHtml/);
  assert.match(articleSeo,/articleCanonical/);assert.match(articleSeo,/availableLanguages/);assert.match(articleSeo,/NewsArticle/);assert.match(articleSeo,/author:/);
  assert.match(reader,/article-byline/);
  assert.doesNotMatch(seo,/documentLanguage|HTMLRewriter/);
});
