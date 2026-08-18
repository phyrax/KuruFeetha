import type {CrawlArticle} from "../lib/crawl-discovery.ts";
import type {PublicCategory} from "../lib/public-feed.ts";

export function HomepageDiscoveryContent({articles,categories}:{articles:CrawlArticle[];categories:PublicCategory[]}){
  return <section className="homepage-discovery" aria-labelledby="homepage-discovery-title">
    <div className="homepage-discovery-heading"><p>NEWS DIRECTORY</p><h2 id="homepage-discovery-title">Latest detailed news</h2></div>
    {articles.length>0&&<div className="homepage-article-links">{articles.map(article=><a href={article.articleUrl} key={`${article.language}-${article.id}`} lang={article.language} dir={article.language==="dv"?"rtl":"ltr"}><span>{article.categoryName}</span><strong>{article.headline}</strong></a>)}</div>}
    <nav className="public-category-directory" aria-label="News categories"><strong>Browse news categories</strong><div>{categories.flatMap(category=>[<a key={`en-${category.id}`} href={`/en/category/${encodeURIComponent(category.slug)}`}>{category.nameEn}</a>,<a key={`dv-${category.id}`} href={`/dv/category/${encodeURIComponent(category.slug)}`} dir="rtl" lang="dv">{category.nameDv}</a>])}</div></nav>
  </section>;
}
