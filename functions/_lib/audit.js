// 監査ログ(いつ・だれが・何をしたか)。メールアドレスなどの個人情報は、書かない(user_id と、出来事の種類だけ)。
// ログの書き込みに失敗しても、本来の処理は止めない。

export const EVENTS = Object.freeze({
  login: "login",
  loginDenied: "login-denied", // 招待制で、許可リストにない
  loginFailed: "login-failed", // 検証に失敗した(state・トークンなど)
  logout: "logout",
  profileUpdate: "profile-update",
  accountDelete: "account-delete",
  rateLimited: "rate-limited",
});

const RETENTION_SECONDS = 180 * 24 * 60 * 60; // 180 日たったログは、消す

export async function audit(db, { event, userId = null, detail = "", now }) {
  try {
    await db
      .prepare("INSERT INTO audit_log (at, user_id, event, detail) VALUES (?, ?, ?, ?)")
      .bind(now, userId, event, String(detail).slice(0, 200))
      .run();
  } catch (cause) {
    console.error("audit log failed", cause?.message);
  }
}

/** 古いログを消す(ログイン時に、ときどき行う)。 */
export async function pruneAudit(db, now) {
  try {
    await db
      .prepare("DELETE FROM audit_log WHERE at < ?")
      .bind(now - RETENTION_SECONDS)
      .run();
  } catch (cause) {
    console.error("audit prune failed", cause?.message);
  }
}
