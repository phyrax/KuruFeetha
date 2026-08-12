import { richTextHasContent,validateRichText,type RichTextDocument } from "./cms";
import type { PublicAuthor,PublicContentType } from "./public-authorship.ts";

export type PublicArticle={id:string;language:"en"|"dv";headline:string;summary:string;articleContent:RichTextDocument;imageUrl:string|null;category:string;categoryName:string;breaking:number;important:number;publishedAt:number;articlePublishedAt:number;contentType:PublicContentType|null;authors:PublicAuthor[];availableLanguages:Array<"en"|"dv">;relatedGallery:null|{id:string;topic:string;images:Array<{id:string;url:string;sortOrder:number}>}};

export async function getPublicArticle(db:D1Database,id:string,language:"en"|"dv"):Promise<PublicArticle|null>{
  const row=await db.prepare(`SELECT c.id,? AS language,t.headline,t.summary,t.article_content AS articleContent,c.image_url AS imageUrl,cat.slug AS category,
    CASE WHEN ?='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName,c.is_breaking AS breaking,c.is_important AS important,t.published_at AS publishedAt,t.article_published_at AS articlePublishedAt,t.content_type AS contentType
    FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id AND t.language=? LEFT JOIN categories cat ON cat.id=c.category_id
    WHERE c.id=? AND c.status='published' AND t.review_status='published' AND t.article_status='published' AND t.article_content IS NOT NULL AND t.article_published_at IS NOT NULL`).bind(language,language,language,id).first<Record<string,unknown>>();
  if(!row)return null;
  let articleContent:RichTextDocument|null=null;try{articleContent=validateRichText(JSON.parse(row.articleContent as string))}catch{return null}if(!richTextHasContent(articleContent))return null;
  const languages=await db.prepare(`SELECT language FROM news_card_translations WHERE card_id=? AND review_status='published' AND article_status='published' AND article_content IS NOT NULL AND article_published_at IS NOT NULL`).bind(id).all<{language:"en"|"dv"}>();
  const authors=await db.prepare(`SELECT a.id,a.kind,a.status,a.name_en AS nameEn,a.name_dv AS nameDv
    FROM article_credits ac JOIN authors a ON a.id=ac.author_id JOIN news_card_translations t ON t.id=ac.translation_id
    WHERE t.card_id=? AND t.language=? AND ac.role='author' ORDER BY ac.sort_order,ac.created_at,ac.id`).bind(id,language).all<PublicAuthor>();
  const gallery=await db.prepare(`SELECT g.id,CASE WHEN ?='dv' THEN g.topic_dv ELSE g.topic_en END AS topic,
    json_group_array(json_object('id',i.id,'url',i.image_url,'sortOrder',i.sort_order)) AS images
    FROM galleries g JOIN gallery_images i ON i.gallery_id=g.id
    WHERE (CASE WHEN ?='dv' THEN g.related_story_dv_id ELSE g.related_story_en_id END)=? AND g.status='published' AND (CASE WHEN ?='dv' THEN g.published_dv=1 ELSE g.published_en=1 END)
    GROUP BY g.id ORDER BY g.published_at DESC LIMIT 1`).bind(language,language,id,language).first<{id:string;topic:string;images:string}>();
  return {...row,articleContent,authors:authors.results,availableLanguages:languages.results.map(item=>item.language),relatedGallery:gallery?{...gallery,images:JSON.parse(gallery.images)}:null} as PublicArticle;
}
