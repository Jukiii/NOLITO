// ライセンスキー(Phase 9 PR 2)。DB には、キーのハッシュだけを置く。
// 形式: NLTO-XXXXX-XXXXX-XXXXX-XXXXX(20 文字 × 5 ビット = 100 ビットの乱数)。
// 紛らわしい文字(I・L・O・U)は使わない(Crockford の Base32)。
import { randomToken, sha256 } from "./crypto.js";

const PREFIX = "NLTO";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32 文字
const BODY_LENGTH = 20;
const GROUP = 5;

/** 新しいキー。表示用(ハイフンつき)を返す。 */
export function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(BODY_LENGTH));
  // 256 は 32 で割り切れるので、下位 5 ビットを使っても、偏らない
  const body = Array.from(bytes, (byte) => ALPHABET[byte & 31]).join("");
  return formatKey(body);
}

function formatKey(body) {
  const groups = [];
  for (let i = 0; i < BODY_LENGTH; i += GROUP) groups.push(body.slice(i, i + GROUP));
  return [PREFIX, ...groups].join("-");
}

/**
 * 利用者が入力したキーを、正規の形(ハイフンなし・大文字)にする。形が違えば null。
 * 小文字・空白・ハイフンの有無は許す。読み間違えやすい文字(O→0、I・L→1)は、直す。
 */
export function normalizeKey(input) {
  if (typeof input !== "string" || input.length > 64) return null;
  const compact = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replaceAll("O", "0")
    .replaceAll("I", "1")
    .replaceAll("L", "1");
  // 接頭辞の NLTO は、O を 0 に直したので、比較のために同じ変換をかける
  const prefix = PREFIX.replaceAll("O", "0").replaceAll("I", "1").replaceAll("L", "1");
  if (!compact.startsWith(prefix)) return null;
  const body = compact.slice(prefix.length);
  if (body.length !== BODY_LENGTH) return null;
  if (![...body].every((char) => ALPHABET.includes(char))) return null;
  return `${PREFIX}${body}`;
}

/** 保存するハッシュ(正規の形から)。キーは十分に長い乱数なので、ソルトなしの SHA-256 で足りる。 */
export const hashKey = (canonical) => sha256(`license:${canonical}`);

/** 見分けるための、末尾 4 文字。 */
export const keyHint = (canonical) => canonical.slice(-4);

/** DB に入れる 1 件分(キーは、返すだけで、保存しない)。 */
export async function newLicense({ productId, note = "", now }) {
  const key = generateKey();
  const canonical = normalizeKey(key);
  return {
    key,
    row: {
      id: randomToken(16),
      keyHash: await hashKey(canonical),
      keyHint: keyHint(canonical),
      productId,
      note,
      issuedAt: now,
    },
  };
}

const toLicense = (row) => ({
  id: row.id,
  productId: row.product_id,
  hint: row.key_hint,
  redeemedAt: row.redeemed_at,
  status: row.revoked_at === null ? "active" : "revoked",
});

/**
 * キーを、利用者のアカウントに登録する。
 * 1 つの UPDATE で行う(同時に 2 人が登録しても、1 人だけが成功する)。
 * 結果: { ok: true, license, already } か、{ ok: false }。
 * 「存在しない」「他の人が使用済み」「無効」は、区別しない(キーの存在を、探れないように)。
 */
export async function redeemLicense(db, { userId, keyHash, now }) {
  const update = await db
    .prepare(
      `UPDATE licenses SET user_id = ?, redeemed_at = ?
       WHERE key_hash = ? AND user_id IS NULL AND revoked_at IS NULL`,
    )
    .bind(userId, now, keyHash)
    .run();
  const row = await db.prepare("SELECT * FROM licenses WHERE key_hash = ?").bind(keyHash).first();
  if (!row || row.user_id !== userId || row.revoked_at !== null) return { ok: false };
  // 自分がすでに登録していたものは、何度登録しても、成功(同じ結果)
  return { ok: true, license: toLicense(row), already: update.meta.changes === 0 };
}

/** 自分のライセンス(新しく登録した順)。 */
export async function listLicenses(db, userId) {
  const { results } = await db
    .prepare("SELECT * FROM licenses WHERE user_id = ? ORDER BY redeemed_at DESC, rowid DESC")
    .bind(userId)
    .all();
  return results.map(toLicense);
}
