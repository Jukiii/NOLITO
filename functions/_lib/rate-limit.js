// 回数の制限(D1 に、窓ごとの回数を持つ)。キーは、IP の HMAC(IP そのものは、保存しない)。
import { hmac } from "./crypto.js";

/**
 * name の操作を、windowSeconds の間に limit 回まで許す。
 * 許すなら { ok: true }、超えたら { ok: false, retryAfter }。
 */
export async function hit(db, secret, { name, subject, limit, windowSeconds, now }) {
  const key = `${name}:${await hmac(secret, `rate-limit:${subject}`)}`;
  // 窓が過ぎていたら、1 から数え直す。そうでなければ、1 足す
  await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END`,
    )
    .bind(key, now, windowSeconds)
    .run();
  const row = await db
    .prepare("SELECT window_start, count FROM rate_limits WHERE key = ?")
    .bind(key)
    .first();
  if (row.count <= limit) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, row.window_start + windowSeconds - now) };
}

/** 古い窓を消す(ログイン時に、ときどき行う)。 */
export async function pruneRateLimits(db, now, maxAgeSeconds = 24 * 60 * 60) {
  try {
    await db
      .prepare("DELETE FROM rate_limits WHERE window_start < ?")
      .bind(now - maxAgeSeconds)
      .run();
  } catch (cause) {
    console.error("rate-limit prune failed", cause?.message);
  }
}

/** リクエストの送信元(Cloudflare が付ける)。なければ、まとめて 1 つとして数える。 */
export const clientIp = (request) => request.headers.get("CF-Connecting-IP") ?? "unknown";
