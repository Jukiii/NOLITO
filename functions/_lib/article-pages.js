// 公開の記事ページ(/articles/ と /articles/<スラッグ>/)を、D1 から組み立てる(Issue #195 PR 3)。
// 見た目の HTML は、原稿のビルドと同じ scripts/lib/render.mjs(静的だったころと同じ)。
// D1 がない環境(プレビューなど)は、生成済みの静的な写し(public/articles-static/)を返す。
import { renderMarkdown } from "../../scripts/lib/markdown.mjs";
import { renderArticleIndex, renderArticlePage } from "../../scripts/lib/render.mjs";
import { SLUG_PATTERN } from "../../scripts/lib/article-fields.mjs";
import { getArticle, listArticles } from "./articles-db.js";

const SITE_PATH = "/data/site.json";
const STATIC_DIR = "/articles-static";
const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60",
};

async function loadSite(env, request) {
  const response = await env.ASSETS.fetch(new URL(SITE_PATH, request.url));
  return response.json();
}

async function notFound(env, request) {
  const page = await env.ASSETS.fetch(new URL("/404.html", request.url));
  return new Response(page.body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const fallback = (env, request, path) => env.ASSETS.fetch(new URL(path, request.url));

/** GET /articles/ — 公開の記事の一覧ページ。 */
export async function articleIndexResponse({ env, request }) {
  if (!env.ASSETS) return new Response("unavailable", { status: 503 });
  if (!env.DB) return fallback(env, request, `${STATIC_DIR}/`);
  const [site, articles] = await Promise.all([
    loadSite(env, request),
    listArticles(env.DB, { publishedOnly: true }),
  ]);
  return new Response(renderArticleIndex(articles, site), { headers: HTML_HEADERS });
}

/** GET /articles/<スラッグ>/ — 公開の記事ページ。下書き・ない記事は 404。 */
export async function articlePageResponse({ env, request, params }) {
  if (!env.ASSETS) return new Response("unavailable", { status: 503 });
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return notFound(env, request);
  if (!env.DB) return fallback(env, request, `${STATIC_DIR}/${slug}/`);

  const article = await getArticle(env.DB, slug);
  if (!article || article.draft) return notFound(env, request);
  const site = await loadSite(env, request);
  const html = renderMarkdown(article.body, { siteHost: new URL(site.url).hostname });
  return new Response(renderArticlePage(article, html, site), { headers: HTML_HEADERS });
}
