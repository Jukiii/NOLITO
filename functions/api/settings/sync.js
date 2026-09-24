// GET/POST /api/settings/sync — サイト全体の見た目の設定(テーマ・文字サイズ・アニメーション軽減)を、
// アカウントに保存・取得する(任意)。GET: { settings: null | {...} }。
// POST: body は { theme, fontSize, reducedMotion }。成功: { ok: true, settings }。
import { EVENTS, audit } from "../../_lib/audit.js";
import { requireUser } from "../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../_lib/http.js";
import { hit } from "../../_lib/rate-limit.js";
import { getSyncedSettings, MAX_BODY_BYTES, saveSyncedSettings } from "../../_lib/settings-sync.js";

export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  const settings = await getSyncedSettings(context.env.DB, auth.user.id);
  return json({ settings });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "settings-sync",
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

  const settings = await saveSyncedSettings(env.DB, user.id, body.value, now);
  if (!settings) return error(400, "invalid-settings");
  await audit(env.DB, { event: EVENTS.settingsSyncSave, userId: user.id, now });
  return json({ ok: true, settings });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);
