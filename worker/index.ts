/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {articleSitemap,publicSitemap,robotsResponse,sitemapIndex} from "./seo-sitemaps";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
      const response=await sitemapIndex(env.DB);
      return request.method === "HEAD" ? new Response(null,{status:response.status,headers:response.headers}) : response;
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemaps/public.xml") {
      const response=await publicSitemap(env.DB);
      return request.method === "HEAD" ? new Response(null,{status:response.status,headers:response.headers}) : response;
    }
    const articleSitemapMatch=url.pathname.match(/^\/sitemaps\/articles-(\d+)\.xml$/);
    if ((request.method === "GET" || request.method === "HEAD") && articleSitemapMatch) {
      const response=await articleSitemap(env.DB,Number(articleSitemapMatch[1]));
      return request.method === "HEAD" ? new Response(null,{status:response.status,headers:response.headers}) : response;
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
      const response=robotsResponse();
      return request.method === "HEAD" ? new Response(null,{status:response.status,headers:response.headers}) : response;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml && !url.pathname.startsWith("/api/")) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  },
};

export default worker;
