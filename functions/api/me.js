// GET /api/me — 今のログインの状態。
//   { enabled: false }                     … アカウントの機能が、まだ有効でない(プレビューなど)
//   { enabled: true, user: null }          … ログインしていない
//   { enabled: true, user: { nickname, email, createdAt, rankingOptIn } }
import { authStatus, isInvited } from "../_lib/config.js";
import { json, methodNotAllowed, nowSeconds } from "../_lib/http.js";
import { findSession } from "../_lib/session.js";
import { getUser } from "../_lib/users.js";

export async function onRequestGet({ request, env }) {
  if (!authStatus(env).enabled) return json({ enabled: false });

  const session = await findSession(env.DB, request, nowSeconds());
  const user = session && (await getUser(env.DB, session.userId));
  if (!user || !isInvited(env, user.email)) return json({ enabled: true, user: null });
  return json({
    enabled: true,
    user: {
      nickname: user.nickname,
      email: user.email,
      createdAt: user.createdAt,
      rankingOptIn: user.rankingOptIn,
    },
  });
}

export const onRequest = () => methodNotAllowed(["GET"]);
