import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArticleReader } from "../../../components/ArticleReader";
import { articleJsonLd,articleMetadata,safeJsonLd } from "../../../lib/article-seo";
import { getPublicArticle } from "../../../lib/articles";

export const dynamic="force-dynamic";
const getArticle=cache((id:string,language:"en"|"dv")=>getPublicArticle((env as unknown as{DB:D1Database}).DB,id,language));

export async function generateMetadata({params}:{params:Promise<{language:string;id:string}>}):Promise<Metadata>{
  const {language,id}=await params;
  if(language!=="en"&&language!=="dv")return{title:"Article unavailable — KuruFeetha",robots:{index:false,follow:false}};
  const article=await getArticle(id,language);
  if(!article)return{title:"Article unavailable — KuruFeetha",robots:{index:false,follow:false}};
  return articleMetadata(article);
}

export default async function ArticlePage({params}:{params:Promise<{language:string;id:string}>}){
  const {language,id}=await params;
  if(language!=="en"&&language!=="dv")notFound();
  const article=await getArticle(id,language);
  if(!article)notFound();
  const jsonLd=articleJsonLd(article);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(jsonLd)}}/><ArticleReader article={article}/></>;
}
