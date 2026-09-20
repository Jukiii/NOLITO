// ログインの状態(セッション)。トークンは、推測できない 256 ビットの乱数。DB には、SHA-256 のハッシュだけを置く。
import { randomToken, sha256 } from "./crypto.js";
import { SESSION_COOKIE } from "./config.js";
import { clearCookie, cookie, parseCookies } from "./http.js";

export const IDLE_SECONDS = 30 * 24 * 60 * 60; // 30 日使わなければ、切れる
export const ABSOLUTE_SECONDS = 90 * 24 * 60 * 60; // 使い続けても、90 日で切れる
export const MAX_SESSIONS_PER_USER = 10; // 端末を増やしても、古いものから消える
const TOUCH_INTERVAL_SECONDS = 60 * 60; // 最終利用の更新は、1 時間に 1 回まで(書き込みを減らす)

/** セッションを作る。Set-Cookie の値も返す。ログインのたびに、新しいトークンにする(固定化攻撃の対策)。 */
export async function createSession(db, userId, now) {
  const token = randomToken(32);
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
    )
    .bind(await sha256(token), userId, now, now)
    .run();
  await db
    .prepare(
      `DELETE FROM sessions WHERE user_id = ?1 AND token_hash NOT IN (
         SELECT token_hash FROM sessions WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2)`,
    )
    .bind(userId, MAX_SESSIONS_PER_USER)
    .run();
  return { token, setCookie: cookie(SESSION_COOKIE, token, { maxAge: ABSOLUTE_SECONDS }) };
}

export const sessionToken = (request) =>
  parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE] ?? null;

/** リクエストのセッションを確かめる。有効なら { userId, createdAt }、なければ null(期限切れは、消す)。 */
export async function findSession(db, request, now) {
  const token = sessionToken(request);
  if (!token || token.length > 128) return null;
  const hash = await sha256(token);
  const row = await db
    .prepare("SELECT user_id, created_at, last_seen_at FROM sessions WHERE token_hash = ?")
    .bind(hash)
    .first();
  if (!row) return null;
  if (now - row.last_seen_at > IDLE_SECONDS || now - row.created_at > ABSOLUTE_SECONDS) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
    return null;
  }
  if (now - row.last_seen_at >= TOUCH_INTERVAL_SECONDS) {
    await db
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
      .bind(now, hash)
      .run();
  }
  return { userId: row.user_id, createdAt: row.created_at };
}

/** このリクエストのセッションを、終わらせる。 */
export async function destroySession(db, request) {
  const token = sessionToken(request);
  if (token)
    await db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256(token))
      .run();
}

/** ブラウザのセッション Cookie を消す Set-Cookie の値。 */
export const clearSessionCookie = () => clearCookie(SESSION_COOKIE);

/** 古いセッションを、まとめて消す(ログイン時に、ときどき行う)。 */
export async function pruneSessions(db, now) {
  try {
    await db
      .prepare("DELETE FROM sessions WHERE last_seen_at < ? OR created_at < ?")
      .bind(now - IDLE_SECONDS, now - ABSOLUTE_SECONDS)
      .run();
  } catch (cause) {
    console.error("session prune failed", cause?.message);
  }
}
