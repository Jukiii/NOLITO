// 管理画面の監査ログ(Phase 26。変更前後を記録できる、既存の audit.js とは別のテーブル)。
// ログの書き込みに失敗しても、本来の処理は止めない(既存の audit.js と同じ考え方)。
//
// 重要: before/after に、メールアドレスなどの個人情報を、そのまま書き込まないこと(0051決定ログ)。
// ユーザー管理の変更を記録するときは、表示用の情報(ニックネーム等)だけにする。

const RETENTION_SECONDS = 180 * 24 * 60 * 60; // 既存の audit_log と同じ、180日で削除
const MAX_JSON_LENGTH = 20_000; // 1件(before/afterそれぞれ)の上限。あまりに大きい内容を、防ぐ

// JSON にできない値(循環参照など)・大きすぎる値でも、落ちない
function toJsonOrNull(value) {
  if (value === null || value === undefined) return null;
  try {
    const text = JSON.stringify(value);
    return text.length > MAX_JSON_LENGTH ? text.slice(0, MAX_JSON_LENGTH) : text;
  } catch {
    return null;
  }
}

/**
 * 管理者の変更を記録する。
 *   resourceType … 管理対象の種類(例: "vocabulary"・"article"・"product"・"user")
 *   resourceId   … 対象の id(なければ null。例: 新規作成の前など)
 *   action       … "create" | "update" | "delete" など
 *   before/after … 変更前後の内容(JSON にできるもの。null でよい)
 */
export async function recordAdminChange(
  db,
  { userId, resourceType, resourceId = null, action, before = null, after = null, now },
) {
  try {
    await db
      .prepare(
        "INSERT INTO admin_audit_log (at, user_id, resource_type, resource_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        now,
        userId,
        String(resourceType),
        resourceId === null ? null : String(resourceId),
        String(action),
        toJsonOrNull(before),
        toJsonOrNull(after),
      )
      .run();
  } catch (cause) {
    console.error("admin audit log failed", cause?.message);
  }
}

/** 古いログを消す(既存の pruneAudit と同じ、180日)。 */
export async function pruneAdminAudit(db, now) {
  try {
    await db
      .prepare("DELETE FROM admin_audit_log WHERE at < ?")
      .bind(now - RETENTION_SECONDS)
      .run();
  } catch (cause) {
    console.error("admin audit prune failed", cause?.message);
  }
}
