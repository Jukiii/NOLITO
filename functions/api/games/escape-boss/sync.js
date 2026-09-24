// GET/POST /api/games/escape-boss/sync — ゲームの記録の要約を、アカウントに保存・取得する(任意)。
// 1プレイごとの詳細な記録は、扱わない(端末にとどまる)。GET: { progress: null | {...} }。
// POST: body はクライアントの syncProgressOf() の形。成功: { ok: true, progress }。
import { EVENTS, audit } from "../../../_lib/audit.js";
import { getSyncedProgress, MAX_BODY_BYTES, saveSyncedProgress } from "../../../_lib/game-sync.js";
import { requireUser } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { hit } from "../../../_lib/rate-limit.js";

export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  const progress = await getSyncedProgress(context.env.DB, auth.user.id);
  return json({ progress });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "game-sync",
    subject: user.id,
    limit: 30,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return error(413, "too-large");
  const body = await readJson(request, { maxBytes: MAX_BODY_BYTES });
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);

  const progress = await saveSyncedProgress(env.DB, user.id, body.value, now);
  if (!progress) return error(400, "invalid-progress");
  await audit(env.DB, { event: EVENTS.gameSyncSave, userId: user.id, now });
  return json({ ok: true, progress });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);
