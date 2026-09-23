// ライセンスキーの発行(運営者用)。キーを作り、D1 の Console に貼る SQL を返す。
// 画面(HTML)にも、サーバーにも、発行の入り口はない(管理画面ができるまで、この手順だけ)。
// DB に入るのは、キーのハッシュと、末尾 4 文字だけ。キーそのものは、ここで表示するだけで、保存しない。
import { newLicense } from "../../functions/_lib/licenses.js";

export const MAX_COUNT = 50;
export const MAX_NOTE_LENGTH = 100;

// id・キーのハッシュは、ハイフンを含みうる文字(base64url)から作るため、まれに "--" ができる。
// 値は変えずに、隣り合う2つ目以降の "-" の前で文字列連結(||)に分け、出力の文字列に "--" を残さない
// (D1 の Console に貼る SQL は、コメント(--)を入れない。CLAUDE.md)。
function guardDashes(text) {
  let out = "";
  for (const char of text) {
    out += char === "-" && out.endsWith("-") ? `' || '${char}` : char;
  }
  return out;
}

/** SQL の文字列リテラル。単一引用符は、2 つにして、打ち消す。"--" は、連結に分けて残さない。 */
export const sqlString = (value) => `'${guardDashes(String(value).replaceAll("'", "''"))}'`;

/** 入力の検査。不正なら、理由つきで例外。 */
export function validateIssueOptions({ productId, count, note }, productIds) {
  if (typeof productId !== "string" || !productIds.includes(productId)) {
    throw new Error(
      `商品 ID が、products.json にありません: ${productId}(候補: ${productIds.join("、")})`,
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`発行する数は、1〜${MAX_COUNT} の整数にしてください。`);
  }
  const chars = Array.from(note);
  if (chars.length > MAX_NOTE_LENGTH) throw new Error(`メモは、${MAX_NOTE_LENGTH} 文字までです。`);
  if (chars.some((char) => char.codePointAt(0) <= 0x1f || char.codePointAt(0) === 0x7f)) {
    throw new Error("メモに、改行などの制御文字は使えません。");
  }
}

/** { keys: [表示用のキー], sql: [1 行 1 文の INSERT] }。 */
export async function issueLicenses({ productId, count = 1, note = "", now, productIds }) {
  validateIssueOptions({ productId, count, note }, productIds);
  const keys = [];
  const sql = [];
  for (let i = 0; i < count; i += 1) {
    const { key, row } = await newLicense({ productId, note, now });
    keys.push(key);
    sql.push(
      `INSERT INTO licenses (id, key_hash, key_hint, product_id, note, issued_at) VALUES (${[
        sqlString(row.id),
        sqlString(row.keyHash),
        sqlString(row.keyHint),
        sqlString(row.productId),
        sqlString(row.note),
        row.issuedAt,
      ].join(", ")});`,
    );
  }
  return { keys, sql };
}
