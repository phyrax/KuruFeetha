export const HOMEPAGE_DISCOVERY_LIMIT=24;
export const CATEGORY_PAGE_SIZE=30;

export type CrawlLanguage="en"|"dv";
export type CrawlArticle={
  id:string;
  language:CrawlLanguage;
  headline:string;
  summary:string;
  imageUrl:string|null;
  articlePublishedAt:number;
  categorySlug:string;
  categoryName:string;
  articleUrl:string;
};

type QueryResult<T>={results:T[]};
interface CrawlStatement{bind(...values:unknown[]):CrawlStatement;all<T>():Promise<QueryResult<T>>}
export interface CrawlDatabase{prepare(query:string):CrawlStatement}

type ArticleRow=Omit<CrawlArticle,"articleUrl">;

const PUBLIC_ARTICLE_WHERE=`c.status='published'
      AND t.review_status='published'
      AND t.article_status='published'
      AND t.article_content IS NOT NULL
      AND t.article_published_at IS NOT NULL
      AND cat.enabled=1`;

function publicArticle(row:ArticleRow):CrawlArticle{
  return{...row,articleUrl:`/${row.language}/article/${row.id}`};
}

export async function getHomepageArticleLinks(db:CrawlDatabase,limit=HOMEPAGE_DISCOVERY_LIMIT):Promise<CrawlArticle[]>{
  const result=await db.prepare(`
    WITH ranked AS (
      SELECT c.id,t.language,t.headline,t.summary,c.image_url AS imageUrl,t.article_published_at AS articlePublishedAt,
        cat.slug AS categorySlug,
        CASE WHEN t.language='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName,
        ROW_NUMBER() OVER (PARTITION BY t.language ORDER BY t.article_published_at DESC,c.id) AS languageRank
      FROM news_cards c
      JOIN news_card_translations t ON t.card_id=c.id
      JOIN categories cat ON cat.id=c.category_id
      WHERE ${PUBLIC_ARTICLE_WHERE}
        AND t.language IN ('en','dv')
    )
    SELECT id,language,headline,summary,imageUrl,articlePublishedAt,categorySlug,categoryName
    FROM ranked WHERE languageRank<=?
    ORDER BY articlePublishedAt DESC,id,language
  `).bind(limit).all<ArticleRow>();
  const targetPerLanguage=Math.floor(limit/2),selected=result.results.filter((row,index,rows)=>rows.filter(candidate=>candidate.language===row.language).indexOf(row)<targetPerLanguage),selectedKeys=new Set(selected.map(row=>`${row.language}:${row.id}`));
  for(const row of result.results){if(selected.length>=limit)break;if(!selectedKeys.has(`${row.language}:${row.id}`)){selected.push(row);selectedKeys.add(`${row.language}:${row.id}`)}}
  return selected.sort((a,b)=>b.articlePublishedAt-a.articlePublishedAt||a.id.localeCompare(b.id)||a.language.localeCompare(b.language)).map(publicArticle);
}

export type CategoryArchivePage={articles:CrawlArticle[];hasPrevious:boolean;hasNext:boolean;page:number};

export async function getCategoryArchivePage(db:CrawlDatabase,language:CrawlLanguage,slug:string,page:number):Promise<CategoryArchivePage>{
  const offset=(page-1)*CATEGORY_PAGE_SIZE;
  const result=await db.prepare(`
    SELECT c.id,t.language,t.headline,t.summary,c.image_url AS imageUrl,t.article_published_at AS articlePublishedAt,
      cat.slug AS categorySlug,
      CASE WHEN t.language='dv' THEN cat.name_dv ELSE cat.name_en END AS categoryName
    FROM news_cards c
    JOIN news_card_translations t ON t.card_id=c.id AND t.language=?
    JOIN categories cat ON cat.id=c.category_id
    WHERE ${PUBLIC_ARTICLE_WHERE}
      AND cat.slug=?
    ORDER BY t.article_published_at DESC,c.id
    LIMIT ? OFFSET ?
  `).bind(language,slug,CATEGORY_PAGE_SIZE+1,offset).all<ArticleRow>();
  return{articles:result.results.slice(0,CATEGORY_PAGE_SIZE).map(publicArticle),hasPrevious:page>1,hasNext:result.results.length>CATEGORY_PAGE_SIZE,page};
}

export async function getPopulatedCategoryLanguages(db:CrawlDatabase,slug:string):Promise<CrawlLanguage[]>{
  const result=await db.prepare(`
    SELECT DISTINCT t.language
    FROM news_cards c
    JOIN news_card_translations t ON t.card_id=c.id
    JOIN categories cat ON cat.id=c.category_id
    WHERE ${PUBLIC_ARTICLE_WHERE}
      AND cat.slug=? AND t.language IN ('en','dv')
    ORDER BY t.language
  `).bind(slug).all<{language:CrawlLanguage}>();
  return result.results.map(row=>row.language);
}

export function parseCategoryPage(value:string|string[]|undefined):number|null{
  if(value===undefined)return 1;
  if(Array.isArray(value)||!/^[1-9]\d*$/.test(value))return null;
  const page=Number(value);
  return Number.isSafeInteger(page)&&Number.isSafeInteger((page-1)*CATEGORY_PAGE_SIZE)?page:null;
}

export function categoryArchivePath(language:CrawlLanguage,slug:string,page=1):string{
  const path=`/${language}/category/${encodeURIComponent(slug)}`;
  return page>1?`${path}?page=${page}`:path;
}

export function missingCategoryArchivePage(page:number,articleCount:number):boolean{
  return page>1&&articleCount===0;
}

export function categoryRobots(articleCount:number):{index:boolean;follow:true}{
  return{index:articleCount>0,follow:true};
}
