// 暗号まわりの部品(Web Crypto。Cloudflare Workers でも Node でも動く)。
const encoder = new TextEncoder();

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** base64url を、バイト列に戻す。不正な文字なら、例外。 */
export function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("base64url ではありません");
  const padded =
    text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** 推測できないランダムな文字列(既定は 256 ビット)。 */
export const randomToken = (bytes = 32) =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

/** SHA-256 のハッシュ(base64url)。 */
export async function sha256(text) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

/** HMAC-SHA256(base64url)。 */
export async function hmac(secret, data) {
  const key = await hmacKey(secret, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

/** HMAC の検証。比較は、定数時間(crypto.subtle.verify)で行う。 */
export async function hmacVerify(secret, data, signature) {
  let bytes;
  try {
    bytes = fromBase64Url(signature);
  } catch {
    return false;
  }
  const key = await hmacKey(secret, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(data));
}

/** PKCE の code_challenge(S256)。 */
export const pkceChallenge = (verifier) => sha256(verifier);
