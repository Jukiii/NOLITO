import { listArticles } from "./_lib/articles-db.js";
import { methodNotAllowed } from "./_lib/http.js";
import { SLUG_PATTERN } from "../scripts/lib/article-fields.mjs";

const PUBLIC_PATHS = [
  "/",
  "/about/",
  "/ads-policy/",
  "/articles/",
  "/games/",
  "/games/escape-boss/",
  "/games/escape-boss/about/",
  "/games/escape-boss/glossary/",
  "/privacy/",
  "/search/",
  "/software/",
  "/support/",
  "/terms/",
  "/tools/",
  "/tools/kii-michi/",
  "/tools/kii-michi/about/",
  "/updates/",
];

const xmlEscape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function articleSlugs(env, request) {
  if (env.DB) return (await listArticles(env.DB, { publishedOnly: true })).map(({ slug }) => slug);

  const response = await env.ASSETS.fetch(new URL("/data/articles.json", request.url));
  if (!response.ok) throw new Error("articles-unavailable");
  const data = await response.json();
  return Array.isArray(data.articles) ? data.articles.map((article) => article?.slug) : [];
}

export async function onRequestGet({ env, request }) {
  if (!env.ASSETS) return new Response("unavailable", { status: 503 });

  const siteResponse = await env.ASSETS.fetch(new URL("/data/site.json", request.url));
  if (!siteResponse.ok) return new Response("unavailable", { status: 503 });
  const site = await siteResponse.json();
  const slugs = await articleSlugs(env, request);
  const urls = [
    ...PUBLIC_PATHS,
    ...slugs
      .filter((slug) => typeof slug === "string" && SLUG_PATTERN.test(slug))
      .map((slug) => `/articles/${slug}/`),
  ].map((path) => `<url><loc>${xmlEscape(new URL(path, `${site.url}/`).href)}</loc></url>`);

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export const onRequest = (context) =>
  context.request.method === "GET" ? onRequestGet(context) : methodNotAllowed(["GET"]);
