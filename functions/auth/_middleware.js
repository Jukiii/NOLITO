// /auth/* の共通処理: 想定外の例外は、ログインの失敗として、/account/ に戻す(生のエラー画面を見せない)。
import { redirect } from "../_lib/http.js";

export async function onRequest({ next }) {
  try {
    return await next();
  } catch (cause) {
    console.error("auth error", cause?.message);
    return redirect("/account/?error=failed");
  }
}
