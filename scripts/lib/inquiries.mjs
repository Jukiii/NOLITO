// 問い合わせ(D1 の inquiries)を、運営者が読む・対応済みにする・古いものを消す、ための部品。
// 中身は、外部の人が書いたもの。運営者の端末に表示する前に、必ず無害化する(端末の制御文字で、画面を書き換えられないように)。
import { CATEGORIES } from "../../public/assets/js/contact/rules.js";

export const ID_PATTERN = /^[A-Za-z0-9_-]{16,32}$/;
export const RETENTION_DAYS = 180; // 対応が終わってから、これだけたったものを、消す(約 6 か月)
const LIST_LIMIT = 200;

// 改行・タブ以外の制御文字(端末の操作文字)と、見かけを変える双方向制御文字。文字コードから作る
const UNSAFE_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x1f],
  [0x7f, 0x9f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
const UNSAFE = new RegExp(
  `[${UNSAFE_RANGES.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join("")}]`,
  "g",
);

/** 表示用に、制御文字を「?」に置き換える(改行・タブは、そのまま)。 */
export const safeText = (value) => String(value ?? "").replace(UNSAFE, "?");

/** 問い合わせの ID(SQL に入れるので、決まった形だけ)。 */
export function validateId(id) {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    throw new Error(
      "問い合わせの ID の形が正しくありません(一覧に表示される、英数字・- ・_ の文字列)。",
    );
  }
  return id;
}

const isCount = (value) => Number.isInteger(value) && value >= 0;

export const listSql = ({ all = false } = {}) =>
  `SELECT id, created_at, category, product_id, message, email, env_info, status, resolved_at FROM inquiries ${all ? "" : "WHERE status = 'new' "}ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`;

export function markDoneSql(id, now) {
  if (!isCount(now)) throw new Error("時刻が不正です。");
  return `UPDATE inquiries SET status = 'done', resolved_at = ${now} WHERE id = '${validateId(id)}' AND status = 'new'`;
}

const cutoff = (now, days) => {
  if (!isCount(now) || !isCount(days)) throw new Error("時刻・日数が不正です。");
  return now - days * 24 * 60 * 60;
};

export const purgeCountSql = (now, days = RETENTION_DAYS) =>
  `SELECT COUNT(*) AS n FROM inquiries WHERE status = 'done' AND resolved_at < ${cutoff(now, days)}`;

export const purgeSql = (now, days = RETENTION_DAYS) =>
  `DELETE FROM inquiries WHERE status = 'done' AND resolved_at < ${cutoff(now, days)}`;

/** wrangler d1 execute --json の出力(前後に、ほかの表示が混じっても、JSON の配列の部分を取り出す)。 */
export function parseExecuteJson(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("wrangler の出力を読めませんでした。");
  const parsed = JSON.parse(stdout.slice(start, end + 1));
  return parsed.flatMap((entry) => entry.results ?? []);
}

const categoryLabel = new Map(CATEGORIES.map((item) => [item.value, item.label]));

const pad = (number) => String(number).padStart(2, "0");
function formatDate(seconds) {
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 1 件を、読みやすい文字列にする(すべて、無害化する)。 */
export function formatInquiry(row) {
  const state = row.status === "done" ? "対応済み" : "未対応";
  const head = [
    `[${state}]`,
    formatDate(row.created_at),
    categoryLabel.get(row.category) ?? safeText(row.category),
    safeText(row.product_id) || "(サイト全体)",
  ].join(" | ");
  const lines = [head, `  ID: ${safeText(row.id)}`, `  返信先: ${safeText(row.email) || "(なし)"}`];
  if (row.env_info) lines.push(`  環境: ${safeText(row.env_info)}`);
  if (row.resolved_at) lines.push(`  対応済みにした日: ${formatDate(row.resolved_at)}`);
  lines.push(
    "  ---",
    ...safeText(row.message)
      .split("\n")
      .map((line) => `  ${line}`),
  );
  return lines.join("\n");
}
