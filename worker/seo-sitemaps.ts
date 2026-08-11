const CANONICAL_ORIGIN = "https://kurufeetha.com";
const ARTICLE_CHUNK_SIZE = 10_000;

const ARTICLE_PUBLISH_WHERE = `c.status='published'
  AND t.review_status='published'
  AND t.article_status='published'
  AND t.article_content IS NOT NULL
  AND t.article_published_at IS NOT NULL
  AND t.language IN ('en','dv')`;

type ArticleRow={id:string;language:"en"|"dv";modifiedAt:number|null};
type CategoryRow={slug:string};
type QueryResult<T>={results:T[]};
interface SeoStatement{bind(...values:unknown[]):SeoStatement;first<T>():Promise<T|null>;all<T>():Promise<QueryResult<T>>}
export interface SeoDatabase{prepare(query:string):SeoStatement}

export function escapeXml(value:string){return value.replace(/[<>&'\"]/g,character=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"})[character]!)}
function isoTimestamp(value:number|null){if(!value||!Number.isFinite(value)||value<=0)return null;const date=new Date(value<1e12?value*1000:value);return Number.isNaN(date.valueOf())?null:date.toISOString()}
function xmlResponse(xml:string,urlCount:number,urlTypes:string){return new Response(xml,{status:200,headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=300, s-maxage=300","x-content-type-options":"nosniff","x-sitemap-url-count":String(urlCount),"x-sitemap-url-types":urlTypes}})}
function urlEntry(url:string,lastModified?:number|null){const lastmod=isoTimestamp(lastModified??null);return `<url><loc>${escapeXml(url)}</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:""}</url>`}
function urlSet(entries:string[]){return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`}

export async function sitemapIndex(db:SeoDatabase){
  const count=await db.prepare(`SELECT COUNT(*) AS count FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id WHERE ${ARTICLE_PUBLISH_WHERE}`).first<{count:number}>().catch(()=>null);
  const chunks=Math.ceil(Number(count?.count??0)/ARTICLE_CHUNK_SIZE);
  const locations=[`${CANONICAL_ORIGIN}/sitemaps/public.xml`,...Array.from({length:chunks},(_,index)=>`${CANONICAL_ORIGIN}/sitemaps/articles-${index+1}.xml`)];
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.map(location=>`<sitemap><loc>${escapeXml(location)}</loc></sitemap>`).join("")}</sitemapindex>`,locations.length,"sitemap-index");
}

export async function publicSitemap(db:SeoDatabase){
  const categories=await db.prepare("SELECT DISTINCT slug FROM categories WHERE enabled=1 AND slug IS NOT NULL AND trim(slug)<>'' ORDER BY sort_order,slug").all<CategoryRow>().catch(()=>({results:[] as CategoryRow[]}));
  const entries=[urlEntry(CANONICAL_ORIGIN),urlEntry(`${CANONICAL_ORIGIN}/advertise`),urlEntry(`${CANONICAL_ORIGIN}/advertising-policy`),urlEntry(`${CANONICAL_ORIGIN}/political-ads`)];
  for(const category of categories.results){for(const language of ["en","dv"] as const)entries.push(urlEntry(`${CANONICAL_ORIGIN}/${language}/category/${encodeURIComponent(category.slug)}`))}
  return xmlResponse(urlSet(entries),entries.length,`homepage:1,static:3,categories:${categories.results.length*2}`);
}

export async function articleSitemap(db:SeoDatabase,chunk:number){
  if(!Number.isSafeInteger(chunk)||chunk<1)return new Response("Not Found",{status:404});
  const offset=(chunk-1)*ARTICLE_CHUNK_SIZE;
  const result=await db.prepare(`SELECT DISTINCT c.id,t.language,MAX(COALESCE(t.updated_at,0),COALESCE(c.updated_at,0),COALESCE(t.article_published_at,0)) AS modifiedAt FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id WHERE ${ARTICLE_PUBLISH_WHERE} ORDER BY modifiedAt DESC,c.id,t.language LIMIT ? OFFSET ?`).bind(ARTICLE_CHUNK_SIZE,offset).all<ArticleRow>().catch(()=>({results:[] as ArticleRow[]}));
  if(chunk>1&&result.results.length===0)return new Response("Not Found",{status:404});
  const entries=result.results.map(article=>urlEntry(`${CANONICAL_ORIGIN}/${article.language}/article/${encodeURIComponent(article.id)}`,article.modifiedAt));
  return xmlResponse(urlSet(entries),entries.length,"articles");
}

export function robotsResponse(){
  const body=["User-agent: *","Allow: /","Disallow: /api/","","Sitemap: https://kurufeetha.com/sitemap.xml",""] .join("\n");
  return new Response(body,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=300, s-maxage=300","x-content-type-options":"nosniff"}});
}

export const sitemapSettings={canonicalOrigin:CANONICAL_ORIGIN,articleChunkSize:ARTICLE_CHUNK_SIZE};
