// 問い合わせフォームの API(Phase 10 PR 3)。ログインは、要らない。
//   GET  /api/contact … { enabled: boolean }(設定がなければ false。ページは「準備中」を出す)
//   POST /api/contact … { category, product, message, email, includeEnv, env, website, elapsed } → { ok: true }
// 内容は D1 に保存する(運営者が、手元のスクリプトで読む)。メールは、送らない。
// 罠の欄が埋まっている・速すぎる送信は、保存せず、成功したように見せる(ボットに、失敗を教えない)。
import { EVENTS, audit, pruneAudit } from "../_lib/audit.js";
import { contactStatus } from "../_lib/config.js";
import { MAX_BODY_BYTES, storeInquiry, validateInquiry } from "../_lib/contact.js";
import { checkCsrf } from "../_lib/guard.js";
import { error, json, methodNotAllowed, nowSeconds, readJson } from "../_lib/http.js";
import { clientIp, hit, pruneRateLimits } from "../_lib/rate-limit.js";

const IP_LIMIT = 3; // 1 つの送信元が、1 時間に送れる数
const IP_WINDOW_SECONDS = 60 * 60;
const GLOBAL_LIMIT = 100; // 全体で、1 日に受ける数(洪水で、D1 の無料枠を使い切らないため)
const GLOBAL_WINDOW_SECONDS = 24 * 60 * 60;
const PRUNE_PROBABILITY = 0.05;

export const onRequestGet = ({ env }) => json({ enabled: contactStatus(env).enabled });

export async function onRequestPost({ request, env }) {
  if (!contactStatus(env).enabled) return error(503, "contact-unavailable");
  const bad = checkCsrf(request, env);
  if (bad) return bad;

  // 本文を読む前に、宣言された大きさで断る(大きな本文を、メモリに読み込まない)
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return error(413, "too-large");

  const now = nowSeconds();
  for (const [name, subject, limit, windowSeconds] of [
    ["contact-ip", clientIp(request), IP_LIMIT, IP_WINDOW_SECONDS],
    ["contact-all", "all", GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS],
  ]) {
    const result = await hit(env.DB, env.SESSION_SECRET, {
      name,
      subject,
      limit,
      windowSeconds,
      now,
    });
    if (!result.ok) {
      await audit(env.DB, { event: EVENTS.rateLimited, detail: name, now });
      return error(429, "rate-limited", { retryAfter: result.retryAfter });
    }
  }

  const body = await readJson(request, { maxBytes: MAX_BODY_BYTES });
  if (!body.ok) {
    const status =
      body.error === "unsupported-media-type" ? 415 : body.error === "too-large" ? 413 : 400;
    return error(status, body.error);
  }

  const result = validateInquiry(body.value, {
    userAgent: request.headers.get("User-Agent") ?? "",
  });
  if (result.bot) return json({ ok: true }); // 保存しない
  if (!result.ok) return error(400, result.error);

  await storeInquiry(env.DB, result.value, now);
  // 監査ログには、種類だけ(本文・メールアドレスは、入れない)
  await audit(env.DB, { event: EVENTS.inquiryReceived, detail: result.value.category, now });

  if (Math.random() < PRUNE_PROBABILITY) {
    await Promise.all([pruneAudit(env.DB, now), pruneRateLimits(env.DB, now)]);
  }
  return json({ ok: true });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);
