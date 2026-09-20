// 問い合わせフォームの規則(DOM に依存しない)。サーバー(functions/_lib/contact.js)と、同じ値にする。
// サーバーでも、必ず、同じ検査をする(ここは、利用者に、送る前に知らせるためのもの)。
// tests/contact-page.test.js が、サーバーの値と一致していることを検査する。

export const CATEGORIES = [
  { value: "bug", label: "不具合の報告" },
  { value: "request", label: "ご要望" },
  { value: "question", label: "質問" },
  { value: "other", label: "その他" },
];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const EMAIL_MAX = 254;

// 改行・タブ以外の制御文字と、見かけを変える双方向制御文字(文字コードから作る。見えない文字を、ソースに書かない)
const FORBIDDEN_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
const FORBIDDEN = new RegExp(
  `[${FORBIDDEN_RANGES.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join("")}]`,
);

const normalize = (text) => text.replace(/\r\n?/g, "\n").trim();

/** 本文の文字数(コードポイント。改行をそろえ、前後の空白を除いたもの)。 */
export const countChars = (text) => Array.from(normalize(String(text))).length;

/** 入力の検査。エラーは、項目ごとに、サーバーと同じ種類(contact-...)で返す。空なら、送れる。 */
export function validateForm({ category, message, email }) {
  const errors = {};
  if (!CATEGORIES.some((item) => item.value === category)) errors.category = "contact-category";

  const text = normalize(String(message ?? ""));
  const length = Array.from(text).length;
  if (length < MESSAGE_MIN) errors.message = "contact-message-short";
  else if (length > MESSAGE_MAX) errors.message = "contact-message-long";
  else if (FORBIDDEN.test(text)) errors.message = "contact-message-invalid";

  const address = String(email ?? "").trim();
  if (
    address !== "" &&
    (address.length > EMAIL_MAX || FORBIDDEN.test(address) || !/^[^\s@]+@[^\s@]+$/.test(address))
  ) {
    errors.email = "contact-email";
  }
  return errors;
}

const VIEWPORT = /^\d{2,5}x\d{2,5}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** 添付する環境の情報(サーバーの形式に合うものだけ)。 */
export function collectEnv({ width, height, language, version }) {
  const env = {};
  const viewport = `${width}x${height}`;
  if (VIEWPORT.test(viewport)) env.viewport = viewport;
  if (typeof language === "string" && LANGUAGE.test(language)) env.language = language;
  if (typeof version === "string" && VERSION.test(version)) env.version = version;
  return env;
}

/** 添付する内容の、利用者向けの説明(送る前に、見せる)。ブラウザの種類は、サーバーが、通信の情報から取る。 */
export function envSummary(env) {
  const parts = [];
  if (env.viewport) parts.push(`画面の大きさ: ${env.viewport.replace("x", "×")}`);
  if (env.language) parts.push(`言語: ${env.language}`);
  if (env.version) parts.push(`プロダクトのバージョン: v${env.version}`);
  parts.push("ブラウザの種類(User-Agent)");
  return parts.join(" / ");
}

/** 送信する内容。罠の欄(website)は、空のまま。elapsed は、フォームを開いてからの、ミリ秒。 */
export function buildPayload({
  category,
  product,
  message,
  email,
  includeEnv,
  env,
  website,
  elapsed,
}) {
  return {
    category,
    product: product ?? "",
    message: normalize(String(message)),
    email: String(email ?? "").trim(),
    includeEnv: Boolean(includeEnv),
    env: includeEnv ? env : {},
    website: website ?? "",
    elapsed,
  };
}
