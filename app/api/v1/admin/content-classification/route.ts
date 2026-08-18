import{env}from"cloudflare:workers";
import{authErrorResponse,requireAdmin}from"../../../../lib/auth";
import{contentFingerprint,loadClassifierStory,recommendationRow}from"../../../../lib/content-type-classifier";

export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{await requireAdmin(request)}catch(error){return authErrorResponse(error)}
  const db=(env as unknown as{DB:D1Database}).DB;
  const ids=await db.prepare(`SELECT DISTINCT c.id FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id WHERE c.status='published' AND t.review_status='published' AND t.article_status='published' AND t.article_content IS NOT NULL AND t.article_published_at IS NOT NULL AND t.content_type IS NULL ORDER BY t.article_published_at DESC LIMIT 100`).all<{id:string}>();
  const items=[];for(const{id}of ids.results){const story=await loadClassifierStory(db,id);if(!story)continue;const fingerprint=await contentFingerprint(story),cached=await db.prepare("SELECT * FROM content_type_recommendations WHERE story_id=?").bind(id).first<Record<string,unknown>>();items.push({storyId:id,category:story.category,languages:story.translations.map(t=>t.language),translations:story.translations.map(({articleText,...translation})=>({...translation,articleUrl:`/${translation.language}/article/${id}`,articleLength:articleText.length})),recommendation:cached&&cached.content_fingerprint===fingerprint?recommendationRow(cached,true):null,staleRecommendation:Boolean(cached&&cached.content_fingerprint!==fingerprint)})}
  return Response.json({items});
}
