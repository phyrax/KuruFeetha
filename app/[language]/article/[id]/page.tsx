import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleReader } from "../../../components/ArticleReader";
import { getPublicArticle } from "../../../lib/articles";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{language:string;id:string}>}):Promise<Metadata>{const {language,id}=await params;if(language!=="en"&&language!=="dv")return{title:"Article unavailable — KuruFeetha"};const article=await getPublicArticle((env as unknown as{DB:D1Database}).DB,id,language);if(!article)return{title:"Article unavailable — KuruFeetha"};return{title:`${article.headline} — KuruFeetha`,description:article.summary,openGraph:{title:article.headline,description:article.summary,images:article.imageUrl?[{url:article.imageUrl}]:undefined},twitter:{card:"summary_large_image",title:article.headline,description:article.summary,images:article.imageUrl?[article.imageUrl]:undefined}}}
export default async function ArticlePage({params}:{params:Promise<{language:string;id:string}>}){const {language,id}=await params;if(language!=="en"&&language!=="dv")notFound();const article=await getPublicArticle((env as unknown as{DB:D1Database}).DB,id,language);if(!article)notFound();return <ArticleReader article={article}/>}
