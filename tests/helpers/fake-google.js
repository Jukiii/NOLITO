// テスト用の、偽の Google(トークンの交換と、署名の鍵の配布)。
// 本物と同じく、RS256 で署名した ID トークンを作る。fetch を差し替えるので、外部には通信しない。
import { mock } from "node:test";
import { pkceChallenge, toBase64Url } from "../../functions/_lib/crypto.js";

export const CLIENT_ID = "test-client.apps.googleusercontent.com";
export const ISSUER = "https://accounts.google.com";

const encoder = new TextEncoder();
const json = (value) => toBase64Url(encoder.encode(JSON.stringify(value)));

export async function generateKey(kid) {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    kid,
    privateKey: pair.privateKey,
    jwk: { kty: jwk.kty, n: jwk.n, e: jwk.e, kid, alg: "RS256" },
  };
}

/** ID トークンを作る。header / signWith / tamper で、不正なトークンも作れる。 */
export async function signIdToken(key, claims, { header = {}, corrupt = false } = {}) {
  const head = json({ alg: "RS256", typ: "JWT", kid: key.kid, ...header });
  const body = json(claims);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key.privateKey,
      encoder.encode(`${head}.${body}`),
    ),
  );
  if (corrupt) signature[0] ^= 0xff;
  return `${head}.${body}.${toBase64Url(signature)}`;
}

export function validClaims(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "alice@example.com",
    email_verified: true,
    nonce: "nonce",
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

/**
 * fetch を、偽の Google に差し替える。
 *   key         署名に使う鍵(jwks で配る)
 *   identity    ログインする人 { sub, email, email_verified }(変更できる)
 *   authorize   直近の /authorize の URL の引数(login で作った URL から、テストが渡す)
 */
export async function installFakeGoogle({ keys = [] } = {}) {
  const key = keys[0] ?? (await generateKey("test-key-1"));
  const fake = {
    key,
    keys: keys.length ? keys : [key],
    identity: { sub: "google-sub-1", email: "alice@example.com", email_verified: true },
    // 認可の要求(login が作った URL)。callback の前に、テストが register する
    pending: new Map(),
    calls: [],
    tokenStatus: 200,
    claimOverrides: {},
    signOptions: {},
    jwksFailures: 0,

    /** login の Location を渡す。code を返す(実際の Google が、認可の後に返すもの)。 */
    register(location) {
      const params = new URL(location).searchParams;
      const code = `code-${fake.pending.size + 1}`;
      fake.pending.set(code, {
        nonce: params.get("nonce"),
        challenge: params.get("code_challenge"),
        redirectUri: params.get("redirect_uri"),
        clientId: params.get("client_id"),
      });
      return code;
    },
    restore() {
      fetchMock.mock.restore();
    },
  };

  const fetchMock = mock.method(globalThis, "fetch", async (input, init = {}) => {
    const url = String(input);
    fake.calls.push({ url, method: init.method ?? "GET" });
    if (url.endsWith("/certs")) {
      if (fake.jwksFailures > 0) {
        fake.jwksFailures -= 1;
        return new Response("error", { status: 500 });
      }
      return Response.json({ keys: fake.keys.map((k) => k.jwk) });
    }
    if (url.endsWith("/token")) {
      if (fake.tokenStatus !== 200) return new Response("{}", { status: fake.tokenStatus });
      const form = new URLSearchParams(String(init.body));
      const request = fake.pending.get(form.get("code"));
      // 本物の Google と同じく、コードは 1 回だけ・PKCE・クライアントの確認をする
      if (
        !request ||
        form.get("client_secret") !== "test-secret" ||
        form.get("client_id") !== CLIENT_ID ||
        form.get("redirect_uri") !== request.redirectUri ||
        (await pkceChallenge(form.get("code_verifier") ?? "")) !== request.challenge
      ) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      fake.pending.delete(form.get("code"));
      const claims = validClaims({
        ...fake.identity,
        nonce: request.nonce,
        ...fake.claimOverrides,
      });
      return Response.json({
        id_token: await signIdToken(fake.key, claims, fake.signOptions),
        access_token: "unused",
      });
    }
    throw new Error(`想定していない通信: ${url}`);
  });
  return fake;
}
