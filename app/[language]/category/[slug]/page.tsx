/* eslint-disable @next/next/no-img-element -- uploaded editorial media is served by the existing Worker media route */
// @ts-expect-error vinext provides this Cloudflare runtime module during its build.
import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {categoryArchivePath,getCategoryArchivePage,missingCategoryArchivePage,parseCategoryPage,type CrawlDatabase} from "../../../lib/crawl-discovery.ts";
import {getPublicCategories,type PublicDatabase} from "../../../lib/public-feed";
import { absoluteUrl,SITE_NAME } from "../../../lib/seo";

export const dynamic="force-dynamic";
type Params={language:string;slug:string};
type SearchParams={page?:string|string[]};

async function data(language:"en"|"dv",slug:string,page:number){
  const db=(env as unknown as{DB:PublicDatabase&CrawlDatabase}).DB;
  const categories=await getPublicCategories(db),category=categories.find(item=>item.slug===slug);
  if(!category)return null;
  return{category,archive:await getCategoryArchivePage(db,language,slug,page)};
}

export async function generateMetadata({params,searchParams}:{params:Promise<Params>;searchParams:Promise<SearchParams>}):Promise<Metadata>{
  const[{language,slug},query]=await Promise.all([params,searchParams]),page=parseCategoryPage(query.page);if((language!=="en"&&language!=="dv")||page===null)return{robots:{index:false,follow:false}};
  const result=await data(language,slug,page);if(!result||missingCategoryArchivePage(page,result.archive.articles.length))return{title:`Category unavailable — ${SITE_NAME}`,robots:{index:false,follow:false}};
  const name=language==="dv"?result.category.nameDv:result.category.nameEn,path=categoryArchivePath(language,slug,page),title=`${name} news${page>1?` — Page ${page}`:""} — ${SITE_NAME}`,description=`Latest ${name} news and updates from KuruFeetha.`;
  return{title,description,alternates:{canonical:absoluteUrl(path),languages:page===1?{en:absoluteUrl(categoryArchivePath("en",slug)),dv:absoluteUrl(categoryArchivePath("dv",slug))}:undefined},openGraph:{title,description,url:absoluteUrl(path),locale:language==="dv"?"dv_MV":"en_MV"},other:{"content-language":language}};
}

export default async function CategoryPage({params,searchParams}:{params:Promise<Params>;searchParams:Promise<SearchParams>}){
  const[{language,slug},query]=await Promise.all([params,searchParams]),page=parseCategoryPage(query.page);if((language!=="en"&&language!=="dv")||page===null)notFound();const result=await data(language,slug,page);if(!result||missingCategoryArchivePage(page,result.archive.articles.length))notFound();
  const rtl=language==="dv",name=rtl?result.category.nameDv:result.category.nameEn;
  return <main className="category-page" dir={rtl?"rtl":"ltr"}>
    <header className="category-page-header"><Link className="article-brand" href="/"><span>ކ</span><strong>KuruFeetha</strong></Link><Link href="/">{rtl?"ޚަބަރުތަކަށް":"Back to feed"}</Link></header>
    <section className="category-page-intro"><p>{rtl?"ބައި":"CATEGORY"}</p><h1>{name}</h1>{page>1&&<span>{rtl?`${page} ވަނަ ޞަފްޙާ`:`Page ${page}`}</span>}</section>
    <section className="category-story-list">{result.archive.articles.map(article=>{
      const published=article.articlePublishedAt<1e12?article.articlePublishedAt*1000:article.articlePublishedAt;
      return <article key={article.id}><Link href={article.articleUrl}>{article.imageUrl&&<img src={article.imageUrl} alt={article.headline} loading="lazy" decoding="async"/>}<div><span>{name}</span><h2>{article.headline}</h2><p>{article.summary}</p><time dateTime={new Date(published).toISOString()}>{new Intl.DateTimeFormat(rtl?"dv-MV":"en-MV",{dateStyle:"medium"}).format(new Date(published))}</time></div></Link></article>;
    })}{!result.archive.articles.length&&<p>{rtl?"މި ބައިގައި ޝާއިޢުކުރެވިފައި ޚަބަރެއް ނެތް.":"No published detailed articles are available in this category."}</p>}</section>
    {(result.archive.hasPrevious||result.archive.hasNext)&&<nav className="category-pagination" aria-label={rtl?"ޞަފްޙާތައް":"Category pages"}>{result.archive.hasPrevious&&<Link href={categoryArchivePath(language,slug,page-1)}>{rtl?"ކުރީގެ ޞަފްޙާ":"Previous page"}</Link>}<span>{page}</span>{result.archive.hasNext&&<Link href={categoryArchivePath(language,slug,page+1)}>{rtl?"ދެން އޮތް ޞަފްޙާ":"Next page"}</Link>}</nav>}
  </main>;
}
