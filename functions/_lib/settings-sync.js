// サイト全体の見た目の設定(テーマ・文字サイズ・アニメーション軽減)の、アカウントへの同期(Phase 21 PR 3)。
// 任意(強制しない)。ゲームの記録(game_progress)とは、完全に別のテーブル・API(疎結合を保つ)。
// 検証は、クライアント側の純粋関数(isTheme・isFontSize・isMotion)を、そのまま使う(重複させない)。
import { DEFAULT_FONT_SIZE, isFontSize } from "../../public/assets/js/components/font-size.js";
import { DEFAULT_MOTION, isMotion } from "../../public/assets/js/components/motion.js";
import { DEFAULT_THEME, isTheme } from "../../public/assets/js/components/theme.js";

// 3つの値だけなので、余裕を持たせても小さい上限
export const MAX_BODY_BYTES = 1024;

const toSettings = (row) =>
  row && {
    theme: row.theme,
    fontSize: row.font_size,
    reducedMotion: row.reduced_motion,
    updatedAt: row.updated_at,
  };

/** アカウントに保存されている、表示設定。まだ同期していなければ null。 */
export async function getSyncedSettings(db, userId) {
  const row = await db
    .prepare("SELECT * FROM site_settings WHERE user_id = ?")
    .bind(userId)
    .first();
  return toSettings(row);
}

/**
 * 送られてきた設定を、検証してから正規化する(不正な値は、既定に丸める。落ちない)。
 * raw がオブジェクトでなければ null(呼び出し側で 400 にする)。
 */
export function normalizeSyncSettings(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_THEME,
    fontSize: isFontSize(raw.fontSize) ? raw.fontSize : DEFAULT_FONT_SIZE,
    reducedMotion: isMotion(raw.reducedMotion) ? raw.reducedMotion : DEFAULT_MOTION,
  };
}

/**
 * 設定を、検証してから保存する(すでにあれば、まるごと置き換える)。
 * raw が正しい形でなければ null(呼び出し側で 400 にする)。
 */
export async function saveSyncedSettings(db, userId, raw, now) {
  const settings = normalizeSyncSettings(raw);
  if (!settings) return null;
  await db
    .prepare(
      `INSERT INTO site_settings (user_id, theme, font_size, reduced_motion, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         theme = excluded.theme, font_size = excluded.font_size,
         reduced_motion = excluded.reduced_motion, updated_at = excluded.updated_at`,
    )
    .bind(userId, settings.theme, settings.fontSize, settings.reducedMotion, now)
    .run();
  return { ...settings, updatedAt: now };
}
