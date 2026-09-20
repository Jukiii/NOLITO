// POST /api/profile — ニックネームを変える。body: { "nickname": "..." }
// 不正な値は、切り詰めずに、断る(400)。
import { EVENTS, audit } from "../_lib/audit.js";
import { requireUser } from "../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../_lib/http.js";
import { hit } from "../_lib/rate-limit.js";
import { setNickname } from "../_lib/users.js";
import { validateNickname } from "../_lib/validate.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "profile",
    subject: user.id,
    limit: 30,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const body = await readJson(request);
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);
  const nickname = validateNickname(body.value.nickname);
  if (!nickname.ok) return error(400, nickname.error);

  const updated = await setNickname(env.DB, user.id, nickname.value);
  await audit(env.DB, { event: EVENTS.profileUpdate, userId: user.id, now });
  return json({
    user: { nickname: updated.nickname, email: updated.email, createdAt: updated.createdAt },
  });
}

export const onRequest = () => methodNotAllowed(["POST"]);
