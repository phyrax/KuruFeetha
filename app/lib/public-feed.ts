export type InitialStory = {
  kind: "story";
  id: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  youtubeVideoId: string | null;
  category: string;
  categoryName: string;
  publishedAt: number;
  updatedAt: number;
  relatedGalleryId: string | null;
  hasArticle: number;
  articleUrl: string | null;
  breaking: number;
  important: number;
  timeSensitive: number;
  followed: number;
  affinity: number;
};

type QueryResult<T>={results:T[]};
interface PublicStatement{bind(...values:unknown[]):PublicStatement;all<T>():Promise<QueryResult<T>>}
export interface PublicDatabase{prepare(query:string):PublicStatement}

export async function getInitialPublicFeed(db: PublicDatabase, language: "en" | "dv" = "en", limit = 50, categorySlug?: string): Promise<InitialStory[]> {
  const result = await db.prepare(`
    SELECT c.id, c.image_url AS imageUrl, c.youtube_video_id AS youtubeVideoId,
      c.is_breaking AS breaking, c.is_important AS important, c.is_time_sensitive AS timeSensitive,
      c.updated_at AS updatedAt, t.published_at AS publishedAt, t.headline, t.summary,
      cat.slug AS category,
      CASE WHEN ?='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName,
      CASE WHEN t.article_status='published' AND t.article_content IS NOT NULL THEN 1 ELSE 0 END AS hasArticle,
      CASE WHEN t.article_status='published' AND t.article_content IS NOT NULL THEN '/'||?||'/article/'||c.id ELSE NULL END AS articleUrl,
      (SELECT g.id FROM galleries g
        WHERE (CASE WHEN ?='dv' THEN g.related_story_dv_id ELSE g.related_story_en_id END)=c.id
          AND g.status='published'
          AND (CASE WHEN ?='dv' THEN g.published_dv=1 ELSE g.published_en=1 END)
        ORDER BY g.published_at DESC LIMIT 1) AS relatedGalleryId,
      0 AS affinity, 0 AS followed
    FROM news_cards c
    JOIN news_card_translations t ON t.card_id=c.id AND t.language=? AND t.review_status='published'
    LEFT JOIN categories cat ON cat.id=c.category_id
    WHERE c.status='published' AND (? IS NULL OR cat.slug=?)
    ORDER BY t.published_at DESC
    LIMIT ?
  `).bind(language, language, language, language, language, categorySlug??null, categorySlug??null, limit).all<Omit<InitialStory,"kind">>();
  return result.results.map(row => ({ ...row, kind: "story" })) as InitialStory[];
}

export type PublicCategory={id:string;slug:string;nameEn:string;nameDv:string};
export async function getPublicCategories(db:PublicDatabase):Promise<PublicCategory[]>{
  const result=await db.prepare("SELECT id,slug,name_en AS nameEn,name_dv AS nameDv FROM categories WHERE enabled=1 ORDER BY sort_order,name_en").all<PublicCategory>();
  return result.results;
}
