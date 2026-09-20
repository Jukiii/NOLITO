// アカウント(Phase 9)の部品のテスト: 暗号・署名つき Cookie・入力の検証・設定。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fromBase64Url,
  hmac,
  hmacVerify,
  pkceChallenge,
  randomToken,
  sha256,
  toBase64Url,
} from "../functions/_lib/crypto.js";
import {
  DEFAULT_NEXT,
  allowedEmails,
  authStatus,
  isInvited,
  oidc,
  safeNext,
  signupMode,
} from "../functions/_lib/config.js";
import { clearCookie, cookie, parseCookies, readJson } from "../functions/_lib/http.js";
import { open, seal } from "../functions/_lib/state.js";
import {
  DEFAULT_NICKNAME,
  NICKNAME_MAX,
  isEmailLike,
  validateNickname,
} from "../functions/_lib/validate.js";
import { makeEnv } from "./helpers/auth.js";

describe("crypto", () => {
  it("base64url は、往復できて、不正な文字は例外", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const text = toBase64Url(bytes);
    assert.match(text, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(fromBase64Url(text), bytes);
    assert.throws(() => fromBase64Url("a+b/"));
    assert.throws(() => fromBase64Url("a b"));
  });

  it("randomToken は、毎回違う 256 ビット(43 文字)", () => {
    const a = randomToken();
    assert.equal(a.length, 43);
    assert.notEqual(a, randomToken());
  });

  it("sha256 は、既知の値と一致する", async () => {
    // SHA-256("abc") = ba7816bf 8f01cfea ... (base64url: ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0)
    assert.equal(await sha256("abc"), "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("PKCE の challenge は、RFC 7636 の例と一致する", async () => {
    assert.equal(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("hmac は、正しい署名だけを通す", async () => {
    const signature = await hmac("secret", "data");
    assert.equal(await hmacVerify("secret", "data", signature), true);
    assert.equal(await hmacVerify("secret", "data2", signature), false);
    assert.equal(await hmacVerify("other", "data", signature), false);
    assert.equal(await hmacVerify("secret", "data", "!!!"), false);
    assert.equal(await hmacVerify("secret", "data", ""), false);
  });
});

describe("署名つきの状態(state Cookie)", () => {
  const secret = "k".repeat(40);
  const now = 1_000_000;

  it("往復できる", async () => {
    const payload = { state: "s", nonce: "n", exp: now + 60 };
    assert.deepEqual(await open(secret, await seal(secret, payload), now), payload);
  });

  it("期限切れ・改ざん・別の鍵・形式の違いは、null", async () => {
    const sealed = await seal(secret, { state: "s", exp: now + 60 });
    assert.equal(await open(secret, sealed, now + 61), null);
    assert.equal(await open(secret, sealed, now + 60), null); // exp ちょうども切れ
    assert.equal(await open("z".repeat(40), sealed, now), null);
    const [body, signature] = sealed.split(".");
    const forged = toBase64Url(
      new TextEncoder().encode(JSON.stringify({ state: "x", exp: now + 999 })),
    );
    assert.equal(await open(secret, `${forged}.${signature}`, now), null);
    assert.equal(await open(secret, `${body}.${signature}.extra`, now), null);
    for (const bad of ["", undefined, null, "abc", ".", "a.b"])
      assert.equal(await open(secret, bad, now), null);
  });

  it("同じ鍵の、用途の違う署名(用途の印のない HMAC)では、開けない", async () => {
    const body = toBase64Url(new TextEncoder().encode(JSON.stringify({ exp: now + 60 })));
    const plain = await hmac(secret, body);
    assert.equal(await open(secret, `${body}.${plain}`, now), null);
  });

  it("exp のない・数でない payload は、署名が正しくても、null", async () => {
    assert.equal(await open(secret, await seal(secret, { state: "s" }), now), null);
    assert.equal(await open(secret, await seal(secret, { exp: "999999999" }), now), null);
  });
});

describe("ニックネームの検証", () => {
  it("前後の空白を削り、1〜12 字を通す", () => {
    assert.deepEqual(validateNickname("  たろう "), { ok: true, value: "たろう" });
    assert.equal(validateNickname("あ".repeat(NICKNAME_MAX)).ok, true);
  });

  it("13 字以上は、切り詰めずに、断る", () => {
    assert.deepEqual(validateNickname("あ".repeat(NICKNAME_MAX + 1)), {
      ok: false,
      error: "nickname-too-long",
    });
  });

  it("文字数は、コードポイントで数える(絵文字は 1 字)", () => {
    assert.equal(validateNickname("😀".repeat(NICKNAME_MAX)).ok, true);
    assert.equal(validateNickname("😀".repeat(NICKNAME_MAX + 1)).ok, false);
  });

  it("空・空白だけ・文字列でない・制御文字は、断る", () => {
    assert.equal(validateNickname("").error, "nickname-required");
    assert.equal(validateNickname("   ").error, "nickname-required");
    for (const bad of [undefined, null, 1, {}, []])
      assert.equal(validateNickname(bad).error, "nickname-invalid");
    assert.equal(validateNickname("a\nb").error, "nickname-invalid");
    assert.equal(validateNickname("a\u0000b").error, "nickname-invalid");
    assert.equal(validateNickname("a\u007fb").error, "nickname-invalid");
  });

  it("ゲームの既定と同じ長さ・名前", () => {
    assert.equal(NICKNAME_MAX, 12);
    assert.equal(DEFAULT_NICKNAME, "ななしさん");
  });

  it("isEmailLike", () => {
    assert.equal(isEmailLike("a@example.com"), true);
    for (const bad of ["", "a", "a@", "@b", "a b@c", "a@b c", 1, null, `${"a".repeat(251)}@b.c`]) {
      assert.equal(isEmailLike(bad), false, String(bad));
    }
  });
});

describe("設定", () => {
  it("そろっていて AUTH_ENABLED=true のときだけ、有効", () => {
    assert.deepEqual(authStatus(makeEnv()), { configured: true, enabled: true });
    assert.deepEqual(authStatus(makeEnv({ AUTH_ENABLED: "false" })), {
      configured: true,
      enabled: false,
    });
    assert.deepEqual(authStatus(makeEnv({ AUTH_ENABLED: undefined })), {
      configured: true,
      enabled: false,
    });
  });

  it("1 つでも欠けると、設定なし(有効にならない)", () => {
    for (const key of [
      "DB",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "SESSION_SECRET",
      "SITE_ORIGIN",
    ]) {
      assert.deepEqual(
        authStatus(makeEnv({ [key]: undefined })),
        { configured: false, enabled: false },
        key,
      );
    }
    assert.equal(authStatus({}).enabled, false);
  });

  it("SESSION_SECRET が短い・SITE_ORIGIN が URL でないと、設定なし", () => {
    assert.equal(authStatus(makeEnv({ SESSION_SECRET: "short" })).configured, false);
    assert.equal(authStatus(makeEnv({ SITE_ORIGIN: "nolito" })).configured, false);
  });

  it("招待制が既定。open のときだけ、誰でも通す", () => {
    assert.equal(signupMode(makeEnv({ SIGNUP_MODE: undefined })), "invite");
    assert.equal(signupMode(makeEnv({ SIGNUP_MODE: "OPEN" })), "invite");
    assert.equal(signupMode(makeEnv({ SIGNUP_MODE: "open" })), "open");
    assert.equal(isInvited(makeEnv(), "alice@example.com"), true);
    assert.equal(isInvited(makeEnv(), " ALICE@Example.com "), true);
    assert.equal(isInvited(makeEnv(), "eve@example.com"), false);
    assert.equal(isInvited(makeEnv({ ALLOWED_EMAILS: "" }), "alice@example.com"), false);
    assert.equal(isInvited(makeEnv({ SIGNUP_MODE: "open" }), "eve@example.com"), true);
    assert.deepEqual(
      [...allowedEmails(makeEnv({ ALLOWED_EMAILS: " A@x.com,,b@x.com " }))],
      ["a@x.com", "b@x.com"],
    );
  });

  it("Google の URL の差し替えは、ローカル(http://localhost)だけ", () => {
    const override = {
      GOOGLE_AUTH_URL: "http://evil.test/auth",
      GOOGLE_TOKEN_URL: "http://evil.test/token",
    };
    assert.match(oidc(makeEnv(override)).authUrl, /^https:\/\/accounts\.google\.com\//);
    assert.match(oidc(makeEnv(override)).tokenUrl, /^https:\/\/oauth2\.googleapis\.com\//);
    const local = oidc(makeEnv({ ...override, SITE_ORIGIN: "http://localhost:8788" }));
    assert.equal(local.authUrl, "http://evil.test/auth");
    assert.equal(local.tokenUrl, "http://evil.test/token");
    // ローカルでも、上書きがなければ、本物の Google
    assert.match(
      oidc(makeEnv({ SITE_ORIGIN: "http://localhost:8788" })).jwksUrl,
      /googleapis\.com/,
    );
  });

  it("戻り先は、決まったパスだけ(オープンリダイレクトを防ぐ)", () => {
    assert.equal(safeNext("/account/"), "/account/");
    for (const bad of [
      "https://evil.test/",
      "//evil.test",
      "/\\evil.test",
      "/admin",
      "",
      null,
      undefined,
    ]) {
      assert.equal(safeNext(bad), DEFAULT_NEXT, String(bad));
    }
  });
});

describe("HTTP の部品", () => {
  it("Cookie を読む(最初の値を採用。= を含む値・不正な行に耐える)", () => {
    assert.deepEqual(parseCookies("a=1; b=x=y; =bad; c"), { a: "1", b: "x=y" });
    assert.deepEqual(parseCookies("a=1; a=2"), { a: "1" });
    assert.deepEqual(parseCookies(null), {});
    assert.deepEqual(parseCookies(""), {});
  });

  it("Set-Cookie は、Secure・HttpOnly・SameSite=Lax・Path=/ で、Domain を付けない", () => {
    const line = cookie("__Host-x", "v", { maxAge: 60 });
    for (const part of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=60"]) {
      assert.ok(line.includes(part), part);
    }
    assert.ok(!/domain/i.test(line));
    assert.match(clearCookie("__Host-x"), /Max-Age=0/);
  });

  it("JSON の本文: Content-Type・大きさ・形を検査する", async () => {
    const make = (body, type = "application/json") =>
      new Request("https://nolito.test/", {
        method: "POST",
        headers: { "Content-Type": type },
        body,
      });
    assert.deepEqual(await readJson(make('{"a":1}')), { ok: true, value: { a: 1 } });
    assert.equal((await readJson(make('{"a":1}', "text/plain"))).error, "unsupported-media-type");
    assert.equal((await readJson(make("{"))).error, "invalid-json");
    assert.equal((await readJson(make("[1]"))).error, "invalid-json");
    assert.equal((await readJson(make("null"))).error, "invalid-json");
    assert.equal(
      (await readJson(make(JSON.stringify({ a: "x".repeat(5000) })))).error,
      "too-large",
    );
  });
});
