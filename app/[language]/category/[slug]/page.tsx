/* eslint-disable @next/next/no-img-element -- uploaded editorial media is served by the existing Worker media route */
// @ts-expect-error vinext provides this Cloudflare runtime module during its build.
import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInitialPublicFeed,getPublicCategories,type PublicDatabase } from "../../../lib/public-feed";
import { absoluteUrl,SITE_NAME } from "../../../lib/seo";

export const dynamic="force-dynamic";
type Params={language:string;slug:string};

async function data(language:"en"|"dv",slug:string){
  const db=(env as unknown as{DB:PublicDatabase}).DB;
  const categories=await getPublicCategories(db),category=categories.find(item=>item.slug===slug);
  if(!category)return null;
  return{category,stories:await getInitialPublicFeed(db,language,50,slug)};
}

export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{
  const{language,slug}=await params;if(language!=="en"&&language!=="dv")return{robots:{index:false,follow:false}};
  const result=await data(language,slug);if(!result)return{title:`Category unavailable — ${SITE_NAME}`,robots:{index:false,follow:false}};
  const name=language==="dv"?result.category.nameDv:result.category.nameEn,path=`/${language}/category/${slug}`;
  return{title:`${name} news — ${SITE_NAME}`,description:`Latest ${name} news and updates from KuruFeetha.`,alternates:{canonical:absoluteUrl(path),languages:{en:absoluteUrl(`/en/category/${slug}`),dv:absoluteUrl(`/dv/category/${slug}`)}},openGraph:{title:`${name} news — ${SITE_NAME}`,description:`Latest ${name} news and updates from KuruFeetha.`,url:absoluteUrl(path),locale:language==="dv"?"dv_MV":"en_MV"},other:{"content-language":language}};
}

export default async function CategoryPage({params}:{params:Promise<Params>}){
  const{language,slug}=await params;if(language!=="en"&&language!=="dv")notFound();const result=await data(language,slug);if(!result)notFound();
  const rtl=language==="dv",name=rtl?result.category.nameDv:result.category.nameEn;
  return <main className="category-page" dir={rtl?"rtl":"ltr"}>
    <header className="category-page-header"><Link className="article-brand" href="/"><span>ކ</span><strong>KuruFeetha</strong></Link><Link href="/">{rtl?"ޚަބަރުތަކަށް":"Back to feed"}</Link></header>
    <section className="category-page-intro"><p>{rtl?"ބައި":"CATEGORY"}</p><h1>{name}</h1></section>
    <section className="category-story-list">{result.stories.map(story=>{
      const published=story.publishedAt<1e12?story.publishedAt*1000:story.publishedAt;
      const content=<>{story.imageUrl&&<img src={story.imageUrl} alt={story.headline} loading="lazy" decoding="async"/>}<div><span>{name}</span><h2>{story.headline}</h2><p>{story.summary}</p><time dateTime={new Date(published).toISOString()}>{new Intl.DateTimeFormat(rtl?"dv-MV":"en-MV",{dateStyle:"medium"}).format(new Date(published))}</time></div></>;
      return <article key={story.id}>{story.articleUrl?<Link href={story.articleUrl}>{content}</Link>:<div className="category-story-static">{content}</div>}</article>;
    })}{!result.stories.length&&<p>{rtl?"މި ބައިގައި ޝާއިޢުކުރެވިފައި ޚަބަރެއް ނެތް.":"No published stories are available in this category."}</p>}</section>
  </main>;
}
