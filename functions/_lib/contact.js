// 問い合わせ(Phase 10 PR 3)。入力の検証と、保存。
// 個人情報(本文・返信用のメールアドレス)を扱う。ログ・監査ログ・応答には、内容を入れない。
// public/assets/js/contact/rules.js の上限と、同じ値にする(tests/contact-page.test.js が、一致を検査する)。
import { randomToken } from "./crypto.js";
import { isEmailLike } from "./validate.js";

export const CATEGORIES = ["bug", "request", "question", "other"];
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const EMAIL_MAX = 254;
export const UA_MAX = 300;
export const MIN_ELAPSED_MS = 3000; // ページを開いてから、送信までの、最短の時間(これより速いのは、人ではない)
export const MAX_BODY_BYTES = 16 * 1024; // 本文 2000 文字(日本語は 1 文字 3 バイト)+ 余裕

// 改行(\n)・タブ以外の制御文字と、文字の並びを、見かけと変える双方向制御文字(U+202A–202E・U+2066–2069)
const FORBIDDEN_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
// 文字コードから組み立てる(制御文字・双方向制御文字を、ソースに直接書かない。見えない文字が、紛れ込むのを防ぐ)
const FORBIDDEN = new RegExp(
  `[${FORBIDDEN_RANGES.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join("")}]`,
);
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const VIEWPORT = /^\d{2,5}x\d{2,5}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const wellFormed = (text) => (typeof text.isWellFormed === "function" ? text.isWellFormed() : true);

/**
 * 問い合わせの入力を検証する。
 * { bot: true }                … 人でない(罠の欄が埋まっている・速すぎる)。保存せず、成功したように見せる
 * { ok: true, value }          … 保存してよい形
 * { ok: false, error }         … 利用者に、直してもらう(error は、messages.js に対応する種類)
 * userAgent は、環境の添付を選んだときだけ、環境の情報に入れる。
 */
export function validateInquiry(input, { userAgent = "" } = {}) {
  if (!isObject(input)) return { ok: false, error: "contact-invalid" };

  // 罠の欄(人には、見えない)。埋まっていたら、ボット
  if (input.website !== undefined && input.website !== "") return { bot: true };
  if (
    typeof input.elapsed !== "number" ||
    !Number.isFinite(input.elapsed) ||
    input.elapsed < MIN_ELAPSED_MS
  ) {
    return { bot: true };
  }

  if (!CATEGORIES.includes(input.category)) return { ok: false, error: "contact-category" };

  const product = input.product === undefined ? "" : input.product;
  if (typeof product !== "string" || (product !== "" && !PRODUCT_ID.test(product))) {
    return { ok: false, error: "contact-invalid" };
  }

  if (typeof input.message !== "string" || !wellFormed(input.message)) {
    return { ok: false, error: "contact-message-invalid" };
  }
  const message = input.message.replace(/\r\n?/g, "\n").trim();
  const length = Array.from(message).length;
  if (length < MESSAGE_MIN) return { ok: false, error: "contact-message-short" };
  if (length > MESSAGE_MAX) return { ok: false, error: "contact-message-long" };
  if (FORBIDDEN.test(message)) return { ok: false, error: "contact-message-invalid" };

  const email = input.email === undefined ? "" : input.email;
  if (typeof email !== "string") return { ok: false, error: "contact-email" };
  const trimmedEmail = email.trim();
  if (
    trimmedEmail !== "" &&
    (!isEmailLike(trimmedEmail) || FORBIDDEN.test(trimmedEmail) || trimmedEmail.length > EMAIL_MAX)
  ) {
    return { ok: false, error: "contact-email" };
  }

  if (typeof input.includeEnv !== "boolean") return { ok: false, error: "contact-invalid" };
  let envInfo = "";
  if (input.includeEnv) {
    const env = input.env ?? {};
    if (!isObject(env)) return { ok: false, error: "contact-invalid" };
    const parts = [];
    for (const [key, pattern] of [
      ["viewport", VIEWPORT],
      ["language", LANGUAGE],
      ["version", VERSION],
    ]) {
      if (env[key] === undefined || env[key] === "") continue;
      if (typeof env[key] !== "string" || !pattern.test(env[key])) {
        return { ok: false, error: "contact-invalid" };
      }
      parts.push(`${key}=${env[key]}`);
    }
    const ua = String(userAgent).replace(FORBIDDEN, "").slice(0, UA_MAX);
    if (ua) parts.push(`ua=${ua}`);
    envInfo = parts.join("; ");
  }

  return {
    ok: true,
    value: { category: input.category, product, message, email: trimmedEmail, envInfo },
  };
}

/** 保存する。status は、必ず 'new'(クライアントの値は、見ない)。 */
export async function storeInquiry(db, { category, product, message, email, envInfo }, now) {
  const id = randomToken(16);
  await db
    .prepare(
      `INSERT INTO inquiries (id, created_at, category, product_id, message, email, env_info, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
    )
    .bind(id, now, category, product, message, email, envInfo)
    .run();
  return id;
}
