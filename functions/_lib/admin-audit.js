// 管理画面の監査ログ(Phase 26。変更前後を記録できる、既存の audit.js とは別のテーブル)。
// ログの書き込みに失敗しても、本来の処理は止めない(既存の audit.js と同じ考え方)。
//
// before/after のメールアドレス・IP アドレスは、書き込み前に自動で伏せる(redactPersonalInfo。0051・0052)。
// ユーザー管理の変更を記録するときも、表示用の情報(ニックネーム等)だけを渡すこと(伏せるのは最後の防波堤)。

const RETENTION_SECONDS = 180 * 24 * 60 * 60; // 既存の audit_log と同じ、180日で削除
const MAX_JSON_LENGTH = 20_000; // 1件(before/afterそれぞれ)の上限。あまりに大きい内容を、防ぐ

const REDACTED = "[redacted]";
const MAX_DEPTH = 20; // 循環参照・深すぎる入れ子は、ここで打ち切る(JSON にできない値と同じ扱い)
// キー名が個人情報を示すもの(値の中身に関わらず伏せる)
const PERSONAL_KEY = /^(e-?mail|mail|mail_?address|ip|ip_?address|remote_?addr)$/i;
// 値の文字列の中のメールアドレス・IPv4 アドレス(キー名に頼らず、書かれた場所を問わず伏せる)
const EMAIL_IN_TEXT = /[^\s@<>"'`,;()[\]]+@[^\s@<>"'`,;()[\]]+\.[^\s@<>"'`,;()[\]]+/g;
const IPV4_IN_TEXT = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;

/**
 * 変更前後の内容から、メールアドレス・IP アドレスを伏せた写しを返す(元の値は変えない)。
 * 0051 の約束(before/after に個人情報をそのまま書かない)を、書き込みの入り口で強制する。
 */
export function redactPersonalInfo(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error("too deep");
  if (typeof value === "string") {
    return value.replace(EMAIL_IN_TEXT, REDACTED).replace(IPV4_IN_TEXT, REDACTED);
  }
  if (Array.isArray(value)) return value.map((item) => redactPersonalInfo(item, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = PERSONAL_KEY.test(key) ? REDACTED : redactPersonalInfo(item, depth + 1);
    }
    return out;
  }
  return value;
}

// JSON にできない値(循環参照など)・大きすぎる値でも、落ちない
function toJsonOrNull(value) {
  if (value === null || value === undefined) return null;
  try {
    const text = JSON.stringify(redactPersonalInfo(value));
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
