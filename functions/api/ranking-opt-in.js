// POST /api/ranking-opt-in — オンラインランキングへの参加を、切り替える。body: { "enabled": true|false }
// 参加をやめたら、公開されている記録(ranking_entries)も、すぐに消す(setRankingOptIn の中)。
import { EVENTS, audit } from "../_lib/audit.js";
import { requireUser } from "../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../_lib/http.js";
import { hit } from "../_lib/rate-limit.js";
import { setRankingOptIn } from "../_lib/users.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "ranking-opt-in",
    subject: user.id,
    limit: 30,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const body = await readJson(request);
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);
  if (typeof body.value.enabled !== "boolean") return error(400, "enabled-required");

  const updated = await setRankingOptIn(env.DB, user.id, body.value.enabled);
  await audit(env.DB, { event: EVENTS.rankingOptInChange, userId: user.id, now });
  return json({ ok: true, rankingOptIn: updated.rankingOptIn });
}

export const onRequest = () => methodNotAllowed(["POST"]);
