// GET /api/articles — 公開の記事の一覧(articles.json と同じ形。{ articles })。ログイン不要。下書きは含めない。
// D1(Issue #195 から、保存元)から、その場で組み立てる。D1 がない環境(プレビューなど)では、
// コミット済みの静的な内容(public/data/articles.json)にフォールバックする。
import { assemblePublicArticles } from "../_lib/articles-db.js";
import { error, json, methodNotAllowed } from "../_lib/http.js";

const FALLBACK_PATH = "/data/articles.json";

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    if (!env.ASSETS) return error(503, "articles-unavailable");
    return env.ASSETS.fetch(new URL(FALLBACK_PATH, request.url));
  }
  const data = await assemblePublicArticles(env.DB);
  return json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}

export const onRequest = () => methodNotAllowed(["GET"]);
