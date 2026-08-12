import type { Metadata } from "next";
import type { PublicArticle } from "./articles";
import { absoluteUrl, SITE_NAME, SITE_URL, timestampToIso } from "./seo.ts";

export function articleCanonical(language:"en"|"dv",id:string){
  return absoluteUrl(`/${language}/article/${encodeURIComponent(id)}`);
}

export function articleMetadata(article:PublicArticle):Metadata{
  const canonical=articleCanonical(article.language,article.id);
  const image=article.imageUrl?absoluteUrl(article.imageUrl):undefined;
  const languages=Object.fromEntries(article.availableLanguages.map(language=>[language,articleCanonical(language,article.id)]));
  return {
    title:`${article.headline} — ${SITE_NAME}`,
    description:article.summary,
    alternates:{canonical,languages},
    openGraph:{type:"article",url:canonical,siteName:SITE_NAME,locale:article.language==="dv"?"dv_MV":"en_MV",alternateLocale:article.availableLanguages.filter(language=>language!==article.language).map(language=>language==="dv"?"dv_MV":"en_MV"),title:article.headline,description:article.summary,publishedTime:timestampToIso(article.articlePublishedAt),section:article.categoryName,images:image?[{url:image,alt:article.headline}]:undefined},
    twitter:{card:"summary_large_image",title:article.headline,description:article.summary,images:image?[image]:undefined},
    other:{"content-language":article.language},
  };
}

export function articleJsonLd(article:PublicArticle){
  const canonical=articleCanonical(article.language,article.id);
  return {"@context":"https://schema.org","@type":"NewsArticle",headline:article.headline,description:article.summary,image:article.imageUrl?[absoluteUrl(article.imageUrl)]:undefined,datePublished:timestampToIso(article.articlePublishedAt),inLanguage:article.language,articleSection:article.categoryName,isAccessibleForFree:true,mainEntityOfPage:{"@type":"WebPage","@id":canonical},url:canonical,publisher:{"@type":"Organization",name:SITE_NAME,url:SITE_URL}};
}

export function safeJsonLd(value:unknown){return JSON.stringify(value).replace(/</g,"\\u003c")}
