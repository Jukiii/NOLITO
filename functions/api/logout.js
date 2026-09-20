// POST /api/logout — ログアウト(このブラウザのセッションを終わらせる)。
// 招待から外れた後でも、ログアウトはできる(requireUser は使わない)。
import { EVENTS, audit } from "../_lib/audit.js";
import { checkCsrf, requireEnabled } from "../_lib/guard.js";
import { json, methodNotAllowed, nowSeconds } from "../_lib/http.js";
import { clearSessionCookie, destroySession, findSession } from "../_lib/session.js";

export async function onRequestPost({ request, env }) {
  const disabled = requireEnabled(env);
  if (disabled) return disabled;
  const bad = checkCsrf(request, env);
  if (bad) return bad;

  const now = nowSeconds();
  const session = await findSession(env.DB, request, now);
  if (session) {
    await destroySession(env.DB, request);
    await audit(env.DB, { event: EVENTS.logout, userId: session.userId, now });
  }
  return json({ ok: true }, { cookies: [clearSessionCookie()] });
}

export const onRequest = () => methodNotAllowed(["POST"]);
