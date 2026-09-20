// /api/* の共通処理: 想定外の例外(D1 の障害など)を、Cloudflare の生のエラー画面でなく、JSON で返す。
// 詳しい内容は、ログにだけ出し、利用者には返さない。
// (ルート直下の functions/_middleware.js にはしない。静的ページの配信まで、関数を通ってしまい、無料枠を使うため)
import { error } from "../_lib/http.js";

export async function onRequest({ next }) {
  try {
    return await next();
  } catch (cause) {
    console.error("api error", cause?.message);
    return error(500, "server-error");
  }
}
