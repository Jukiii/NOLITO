// Google の ID トークンの検証のテスト(偽の Google と、生成した RSA 鍵を使う。外部には通信しない)。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { toBase64Url } from "../functions/_lib/crypto.js";
import { authorizeUrl, clearJwksCache, verifyIdToken } from "../functions/_lib/google.js";
import { makeEnv } from "./helpers/auth.js";
import {
  CLIENT_ID,
  generateKey,
  installFakeGoogle,
  signIdToken,
  validClaims,
} from "./helpers/fake-google.js";

const NONCE = "nonce-1";
const now = () => Math.floor(Date.now() / 1000);

describe("ID トークンの検証", () => {
  let google;
  let env;

  beforeEach(async () => {
    clearJwksCache();
    google = await installFakeGoogle();
    env = makeEnv();
  });
  afterEach(() => google.restore());

  const verify = (claims, options) =>
    signIdToken(google.key, claims, options).then((token) =>
      verifyIdToken(env, token, { nonce: NONCE, now: now() }),
    );
  const claims = (overrides) => validClaims({ nonce: NONCE, ...overrides });

  it("正しいトークンは、sub と email だけを返す", async () => {
    const identity = await verify(claims({ name: "Alice", picture: "https://x/y.png" }));
    assert.deepEqual(identity, { sub: "google-sub-1", email: "alice@example.com" });
  });

  it("iss は、https 付きでも、なしでも通る(Google は両方ある)", async () => {
    await verify(claims({ iss: "accounts.google.com" }));
  });

  it("署名が壊れている・別の鍵で署名した・知らない kid は、断る", async () => {
    await assert.rejects(verify(claims(), { corrupt: true }), /id-token-signature/);
    const other = await generateKey("test-key-1"); // kid は同じでも、鍵が違う
    const forged = await signIdToken(other, claims());
    await assert.rejects(
      verifyIdToken(env, forged, { nonce: NONCE, now: now() }),
      /id-token-signature/,
    );
    const unknown = await signIdToken(await generateKey("nobody"), claims());
    await assert.rejects(verifyIdToken(env, unknown, { nonce: NONCE, now: now() }), /id-token-key/);
  });

  it("alg が RS256 以外(none・HS256・小文字など)は、断る", async () => {
    for (const alg of ["none", "HS256", "rs256", "RS512", "ES256", undefined]) {
      await assert.rejects(verify(claims(), { header: { alg } }), /id-token-alg/, String(alg));
    }
    // alg=none で、署名なしのトークン
    const head = toBase64Url(
      new TextEncoder().encode(JSON.stringify({ alg: "none", kid: "test-key-1" })),
    );
    const body = toBase64Url(new TextEncoder().encode(JSON.stringify(claims())));
    await assert.rejects(
      verifyIdToken(env, `${head}.${body}.`, { nonce: NONCE, now: now() }),
      /id-token-alg/,
    );
  });

  it("形式が違うトークンは、断る", async () => {
    for (const bad of ["", "a.b", "a.b.c.d", "!!.!!.!!", undefined]) {
      await assert.rejects(
        verifyIdToken(env, bad, { nonce: NONCE, now: now() }),
        /id-token-malformed/,
        String(bad),
      );
    }
  });

  it("発行者・宛先が違うと、断る", async () => {
    await assert.rejects(verify(claims({ iss: "https://evil.test" })), /id-token-issuer/);
    await assert.rejects(verify(claims({ iss: undefined })), /id-token-issuer/);
    await assert.rejects(verify(claims({ aud: "other-client" })), /id-token-audience/);
    await assert.rejects(verify(claims({ aud: [CLIENT_ID] })), /id-token-audience/);
  });

  it("期限切れは断る(1 分の時計のずれは許す)。未来に発行されたものも断る", async () => {
    await assert.rejects(verify(claims({ exp: now() - 120 })), /id-token-expired/);
    await assert.rejects(verify(claims({ exp: undefined })), /id-token-expired/);
    await assert.rejects(verify(claims({ exp: "9999999999" })), /id-token-expired/);
    await verify(claims({ exp: now() - 30 }));
    await assert.rejects(verify(claims({ iat: now() + 600 })), /id-token-future/);
  });

  it("nonce が違う・ないと、断る", async () => {
    await assert.rejects(verify(claims({ nonce: "other" })), /id-token-nonce/);
    await assert.rejects(verify(claims({ nonce: undefined })), /id-token-nonce/);
    const token = await signIdToken(google.key, claims());
    await assert.rejects(
      verifyIdToken(env, token, { nonce: undefined, now: now() }),
      /id-token-nonce/,
    );
  });

  it("sub がない・長すぎる・文字列でないと、断る", async () => {
    for (const sub of [undefined, "", 123, "x".repeat(256)]) {
      await assert.rejects(verify(claims({ sub })), /id-token-sub/, String(sub));
    }
  });

  it("メールがない・確認済みでないと、断る", async () => {
    await assert.rejects(verify(claims({ email: undefined })), /id-token-email$/);
    await assert.rejects(verify(claims({ email: "" })), /id-token-email$/);
    for (const email_verified of [false, undefined, "true", 1]) {
      await assert.rejects(
        verify(claims({ email_verified })),
        /id-token-email-unverified/,
        String(email_verified),
      );
    }
  });

  it("鍵の一覧は覚える。知らない kid のときだけ、取り直す", async () => {
    await verify(claims());
    await verify(claims());
    assert.equal(google.calls.filter((call) => call.url.endsWith("/certs")).length, 1);

    // 鍵が入れ替わった(ローテーション)。取り直しは、1 分に 1 回までなので、いまは取り直さない
    const rotated = await generateKey("test-key-2");
    google.keys = [rotated];
    google.key = rotated;
    await assert.rejects(verify(claims()), /id-token-key/);
    assert.equal(google.calls.filter((call) => call.url.endsWith("/certs")).length, 1);

    // キャッシュを空にすると、新しい鍵を取り直して、通る
    clearJwksCache();
    await verify(claims());
  });

  it("鍵の取得に失敗したら、断る(通してしまわない)", async () => {
    google.jwksFailures = 1;
    await assert.rejects(verify(claims()), /jwks-fetch-failed/);
  });
});

describe("認可 URL", () => {
  const env = makeEnv();
  const params = { state: "s", nonce: "n", challenge: "c" };

  it("認可コード + PKCE(S256)で、openid email だけを求める", () => {
    const url = new URL(authorizeUrl(env, params));
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid email");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), "c");
    assert.equal(url.searchParams.get("state"), "s");
    assert.equal(url.searchParams.get("nonce"), "n");
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("redirect_uri"), "https://nolito.test/auth/google/callback");
    assert.equal(url.searchParams.has("prompt"), false);
    assert.equal(url.searchParams.has("client_secret"), false);
  });

  it("再確認のときは、prompt=login", () => {
    assert.equal(
      new URL(authorizeUrl(env, { ...params, reauth: true })).searchParams.get("prompt"),
      "login",
    );
  });
});
