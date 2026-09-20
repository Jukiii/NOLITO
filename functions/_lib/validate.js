// 入力の検証。

export const NICKNAME_MAX = 12; // ゲームのニックネームと同じ長さ
export const DEFAULT_NICKNAME = "ななしさん"; // ゲームの既定と同じ

/** ニックネーム。前後の空白を削り、1〜12字(コードポイント)。制御文字は不可。 */
export function validateNickname(value) {
  if (typeof value !== "string") return { ok: false, error: "nickname-invalid" };
  const chars = Array.from(value.trim());
  if (chars.length === 0) return { ok: false, error: "nickname-required" };
  if (chars.length > NICKNAME_MAX) return { ok: false, error: "nickname-too-long" };
  if (chars.some((char) => char.codePointAt(0) <= 0x1f || char.codePointAt(0) === 0x7f)) {
    return { ok: false, error: "nickname-invalid" };
  }
  return { ok: true, value: chars.join("") };
}

/** メールアドレスの形(ID トークンに入っている値の、念のための確認)。 */
export const isEmailLike = (value) =>
  typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);
