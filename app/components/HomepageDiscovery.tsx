// @ts-expect-error vinext provides this Cloudflare runtime module during its build.
import {env} from "cloudflare:workers";
import {getHomepageArticleLinks,type CrawlDatabase} from "../lib/crawl-discovery.ts";
import {getPublicCategories,type PublicDatabase} from "../lib/public-feed.ts";
import {HomepageDiscoveryContent} from "./HomepageDiscoveryContent.tsx";

export async function HomepageDiscovery(){
  const db=(env as unknown as{DB:CrawlDatabase&PublicDatabase}).DB;
  const[articles,categories]=await Promise.all([getHomepageArticleLinks(db).catch(()=>[]),getPublicCategories(db).catch(()=>[])]);
  return <HomepageDiscoveryContent articles={articles} categories={categories}/>;
}
