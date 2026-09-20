// ログインの途中の状態(state・nonce・PKCE の verifier・戻り先)を、署名つきの短い Cookie に入れる。
// 署名(HMAC)で、改ざんを防ぐ。期限は、10 分。データベースには、何も書かない。
import { fromBase64Url, hmac, hmacVerify, toBase64Url } from "./crypto.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const STATE_TTL_SECONDS = 600;

// 同じ秘密の鍵を、別の用途(IP のハッシュ)にも使うので、署名する内容に、用途の印を付ける
const PURPOSE = "oauth-state:";

/** payload を、署名して、Cookie に入れられる文字列にする。 */
export async function seal(secret, payload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, `${PURPOSE}${body}`)}`;
}

/** 署名と期限(payload.exp。秒)を確認して、payload を返す。不正・期限切れなら null。 */
export async function open(secret, sealed, now) {
  const [body, signature, ...rest] = String(sealed ?? "").split(".");
  if (!body || !signature || rest.length > 0) return null;
  if (!(await hmacVerify(secret, `${PURPOSE}${body}`, signature))) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (typeof payload !== "object" || payload === null) return null;
    if (!Number.isInteger(payload.exp) || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
