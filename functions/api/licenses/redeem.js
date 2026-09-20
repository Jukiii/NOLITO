// POST /api/licenses/redeem — ライセンスキーを、自分のアカウントに登録する。body: { "key": "NLTO-..." }
// 存在しない・他の人が使用済み・無効は、同じ応答(license-invalid)にする(キーの存在を、探れないように)。
import { EVENTS, audit } from "../../_lib/audit.js";
import { requireUser } from "../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../_lib/http.js";
import { hashKey, normalizeKey, redeemLicense } from "../../_lib/licenses.js";
import { clientIp, hit } from "../../_lib/rate-limit.js";

const LIMIT = 5; // 総当たりを防ぐ。1 人が、10 分に試せる回数
const IP_LIMIT = 20; // アカウントを増やして試す人への、送信元ごとの上限
const WINDOW_SECONDS = 600;

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  for (const [name, subject, limit] of [
    ["license-redeem", user.id, LIMIT],
    ["license-redeem-ip", clientIp(request), IP_LIMIT],
  ]) {
    const result = await hit(env.DB, env.SESSION_SECRET, {
      name,
      subject,
      limit,
      windowSeconds: WINDOW_SECONDS,
      now,
    });
    if (!result.ok) return error(429, "rate-limited", { retryAfter: result.retryAfter });
  }

  const body = await readJson(request);
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);
  const canonical = normalizeKey(body.value.key);
  if (!canonical) return error(400, "license-format");

  const result = await redeemLicense(env.DB, {
    userId: user.id,
    keyHash: await hashKey(canonical),
    now,
  });
  if (!result.ok) {
    await audit(env.DB, { event: EVENTS.licenseRedeemFailed, userId: user.id, now });
    return error(400, "license-invalid");
  }
  if (!result.already) {
    await audit(env.DB, {
      event: EVENTS.licenseRedeem,
      userId: user.id,
      detail: result.license.productId,
      now,
    });
  }
  return json({ license: result.license, already: result.already });
}

export const onRequest = () => methodNotAllowed(["POST"]);
