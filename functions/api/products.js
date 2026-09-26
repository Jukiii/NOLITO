// GET /api/products — プロダクト一覧(products.json と同じ形。{ version, products }）。ログイン不要・だれでも見られる。
// D1(Phase 26 PR 2 から、プロダクトの保存元)から、その場で組み立てる。管理画面での変更が、すぐ反映される。
// D1 がない環境(プレビューなど。docs/auth-setup.md の注記どおり、D1 は本番にしかつながない)では、
// コミット済みの静的な内容(public/data/products.json)にフォールバックする(壊れたページにしないため)。
import { assembleProductsJson } from "../_lib/products-db.js";
import { error, json, methodNotAllowed } from "../_lib/http.js";

const FALLBACK_PATH = "/data/products.json";

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    if (!env.ASSETS) return error(503, "products-unavailable");
    return env.ASSETS.fetch(new URL(FALLBACK_PATH, request.url));
  }
  const data = await assembleProductsJson(env.DB);
  // 公開データなので、少しの間はキャッシュしてよい(短い間隔での再取得を減らす)
  return json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}

export const onRequest = () => methodNotAllowed(["GET"]);
