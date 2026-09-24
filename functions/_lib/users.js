// 利用者(users テーブル)。Google の sub で識別する。保存するのは、sub・メールアドレス・ニックネームだけ。
import { randomToken } from "./crypto.js";
import { DEFAULT_NICKNAME } from "./validate.js";

const toUser = (row) =>
  row && {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };

export async function getUser(db, id) {
  return toUser(await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first());
}

/**
 * sub の利用者を返す。いなければ作る(ニックネームは既定)。メールアドレスと最終ログインは、毎回更新する。
 * 1 つの文で行う(初めてのログインが同時に 2 回来ても、UNIQUE の違反で落ちない)。
 */
export async function upsertUser(db, { sub, email, now }) {
  const id = randomToken(16);
  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, nickname, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, last_login_at = excluded.last_login_at`,
    )
    .bind(id, sub, email, DEFAULT_NICKNAME, now, now)
    .run();
  const user = toUser(
    await db.prepare("SELECT * FROM users WHERE google_sub = ?").bind(sub).first(),
  );
  return { user, created: user.id === id };
}

export async function setNickname(db, id, nickname) {
  await db.prepare("UPDATE users SET nickname = ? WHERE id = ?").bind(nickname, id).run();
  return getUser(db, id);
}

/**
 * 利用者と、そのログインの状態をすべて消す。監査ログは、残るが、user_id が NULL になる(匿名になる)。
 * ライセンスは、記録を残して、結びつきだけを外す(同じキーを、また登録できる)。
 * ゲームの記録の同期(game_progress。Phase 19 PR 2)も消す(端末の記録は、消えない)。
 */
export async function deleteUser(db, id) {
  await db.batch([
    db.prepare("UPDATE licenses SET user_id = NULL, redeemed_at = NULL WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM game_progress WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);
}
