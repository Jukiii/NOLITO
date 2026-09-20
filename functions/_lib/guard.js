// エンドポイントの入り口の確認(有効か・CSRF・ログイン済みか・招待されているか)。
import { authStatus, isInvited, siteOrigin } from "./config.js";
import { error, nowSeconds } from "./http.js";
import { findSession } from "./session.js";
import { getUser } from "./users.js";

export const CSRF_HEADER = "X-NOLITO-CSRF";

/**
 * 状態を変える要求(POST・DELETE)の確認。
 * 別のサイトのフォームやスクリプトからは、この 2 つを満たせない:
 *   1. Origin が、このサイトである(ブラウザが付ける。書き換えられない)
 *   2. 独自のヘッダー X-NOLITO-CSRF: 1 がある(別のサイトは、CORS の許可なしに付けられない)
 * 問題がなければ null、あれば、返す応答。
 */
export function checkCsrf(request, env) {
  if (request.headers.get("Origin") !== siteOrigin(env)) return error(403, "bad-origin");
  if (request.headers.get(CSRF_HEADER) !== "1") return error(403, "csrf-header-required");
  return null;
}

/** アカウントの機能が有効か。無効なら、返す応答(503)。 */
export function requireEnabled(env) {
  return authStatus(env).enabled ? null : error(503, "auth-unavailable");
}

/**
 * ログイン済みの利用者を確かめる。
 * 成功: { user, session, now }。失敗: { response }。
 * 招待制のときは、許可リストから外されたメールアドレスを、ここで止める(リストの変更が、すぐ効く)。
 */
export async function requireUser({ request, env }, { write = false } = {}) {
  const disabled = requireEnabled(env);
  if (disabled) return { response: disabled };
  if (write) {
    const bad = checkCsrf(request, env);
    if (bad) return { response: bad };
  }
  const now = nowSeconds();
  const session = await findSession(env.DB, request, now);
  if (!session) return { response: error(401, "not-logged-in") };
  const user = await getUser(env.DB, session.userId);
  if (!user) return { response: error(401, "not-logged-in") };
  if (!isInvited(env, user.email)) return { response: error(403, "not-invited") };
  return { user, session, now };
}
