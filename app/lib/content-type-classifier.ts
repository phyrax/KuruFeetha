import type {ArticleContentType} from "./authors.ts";

export const classifierTypes=["news","opinion","editorial","press_release"] as const;
export type ClassifierType=typeof classifierTypes[number];
export type LanguageRecommendation={en:ClassifierType|null;dv:ClassifierType|null};
export type ClassifierResult={recommendedType:ClassifierType;confidence:number;reason:string;needsHumanReview:boolean;flags:string[];languageRecommendations:LanguageRecommendation};
export type ClassifierStory={storyId:string;category:string|null;translations:Array<{id:string;language:"en"|"dv";headline:string;summary:string;articleText:string;contentType:ArticleContentType|null;publishedAt:number;articlePublishedAt:number;authors:Array<{kind:string;nameEn:string|null;nameDv:string|null}>}>};
export interface ContentTypeClassifierProvider{provider:string;model:string;classify(story:ClassifierStory):Promise<unknown>}

function isType(value:unknown):value is ClassifierType{return typeof value==="string"&&classifierTypes.includes(value as ClassifierType)}
function nullableType(value:unknown){return value===null?null:isType(value)?value:undefined}
export function validateClassifierResult(value:unknown):ClassifierResult{
  if(!value||typeof value!=="object")throw new Error("Classifier returned an invalid result");
  const item=value as Record<string,unknown>,confidence=Number(item.confidence),reason=typeof item.reason==="string"?item.reason.trim():"",flags=Array.isArray(item.flags)?item.flags.filter(flag=>typeof flag==="string").map(String):null,languages=item.languageRecommendations as Record<string,unknown>|null;
  const en=nullableType(languages?.en),dv=nullableType(languages?.dv);
  if(!isType(item.recommendedType)||!Number.isFinite(confidence)||confidence<0||confidence>1||!reason||reason.length>500||!flags||en===undefined||dv===undefined)throw new Error("Classifier returned an invalid structured result");
  const disagreement=Boolean(en&&dv&&en!==dv),ambiguous=flags.some(flag=>/AMBIGU|UNCERTAIN|NEWS_PRESS_RELEASE/i.test(flag));
  const needsHumanReview=confidence<0.95||item.recommendedType==="opinion"||item.recommendedType==="editorial"||item.recommendedType==="press_release"||disagreement||ambiguous||item.needsHumanReview===true;
  const normalizedFlags=[...new Set([...flags,...(disagreement?["BILINGUAL_DISAGREEMENT"]:[])])];
  return{recommendedType:item.recommendedType,confidence,reason,needsHumanReview,flags:normalizedFlags,languageRecommendations:{en,dv}};
}

function nodeText(node:unknown):string{
  if(!node||typeof node!=="object")return"";const item=node as{type?:string;text?:string;content?:unknown[]};
  if(item.type==="text")return item.text??"";if(item.type==="hardBreak")return"\n";
  return(item.content??[]).map(nodeText).join("");
}
export function articleText(content:string):string{
  const parsed=JSON.parse(content) as{content?:unknown[]};return(parsed.content??[]).map(nodeText).filter(Boolean).join("\n\n").trim();
}
export async function contentFingerprint(story:ClassifierStory){
  const stable=JSON.stringify(story.translations.map(t=>({language:t.language,headline:t.headline,summary:t.summary,articleText:t.articleText})).sort((a,b)=>a.language.localeCompare(b.language)));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable));return[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
}

export async function loadClassifierStory(db:D1Database,storyId:string):Promise<ClassifierStory|null>{
  const rows=await db.prepare(`SELECT c.id AS storyId,cat.slug AS category,t.id,t.language,t.headline,t.summary,t.article_content AS articleContent,t.content_type AS contentType,t.published_at AS publishedAt,t.article_published_at AS articlePublishedAt,
    COALESCE((SELECT json_group_array(json_object('kind',a.kind,'nameEn',a.name_en,'nameDv',a.name_dv)) FROM article_credits ac JOIN authors a ON a.id=ac.author_id WHERE ac.translation_id=t.id AND ac.role='author'),'[]') AS authors
    FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id LEFT JOIN categories cat ON cat.id=c.category_id
    WHERE c.id=? AND c.status='published' AND t.review_status='published' AND t.article_status='published' AND t.article_content IS NOT NULL AND t.article_published_at IS NOT NULL AND t.language IN ('en','dv') ORDER BY t.language`).bind(storyId).all<Record<string,unknown>>();
  if(!rows.results.length)return null;
  return{storyId,category:(rows.results[0].category as string|null)??null,translations:rows.results.map(row=>({id:String(row.id),language:row.language as"en"|"dv",headline:String(row.headline),summary:String(row.summary),articleText:articleText(String(row.articleContent)),contentType:(row.contentType as ArticleContentType|null)??null,publishedAt:Number(row.publishedAt),articlePublishedAt:Number(row.articlePublishedAt),authors:JSON.parse(String(row.authors??"[]"))}))};
}

export async function analyzeClassifierStory(db:D1Database,provider:ContentTypeClassifierProvider,storyId:string,{force=false}:{force?:boolean}={}){
  const story=await loadClassifierStory(db,storyId);if(!story)throw new Error("Published detailed story not found");
  if(!story.translations.some(item=>item.contentType===null))throw new Error("Story has no unclassified published translation");
  const fingerprint=await contentFingerprint(story);
  if(!force){const cached=await db.prepare("SELECT * FROM content_type_recommendations WHERE story_id=? AND content_fingerprint=?").bind(storyId,fingerprint).first<Record<string,unknown>>();if(cached)return recommendationRow(cached,true)}
  const result=validateClassifierResult(await provider.classify(story)),now=Date.now();
  await db.prepare(`INSERT INTO content_type_recommendations(story_id,content_fingerprint,recommended_type,confidence,reason,needs_human_review,flags,language_recommendations,provider,model,generated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(story_id) DO UPDATE SET content_fingerprint=excluded.content_fingerprint,recommended_type=excluded.recommended_type,confidence=excluded.confidence,reason=excluded.reason,needs_human_review=excluded.needs_human_review,flags=excluded.flags,language_recommendations=excluded.language_recommendations,provider=excluded.provider,model=excluded.model,generated_at=excluded.generated_at`)
    .bind(storyId,fingerprint,result.recommendedType,result.confidence,result.reason,result.needsHumanReview?1:0,JSON.stringify(result.flags),JSON.stringify(result.languageRecommendations),provider.provider,provider.model,now).run();
  return{...result,storyId,fingerprint,provider:provider.provider,model:provider.model,generatedAt:now,cached:false};
}

export function recommendationRow(row:Record<string,unknown>,cached=false){return{storyId:String(row.story_id),fingerprint:String(row.content_fingerprint),recommendedType:row.recommended_type as ClassifierType,confidence:Number(row.confidence),reason:String(row.reason),needsHumanReview:Boolean(row.needs_human_review),flags:JSON.parse(String(row.flags)),languageRecommendations:JSON.parse(String(row.language_recommendations)),provider:String(row.provider),model:String(row.model),generatedAt:Number(row.generated_at),cached}}
