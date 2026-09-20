// Google のログイン(OpenID Connect。認可コード + PKCE)。
// ブラウザには、Google のスクリプトを読み込まない。リダイレクトと、サーバー間の通信だけで行う。
// 取り出すのは openid・email だけ(名前・写真は、要求しない)。
import { fromBase64Url } from "./crypto.js";
import { oidc, siteOrigin } from "./config.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const FETCH_TIMEOUT_MS = 5000;
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 60 * 60 * 1000; // 鍵の一覧は、1 時間覚える
const JWKS_MIN_REFETCH_MS = 60 * 1000; // 知らない鍵が来ても、再取得は 1 分に 1 回まで

export const redirectUri = (env) => `${siteOrigin(env)}/auth/google/callback`;

/** Google の同意画面へ送る URL。reauth のときは、Google に、もう一度ログインさせる(prompt=login)。 */
export function authorizeUrl(env, { state, nonce, challenge, reauth }) {
  const url = new URL(oidc(env).authUrl);
  const params = {
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(env),
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(reauth ? { prompt: "login" } : {}),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** 認可コードを、ID トークンに交換する(サーバー間。クライアントシークレットは、ここでだけ使う)。 */
export async function exchangeCode(env, code, verifier) {
  const response = await fetch(oidc(env).tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(env),
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`token-exchange-failed:${response.status}`);
  const body = await response.json();
  if (typeof body?.id_token !== "string") throw new Error("token-exchange-no-id-token");
  return body.id_token;
}

// --- 署名の鍵(JWKS) ---

const jwksCache = new Map(); // url → { keys, fetchedAt }

export const clearJwksCache = () => jwksCache.clear();

async function loadKeys(url, { force }) {
  const cached = jwksCache.get(url);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < (force ? JWKS_MIN_REFETCH_MS : JWKS_TTL_MS))
    return cached.keys;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`jwks-fetch-failed:${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body?.keys)) throw new Error("jwks-invalid");
  jwksCache.set(url, { keys: body.keys, fetchedAt: now });
  return body.keys;
}

async function findKey(url, kid) {
  let key = (await loadKeys(url, { force: false })).find((candidate) => candidate.kid === kid);
  if (!key) key = (await loadKeys(url, { force: true })).find((candidate) => candidate.kid === kid);
  return key ?? null;
}

const decodeJson = (part) => JSON.parse(decoder.decode(fromBase64Url(part)));

/**
 * ID トークンを検証して、claims を返す。失敗したら、例外(理由の文字列)。
 * 署名(RS256 だけ。alg=none や HS256 は、受け付けない)・発行者・宛先・期限・nonce・メールの確認済みを見る。
 */
export async function verifyIdToken(env, idToken, { nonce, now }) {
  const parts = String(idToken).split(".");
  if (parts.length !== 3) throw new Error("id-token-malformed");
  const [headerPart, payloadPart, signaturePart] = parts;

  let header;
  let claims;
  let signature;
  try {
    header = decodeJson(headerPart);
    claims = decodeJson(payloadPart);
    signature = fromBase64Url(signaturePart);
  } catch {
    throw new Error("id-token-malformed");
  }
  if (header?.alg !== "RS256" || typeof header.kid !== "string") throw new Error("id-token-alg");

  const jwk = await findKey(oidc(env).jwksUrl, header.kid);
  if (!jwk || jwk.kty !== "RSA") throw new Error("id-token-key");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    encoder.encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw new Error("id-token-signature");

  if (!oidc(env).issuers.includes(claims.iss)) throw new Error("id-token-issuer");
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new Error("id-token-audience");
  if (!Number.isFinite(claims.exp) || claims.exp + CLOCK_SKEW_SECONDS <= now)
    throw new Error("id-token-expired");
  if (Number.isFinite(claims.iat) && claims.iat - CLOCK_SKEW_SECONDS > now)
    throw new Error("id-token-future");
  if (typeof nonce !== "string" || claims.nonce !== nonce) throw new Error("id-token-nonce");
  if (typeof claims.sub !== "string" || claims.sub === "" || claims.sub.length > 255)
    throw new Error("id-token-sub");
  if (typeof claims.email !== "string" || claims.email === "") throw new Error("id-token-email");
  if (claims.email_verified !== true) throw new Error("id-token-email-unverified");

  return { sub: claims.sub, email: claims.email };
}
