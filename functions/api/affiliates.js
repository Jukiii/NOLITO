// GET /api/affiliates — アフィリエイト・広告のリンク情報(affiliates.json と同じ形。{ version, links })。ログイン不要。
// D1(Phase 29 PR 3 から、保存元)から、その場で組み立てる。管理画面での変更が、すぐ反映される。
// D1 がない環境(プレビューなど)では、コミット済みの静的な内容(public/data/affiliates.json)にフォールバックする。
// どちらの場合も、広告枠は、リンクが取れなければ非表示のまま(components/affiliate-list.js)。
import { assembleAffiliatesJson } from "../_lib/affiliates-db.js";
import { error, json, methodNotAllowed } from "../_lib/http.js";

const FALLBACK_PATH = "/data/affiliates.json";

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    if (!env.ASSETS) return error(503, "affiliates-unavailable");
    return env.ASSETS.fetch(new URL(FALLBACK_PATH, request.url));
  }
  const data = await assembleAffiliatesJson(env.DB);
  return json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}

export const onRequest = () => methodNotAllowed(["GET"]);
