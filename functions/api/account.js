// DELETE /api/account — アカウントの削除。body: { "confirm": "delete" }
// 取り消せないので、直近 10 分以内にログインしたセッションだけに許す(それ以外は 403 reauth-required。
// 画面は、/auth/google/login?reauth=1 で、もう一度ログインさせる)。
import { EVENTS, audit } from "../_lib/audit.js";
import { requireUser } from "../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../_lib/http.js";
import { hit } from "../_lib/rate-limit.js";
import { clearSessionCookie } from "../_lib/session.js";
import { deleteUser } from "../_lib/users.js";

export const REAUTH_WINDOW_SECONDS = 10 * 60;
export const CONFIRM_WORD = "delete";

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, session, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "account-delete",
    subject: user.id,
    limit: 5,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const body = await readJson(request);
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);
  if (body.value.confirm !== CONFIRM_WORD) return error(400, "confirm-required");

  if (now - session.createdAt > REAUTH_WINDOW_SECONDS) return error(403, "reauth-required");

  await deleteUser(env.DB, user.id);
  await audit(env.DB, { event: EVENTS.accountDelete, now }); // 削除した後なので、user_id は入れない
  return json({ ok: true }, { cookies: [clearSessionCookie()] });
}

export const onRequest = () => methodNotAllowed(["DELETE"]);
