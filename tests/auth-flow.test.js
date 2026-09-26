// アカウント(Phase 9)の通しのテスト: login → Google → callback → me / profile / logout / 削除。
// 本物と同じ SQL(node:sqlite の D1 互換)と、偽の Google を使う。外部には通信しない。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { onRequestDelete as deleteAccount } from "../functions/api/account.js";
import { onRequestPost as logout } from "../functions/api/logout.js";
import { onRequestGet as me } from "../functions/api/me.js";
import { onRequestPost as updateProfile } from "../functions/api/profile.js";
import { onRequestGet as callback } from "../functions/auth/google/callback.js";
import { onRequestGet as login } from "../functions/auth/google/login.js";
import { OAUTH_COOKIE, SESSION_COOKIE, adminEmails, isAdmin } from "../functions/_lib/config.js";
import { sha256 } from "../functions/_lib/crypto.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { requireAdmin } from "../functions/_lib/guard.js";
import {
  ABSOLUTE_SECONDS,
  IDLE_SECONDS,
  MAX_SESSIONS_PER_USER,
} from "../functions/_lib/session.js";
import { seal } from "../functions/_lib/state.js";
import { upsertUser } from "../functions/_lib/users.js";
import { onRequest as apiGuard } from "../functions/api/_middleware.js";
import { onRequest as authGuard } from "../functions/auth/_middleware.js";
import { ORIGIN, findSetCookie, get, makeEnv, signIn, write } from "./helpers/auth.js";
import { createDb } from "./helpers/d1.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const rows = async (env, sql, ...params) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .all()
  ).results;
const body = (response) => response.json();
const nowSeconds = () => Math.floor(Date.now() / 1000);

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv();
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

/** ログインして、session の Cookie を返す。 */
async function loggedIn(identity) {
  if (identity) google.identity = { ...google.identity, ...identity };
  const result = await signIn(env, google);
  assert.equal(result.callbackResponse.status, 302);
  assert.ok(result.session, "セッションの Cookie が出る");
  return { cookies: { [SESSION_COOKIE]: result.session.value }, result };
}

describe("設定が足りないとき(プレビューなど)は、何もせず、壊れない", () => {
  const empty = () => ({ DB: undefined });

  it("/api/me は { enabled: false }", async () => {
    const response = await me({ request: get("/api/me"), env: empty() });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { enabled: false });
  });

  it("AUTH_ENABLED が true でなければ、設定がそろっていても無効", async () => {
    const response = await me({ request: get("/api/me"), env: makeEnv({ AUTH_ENABLED: "false" }) });
    assert.deepEqual(await body(response), { enabled: false });
  });

  it("login・callback は、/account/ に戻す(Google には行かない)", async () => {
    for (const handler of [login, callback]) {
      const response = await handler({ request: get("/auth/google/login"), env: empty() });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("Location"), "/account/?error=unavailable");
    }
    assert.equal(google.calls.length, 0);
  });

  it("profile・logout・account は 503", async () => {
    const context = (request) => ({ request, env: empty() });
    assert.equal(
      (await updateProfile(context(write("POST", "/api/profile", { body: {} })))).status,
      503,
    );
    assert.equal((await logout(context(write("POST", "/api/logout")))).status, 503);
    assert.equal(
      (await deleteAccount(context(write("DELETE", "/api/account", { body: {} })))).status,
      503,
    );
  });
});

describe("login", () => {
  it("Google へ、PKCE・state・nonce つきで送り、署名つきの Cookie を渡す", async () => {
    const response = await login({ request: get("/auth/google/login"), env });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get("Location"));
    assert.equal(url.hostname, "accounts.google.com");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("state").length >= 32);
    assert.ok(url.searchParams.get("nonce").length >= 32);

    const oauth = findSetCookie(response, OAUTH_COOKIE);
    assert.deepEqual(
      ["path=/", "secure", "httponly", "samesite=lax", "max-age=600"].filter(
        (a) => !oauth.attributes.includes(a),
      ),
      [],
    );
    // verifier(秘密)は、URL に出ない。Cookie の中は、署名されていて、読み取れる形だが、改ざんできない
    assert.ok(!response.headers.get("Location").includes("verifier"));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("毎回、違う state を作る", async () => {
    const a = new URL(
      (await login({ request: get("/auth/google/login"), env })).headers.get("Location"),
    );
    const b = new URL(
      (await login({ request: get("/auth/google/login"), env })).headers.get("Location"),
    );
    assert.notEqual(a.searchParams.get("state"), b.searchParams.get("state"));
  });

  it("reauth=1 なら prompt=login", async () => {
    const response = await login({ request: get("/auth/google/login?reauth=1"), env });
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("prompt"), "login");
  });

  it("回数を制限する(20 回 / 10 分)", async () => {
    let last;
    for (let i = 0; i < 21; i += 1) {
      last = await login({
        request: get("/auth/google/login", { headers: { "CF-Connecting-IP": "203.0.113.9" } }),
        env,
      });
    }
    assert.equal(last.headers.get("Location"), "/account/?error=rate-limited");
    // 別の IP は、影響を受けない
    const other = await login({
      request: get("/auth/google/login", { headers: { "CF-Connecting-IP": "203.0.113.10" } }),
      env,
    });
    assert.match(other.headers.get("Location"), /^https:\/\/accounts\.google\.com/);
    const logged = await rows(env, "SELECT event FROM audit_log WHERE event = 'rate-limited'");
    assert.equal(logged.length, 1);
  });

  it("IP アドレスは、DB に、そのまま残らない", async () => {
    await login({
      request: get("/auth/google/login", { headers: { "CF-Connecting-IP": "203.0.113.9" } }),
      env,
    });
    const keys = await rows(env, "SELECT key FROM rate_limits");
    assert.equal(keys.length, 1);
    assert.ok(!keys[0].key.includes("203.0.113.9"));
  });
});

describe("callback: 成功", () => {
  it("招待されたメールで、ユーザーとセッションを作り、/account/ へ戻す", async () => {
    const { result } = await loggedIn();
    assert.equal(result.callbackResponse.headers.get("Location"), "/account/");

    const users = await rows(env, "SELECT * FROM users");
    assert.equal(users.length, 1);
    assert.equal(users[0].google_sub, "google-sub-1");
    assert.equal(users[0].email, "alice@example.com");
    assert.equal(users[0].nickname, "ななしさん");
  });

  it("セッションの Cookie は、__Host-・Secure・HttpOnly・SameSite=Lax・Path=/・Domain なし", async () => {
    const { result } = await loggedIn();
    const line = result.session.line;
    assert.ok(line.startsWith("__Host-nolito_session="));
    for (const part of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax"])
      assert.ok(line.includes(part), part);
    assert.ok(!/domain/i.test(line));
    assert.match(line, new RegExp(`Max-Age=${ABSOLUTE_SECONDS}`));
    assert.ok(result.session.value.length >= 43);
  });

  it("DB には、トークンそのものでなく、SHA-256 のハッシュだけを保存する", async () => {
    const { result } = await loggedIn();
    const stored = await rows(env, "SELECT token_hash FROM sessions");
    assert.equal(stored.length, 1);
    assert.equal(stored[0].token_hash, await sha256(result.session.value));
    assert.notEqual(stored[0].token_hash, result.session.value);
    const dump = JSON.stringify(await rows(env, "SELECT * FROM sessions"));
    assert.ok(!dump.includes(result.session.value));
  });

  it("使い終わった state の Cookie は消す", async () => {
    const { result } = await loggedIn();
    const cleared = findSetCookie(result.callbackResponse, OAUTH_COOKIE);
    assert.equal(cleared.value, "");
    assert.ok(cleared.attributes.includes("max-age=0"));
  });

  it("2 回目のログインは、同じユーザー(sub で識別)。メールが変わっても追従する", async () => {
    await loggedIn();
    await loggedIn({ email: "bob@example.com" });
    const users = await rows(env, "SELECT * FROM users");
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "bob@example.com");
  });

  it("ログインのたびに、新しいトークンになる(固定化攻撃の対策)。前のセッションは終わる", async () => {
    const first = await loggedIn();
    const second = await signIn(env, google, { cookies: first.cookies });
    assert.notEqual(second.session.value, first.cookies[SESSION_COOKIE]);
    const old = await me({ request: get("/api/me", { cookies: first.cookies }), env });
    assert.equal((await body(old)).user, null);
  });

  it("メールの大文字・小文字・空白の違いを許す(許可リストは、小文字に統一)", async () => {
    google.identity.email = "Alice@Example.COM";
    await loggedIn();
    assert.equal((await rows(env, "SELECT email FROM users"))[0].email, "alice@example.com");
  });

  it("監査ログには、user_id と出来事だけで、メールを含まない", async () => {
    await loggedIn();
    const log = await rows(env, "SELECT * FROM audit_log");
    assert.deepEqual(
      log.map((row) => row.event),
      ["login"],
    );
    assert.ok(!JSON.stringify(log).includes("alice"));
    assert.ok(log[0].user_id);
  });

  it("セッションは、最大 10 まで。古いものから消える", async () => {
    const cookies = [];
    for (let i = 0; i < MAX_SESSIONS_PER_USER + 3; i += 1) {
      const { result } = await loggedIn();
      cookies.push(result.session.value);
      await env.DB.prepare("UPDATE sessions SET created_at = created_at - ?").bind(1).run(); // 作成順を確定させる
    }
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, MAX_SESSIONS_PER_USER);
  });
});

describe("callback: 失敗(どれも、セッションを作らず、/account/?error= に戻す)", () => {
  const expectFailure = async (result, error) => {
    assert.equal(result.callbackResponse.headers.get("Location"), `/account/?error=${error}`);
    assert.equal(result.session, null);
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 0);
  };

  it("招待されていないメールは、アカウントも作らない(not-invited)", async () => {
    google.identity.email = "eve@example.com";
    const result = await signIn(env, google);
    await expectFailure(result, "not-invited");
    assert.equal((await rows(env, "SELECT * FROM users")).length, 0);
    assert.deepEqual(
      (await rows(env, "SELECT event, user_id FROM audit_log")).map((r) => r.event),
      ["login-denied"],
    );
  });

  it("許可リストが空なら、だれも入れない", async () => {
    env = makeEnv({ ALLOWED_EMAILS: "" });
    await expectFailure(await signIn(env, google), "not-invited");
  });

  it("SIGNUP_MODE=open なら、招待されていなくても入れる", async () => {
    env = makeEnv({ SIGNUP_MODE: "open", ALLOWED_EMAILS: "" });
    google.identity.email = "eve@example.com";
    const result = await signIn(env, google);
    assert.ok(result.session);
  });

  it("メールが未確認の Google アカウントは、断る", async () => {
    google.identity.email_verified = false;
    await expectFailure(await signIn(env, google), "failed");
  });

  it("state が一致しない(別のリクエストの state)と、断る", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const oauth = findSetCookie(first, OAUTH_COOKIE);
    const code = google.register(first.headers.get("Location"));
    const response = await callback({
      request: get(`/auth/google/callback?code=${code}&state=forged`, {
        cookies: { [OAUTH_COOKIE]: oauth.value },
      }),
      env,
    });
    assert.equal(response.headers.get("Location"), "/account/?error=failed");
    assert.equal(findSetCookie(response, SESSION_COOKIE), null);
  });

  it("state の Cookie がない(別のブラウザ・期限切れ)と、断る", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const code = google.register(first.headers.get("Location"));
    const state = new URL(first.headers.get("Location")).searchParams.get("state");
    const response = await callback({
      request: get(`/auth/google/callback?code=${code}&state=${state}`),
      env,
    });
    assert.equal(response.headers.get("Location"), "/account/?error=failed");
    assert.equal(google.calls.length, 0, "Google に、トークンの交換を求めない");
  });

  it("state の Cookie が、改ざんされている・期限切れだと、断る", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const oauth = findSetCookie(first, OAUTH_COOKIE);
    const code = google.register(first.headers.get("Location"));
    const state = new URL(first.headers.get("Location")).searchParams.get("state");
    const tampered = `${oauth.value.slice(0, -2)}xx`;
    const expired = await seal(env.SESSION_SECRET, {
      state,
      nonce: "n",
      verifier: "v",
      next: "/account/",
      exp: nowSeconds() - 1,
    });
    for (const value of [tampered, expired, "garbage"]) {
      const response = await callback({
        request: get(`/auth/google/callback?code=${code}&state=${state}`, {
          cookies: { [OAUTH_COOKIE]: value },
        }),
        env,
      });
      assert.equal(response.headers.get("Location"), "/account/?error=failed");
    }
    assert.equal(google.calls.length, 0);
  });

  it("コードがない・Google が断った(token が 400)と、断る", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const oauth = findSetCookie(first, OAUTH_COOKIE);
    const state = new URL(first.headers.get("Location")).searchParams.get("state");
    const cookies = { [OAUTH_COOKIE]: oauth.value };
    const noCode = await callback({
      request: get(`/auth/google/callback?state=${state}`, { cookies }),
      env,
    });
    assert.equal(noCode.headers.get("Location"), "/account/?error=failed");
    const badCode = await callback({
      request: get(`/auth/google/callback?code=nope&state=${state}`, { cookies }),
      env,
    });
    assert.equal(badCode.headers.get("Location"), "/account/?error=failed");
  });

  it("利用者が Google の画面でキャンセルした(error=access_denied)", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const oauth = findSetCookie(first, OAUTH_COOKIE);
    const response = await callback({
      request: get("/auth/google/callback?error=access_denied", {
        cookies: { [OAUTH_COOKIE]: oauth.value },
      }),
      env,
    });
    assert.equal(response.headers.get("Location"), "/account/?error=cancelled");
    assert.equal(google.calls.length, 0);
  });

  it("同じコードは、2 回使えない(リプレイ)", async () => {
    const first = await login({ request: get("/auth/google/login"), env });
    const oauth = findSetCookie(first, OAUTH_COOKIE);
    const code = google.register(first.headers.get("Location"));
    const state = new URL(first.headers.get("Location")).searchParams.get("state");
    const request = () =>
      get(`/auth/google/callback?code=${code}&state=${state}`, {
        cookies: { [OAUTH_COOKIE]: oauth.value },
      });
    assert.ok(findSetCookie(await callback({ request: request(), env }), SESSION_COOKIE));
    const replay = await callback({ request: request(), env });
    assert.equal(replay.headers.get("Location"), "/account/?error=failed");
  });

  it("別のリクエストの nonce の ID トークンは、断る(nonce の取り違え)", async () => {
    google.claimOverrides = { nonce: "someone-elses-nonce" };
    await expectFailure(await signIn(env, google), "failed");
  });

  it("署名が壊れた ID トークンは、断る", async () => {
    google.signOptions = { corrupt: true };
    await expectFailure(await signIn(env, google), "failed");
  });

  it("失敗の詳しい理由は、画面でなく監査ログ(個人情報なし)に残す", async () => {
    google.claimOverrides = { aud: "other" };
    await signIn(env, google);
    const log = await rows(env, "SELECT event, detail, user_id FROM audit_log");
    assert.deepEqual(log, [{ event: "login-failed", detail: "id-token-audience", user_id: null }]);
  });

  it("callback の回数も制限する", async () => {
    let last;
    for (let i = 0; i < 21; i += 1) {
      last = await callback({ request: get("/auth/google/callback?error=x"), env });
    }
    assert.equal(last.headers.get("Location"), "/account/?error=rate-limited");
  });
});

describe("/api/me", () => {
  it("ログインしていなければ、user: null", async () => {
    const response = await me({ request: get("/api/me"), env });
    assert.deepEqual(await body(response), { enabled: true, user: null });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("ログインしていれば、ニックネーム・メール・登録日・ランキング参加の状態・管理者かを返す(sub やセッションは返さない)", async () => {
    const { cookies } = await loggedIn();
    const data = await body(await me({ request: get("/api/me", { cookies }), env }));
    assert.deepEqual(Object.keys(data.user).sort(), [
      "createdAt",
      "email",
      "isAdmin",
      "nickname",
      "rankingOptIn",
    ]);
    assert.equal(data.user.nickname, "ななしさん");
    assert.equal(data.user.rankingOptIn, false); // 既定は不参加
    assert.equal(data.user.isAdmin, false); // 既定(ADMIN_EMAILS 未設定)は、管理者ではない
  });

  it("ADMIN_EMAILS にあるメールアドレスだけ、isAdmin: true(Phase 26)", async () => {
    env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
    const { cookies } = await loggedIn();
    const data = await body(await me({ request: get("/api/me", { cookies }), env }));
    assert.equal(data.user.isAdmin, true);

    env = makeEnv({ ADMIN_EMAILS: "someone-else@example.com" });
    const other = await loggedIn();
    const otherData = await body(
      await me({ request: get("/api/me", { cookies: other.cookies }), env }),
    );
    assert.equal(otherData.user.isAdmin, false);
  });

  it("でたらめなセッションの Cookie は、ログインしていない扱い", async () => {
    for (const value of ["x", "a".repeat(500), "", "%00"]) {
      const data = await body(
        await me({ request: get("/api/me", { cookies: { [SESSION_COOKIE]: value } }), env }),
      );
      assert.equal(data.user, null);
    }
  });

  it("30 日使わなければ切れ、切れたセッションは DB からも消える", async () => {
    const { cookies } = await loggedIn();
    await env.DB.prepare("UPDATE sessions SET last_seen_at = last_seen_at - ?")
      .bind(IDLE_SECONDS + 10)
      .run();
    assert.equal((await body(await me({ request: get("/api/me", { cookies }), env }))).user, null);
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 0);
  });

  it("使い続けても、90 日で切れる", async () => {
    const { cookies } = await loggedIn();
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - ?")
      .bind(ABSOLUTE_SECONDS + 10)
      .run();
    assert.equal((await body(await me({ request: get("/api/me", { cookies }), env }))).user, null);
  });

  it("招待制で、許可リストから外されたら、すぐログインしていない扱いになる", async () => {
    const { cookies } = await loggedIn();
    const removed = { ...env, ALLOWED_EMAILS: "bob@example.com" };
    assert.equal(
      (await body(await me({ request: get("/api/me", { cookies }), env: removed }))).user,
      null,
    );
    const response = await updateProfile({
      request: write("POST", "/api/profile", { body: { nickname: "x" }, cookies }),
      env: removed,
    });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "not-invited");
  });
});

describe("requireAdmin(guard.js。Phase 26 PR 1。管理画面の入り口の基盤)", () => {
  it("ログインしていなければ、requireUser と同じ 401", async () => {
    const result = await requireAdmin({ request: get("/api/admin/x"), env });
    assert.equal(result.response.status, 401);
  });

  it("ログイン済みだが、ADMIN_EMAILS になければ、403 not-admin", async () => {
    const { cookies } = await loggedIn();
    const result = await requireAdmin({ request: get("/api/admin/x", { cookies }), env });
    assert.equal(result.response.status, 403);
    assert.equal((await body(result.response.clone())).error, "not-admin");
  });

  it("ADMIN_EMAILS にあれば、requireUser と同じ成功の形({ user, session, now })を返す", async () => {
    env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
    const { cookies } = await loggedIn();
    const result = await requireAdmin({ request: get("/api/admin/x", { cookies }), env });
    assert.ok(!result.response, "response がない(成功)");
    assert.equal(result.user.email, "alice@example.com");
  });

  it("write: true のときは、CSRF も確認する(requireUser と同じ)", async () => {
    env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
    const { cookies } = await loggedIn();
    const result = await requireAdmin(
      {
        request: write("POST", "/api/admin/x", {
          cookies,
          headers: { Origin: "https://evil.test" },
        }),
        env,
      },
      { write: true },
    );
    assert.equal(result.response.status, 403);
    assert.equal((await body(result.response.clone())).error, "bad-origin");
  });

  it("招待から外されていれば(招待制)、管理者でも 403 not-invited", async () => {
    env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
    const { cookies } = await loggedIn(); // 招待されている間に、ログインする
    const removed = { ...env, ALLOWED_EMAILS: "bob@example.com" }; // そのあと、招待から外す
    const result = await requireAdmin({ request: get("/api/admin/x", { cookies }), env: removed });
    assert.equal(result.response.status, 403);
    assert.equal((await body(result.response.clone())).error, "not-invited");
  });
});

describe("adminEmails・isAdmin(config.js。Phase 26 PR 1)", () => {
  it("カンマ区切りを、小文字・前後の空白なしの集合にする", () => {
    assert.deepEqual(
      adminEmails({ ADMIN_EMAILS: " Alice@Example.com ,bob@example.com,, " }),
      new Set(["alice@example.com", "bob@example.com"]),
    );
  });

  it("未設定・空なら、空集合(管理者はいない)", () => {
    assert.deepEqual(adminEmails({}), new Set());
    assert.deepEqual(adminEmails({ ADMIN_EMAILS: "" }), new Set());
  });

  it("isAdmin は、大文字小文字を区別しない", () => {
    const e = { ADMIN_EMAILS: "alice@example.com" };
    assert.equal(isAdmin(e, "alice@example.com"), true);
    assert.equal(isAdmin(e, "ALICE@EXAMPLE.COM"), true);
    assert.equal(isAdmin(e, "bob@example.com"), false);
  });
});

describe("/api/profile", () => {
  it("ニックネームを変えられる(前後の空白は削る)", async () => {
    const { cookies } = await loggedIn();
    const response = await updateProfile({
      request: write("POST", "/api/profile", { body: { nickname: "  たろう " }, cookies }),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal((await body(response)).user.nickname, "たろう");
    assert.equal((await rows(env, "SELECT nickname FROM users"))[0].nickname, "たろう");
    const events = (await rows(env, "SELECT event FROM audit_log")).map((r) => r.event);
    assert.ok(events.includes("profile-update"));
  });

  it("不正な値は、切り詰めず、400 で断る(DB は変わらない)", async () => {
    const { cookies } = await loggedIn();
    for (const [nickname, code] of [
      ["あ".repeat(13), "nickname-too-long"],
      ["", "nickname-required"],
      ["   ", "nickname-required"],
      [123, "nickname-invalid"],
      ["a\nb", "nickname-invalid"],
      [undefined, "nickname-invalid"],
    ]) {
      const response = await updateProfile({
        request: write("POST", "/api/profile", { body: { nickname }, cookies }),
        env,
      });
      assert.equal(response.status, 400, String(nickname));
      assert.equal((await body(response)).error, code);
    }
    assert.equal((await rows(env, "SELECT nickname FROM users"))[0].nickname, "ななしさん");
  });

  it("HTML の文字は、そのまま保存する(表示側が textContent で文字として出す)", async () => {
    const { cookies } = await loggedIn();
    const response = await updateProfile({
      request: write("POST", "/api/profile", { body: { nickname: "<b>x</b>" }, cookies }),
      env,
    });
    assert.equal((await body(response)).user.nickname, "<b>x</b>");
  });

  it("ログインしていなければ 401", async () => {
    const response = await updateProfile({
      request: write("POST", "/api/profile", { body: { nickname: "x" } }),
      env,
    });
    assert.equal(response.status, 401);
  });

  it("JSON 以外・壊れた JSON・大きすぎる本文は断る", async () => {
    const { cookies } = await loggedIn();
    const call = (options) =>
      updateProfile({ request: write("POST", "/api/profile", { cookies, ...options }), env });
    assert.equal(
      (await call({ body: "nickname=x", json: false, headers: { "Content-Type": "text/plain" } }))
        .status,
      415,
    );
    assert.equal((await call({ body: "{" })).status, 400);
    assert.equal(
      (await call({ body: JSON.stringify({ nickname: "x".repeat(5000) }) })).status,
      400,
    );
  });

  it("回数を制限する(30 回 / 10 分)", async () => {
    const { cookies } = await loggedIn();
    let last;
    for (let i = 0; i < 31; i += 1) {
      last = await updateProfile({
        request: write("POST", "/api/profile", { body: { nickname: "x" }, cookies }),
        env,
      });
    }
    assert.equal(last.status, 429);
  });
});

describe("CSRF の対策(状態を変える要求)", () => {
  const cases = [
    ["Origin がない", { headers: { Origin: null } }, "bad-origin"],
    ["別のサイトの Origin", { headers: { Origin: "https://evil.test" } }, "bad-origin"],
    [
      "Origin に見えて違う(サブドメイン)",
      { headers: { Origin: "https://x.nolito.test" } },
      "bad-origin",
    ],
    ["http の Origin", { headers: { Origin: "http://nolito.test" } }, "bad-origin"],
    ["独自ヘッダーがない", { headers: { "X-NOLITO-CSRF": null } }, "csrf-header-required"],
    ["独自ヘッダーの値が違う", { headers: { "X-NOLITO-CSRF": "0" } }, "csrf-header-required"],
  ];
  const targets = [
    ["profile", updateProfile, "POST", "/api/profile", { nickname: "x" }],
    ["logout", logout, "POST", "/api/logout", undefined],
    ["account", deleteAccount, "DELETE", "/api/account", { confirm: "delete" }],
  ];

  for (const [label, options, code] of cases) {
    it(`${label} → 403 ${code}(profile・logout・account すべて)`, async () => {
      const { cookies } = await loggedIn();
      for (const [name, handler, method, path, payload] of targets) {
        const response = await handler({
          request: write(method, path, { body: payload, cookies, ...options }),
          env,
        });
        assert.equal(response.status, 403, name);
        assert.equal((await body(response)).error, code, name);
      }
      // 何も変わっていない
      assert.equal((await rows(env, "SELECT * FROM users")).length, 1);
      assert.equal((await rows(env, "SELECT * FROM sessions")).length, 1);
      assert.equal((await rows(env, "SELECT nickname FROM users"))[0].nickname, "ななしさん");
    });
  }

  it("フォームの送信(text/plain)では、ニックネームを変えられない", async () => {
    const { cookies } = await loggedIn();
    const response = await updateProfile({
      request: write("POST", "/api/profile", {
        body: '{"nickname":"hacked"}',
        cookies,
        json: false,
        headers: { "Content-Type": "text/plain", "X-NOLITO-CSRF": null },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("メソッドが違えば 405 で、許すメソッドを知らせる(GET で、削除や変更はできない)", async () => {
    const expected = {
      "../functions/api/me.js": "GET",
      "../functions/api/profile.js": "POST",
      "../functions/api/logout.js": "POST",
      "../functions/api/account.js": "DELETE",
      "../functions/auth/google/login.js": "GET",
      "../functions/auth/google/callback.js": "GET",
    };
    for (const [path, allow] of Object.entries(expected)) {
      const response = (await import(path)).onRequest();
      assert.equal(response.status, 405, path);
      assert.equal(response.headers.get("Allow"), allow, path);
    }
  });
});

describe("logout", () => {
  it("セッションを DB から消し、Cookie を消す", async () => {
    const { cookies } = await loggedIn();
    const response = await logout({ request: write("POST", "/api/logout", { cookies }), env });
    assert.equal(response.status, 200);
    const cleared = findSetCookie(response, SESSION_COOKIE);
    assert.equal(cleared.value, "");
    assert.ok(cleared.attributes.includes("max-age=0"));
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 0);
    assert.equal((await body(await me({ request: get("/api/me", { cookies }), env }))).user, null);
    const events = (await rows(env, "SELECT event FROM audit_log")).map((r) => r.event);
    assert.ok(events.includes("logout"));
  });

  it("盗まれたトークンも、ログアウトすれば使えない(サーバー側で無効になる)", async () => {
    const { cookies } = await loggedIn();
    await logout({ request: write("POST", "/api/logout", { cookies }), env });
    const replay = await updateProfile({
      request: write("POST", "/api/profile", { body: { nickname: "x" }, cookies }),
      env,
    });
    assert.equal(replay.status, 401);
  });

  it("ログインしていなくても、エラーにしない", async () => {
    const response = await logout({ request: write("POST", "/api/logout"), env });
    assert.equal(response.status, 200);
  });

  it("招待から外された後でも、ログアウトはできる", async () => {
    const { cookies } = await loggedIn();
    const removed = { ...env, ALLOWED_EMAILS: "" };
    const response = await logout({
      request: write("POST", "/api/logout", { cookies }),
      env: removed,
    });
    assert.equal(response.status, 200);
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 0);
  });

  it("ほかの端末のセッションは、残る", async () => {
    const a = await loggedIn();
    const b = await loggedIn();
    await logout({ request: write("POST", "/api/logout", { cookies: a.cookies }), env });
    assert.equal(
      (await body(await me({ request: get("/api/me", { cookies: b.cookies }), env }))).user.email,
      "alice@example.com",
    );
  });
});

describe("アカウントの削除", () => {
  const remove = (cookies, payload = { confirm: "delete" }) =>
    deleteAccount({ request: write("DELETE", "/api/account", { body: payload, cookies }), env });

  it("ログイン直後なら、削除できる。ユーザー・セッションが消え、Cookie も消える", async () => {
    const { cookies } = await loggedIn();
    const response = await remove(cookies);
    assert.equal(response.status, 200);
    assert.equal((await rows(env, "SELECT * FROM users")).length, 0);
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 0);
    assert.ok(findSetCookie(response, SESSION_COOKIE).attributes.includes("max-age=0"));
    assert.equal((await body(await me({ request: get("/api/me", { cookies }), env }))).user, null);
  });

  it("ほかの端末のセッションも、すべて消える。ほかの人のデータは、消えない", async () => {
    const a1 = await loggedIn();
    const a2 = await loggedIn();
    const bob = await loggedIn({ sub: "google-sub-2", email: "bob@example.com" });
    await remove(a1.cookies);
    assert.equal(
      (await body(await me({ request: get("/api/me", { cookies: a2.cookies }), env }))).user,
      null,
    );
    assert.equal(
      (await body(await me({ request: get("/api/me", { cookies: bob.cookies }), env }))).user.email,
      "bob@example.com",
    );
    assert.equal((await rows(env, "SELECT * FROM users")).length, 1);
  });

  it("監査ログは残るが、誰のものか分からなくなる(user_id が NULL)。メールは、どこにも残らない", async () => {
    const { cookies } = await loggedIn();
    await remove(cookies);
    const log = await rows(env, "SELECT event, user_id FROM audit_log ORDER BY id");
    assert.deepEqual(
      log.map((r) => r.event),
      ["login", "account-delete"],
    );
    assert.ok(log.every((r) => r.user_id === null));
    const everything = JSON.stringify([
      await rows(env, "SELECT * FROM users"),
      await rows(env, "SELECT * FROM sessions"),
      log,
      await rows(env, "SELECT * FROM rate_limits"),
    ]);
    assert.ok(!everything.includes("alice@example.com"));
    assert.ok(!everything.includes("google-sub-1"));
  });

  it("削除の後、同じ Google アカウントで入り直すと、新しい(空の)アカウントになる", async () => {
    const first = await loggedIn();
    await updateProfile({
      request: write("POST", "/api/profile", {
        body: { nickname: "たろう" },
        cookies: first.cookies,
      }),
      env,
    });
    await remove(first.cookies);
    await loggedIn();
    assert.equal((await rows(env, "SELECT nickname FROM users"))[0].nickname, "ななしさん");
  });

  it("確認の文字がないと、削除しない(400)", async () => {
    const { cookies } = await loggedIn();
    for (const payload of [{}, { confirm: "yes" }, { confirm: true }, { confirm: "DELETE" }]) {
      const response = await remove(cookies, payload);
      assert.equal(response.status, 400);
      assert.equal((await body(response)).error, "confirm-required");
    }
    assert.equal((await rows(env, "SELECT * FROM users")).length, 1);
  });

  it("ログインから 10 分を過ぎていたら、再ログインを求める(403 reauth-required)。削除しない", async () => {
    const { cookies } = await loggedIn();
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 601").run();
    const response = await remove(cookies);
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "reauth-required");
    assert.equal((await rows(env, "SELECT * FROM users")).length, 1);
    assert.equal((await rows(env, "SELECT * FROM sessions")).length, 1);
  });

  it("ちょうど 10 分は許し、再ログイン(reauth)をすれば、また削除できる", async () => {
    const { cookies } = await loggedIn();
    // 599 秒(境界のすぐ内側)にする。ちょうど 600 秒だと、DB の更新とリクエストの間に実時間の秒が
    // 進んだだけで(now が秒単位のため)、まれに 601 秒扱いになり、この後の 200 が flaky になる
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 599").run();
    assert.equal((await remove(cookies)).status, 200);

    const again = await loggedIn();
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 3600").run();
    assert.equal((await remove(again.cookies)).status, 403);
    // 再ログイン(prompt=login)で、新しいセッションになり、削除できる
    const reauth = await signIn(env, google, {
      path: "/auth/google/login?reauth=1",
      cookies: again.cookies,
    });
    assert.match(reauth.location, /prompt=login/);
    assert.equal((await remove({ [SESSION_COOKIE]: reauth.session.value })).status, 200);
    const log = await rows(env, "SELECT detail FROM audit_log WHERE detail = 'reauth'");
    assert.equal(log.length, 1);
  });

  it("ログインしていなければ 401", async () => {
    assert.equal((await remove({})).status, 401);
  });

  it("回数を制限する(5 回 / 10 分)", async () => {
    const { cookies } = await loggedIn();
    let last;
    for (let i = 0; i < 6; i += 1) last = await remove(cookies, {});
    assert.equal(last.status, 429);
  });
});

describe("安全なつくり", () => {
  it("応答は no-store・nosniff(個人ごとの応答を、キャッシュさせない)", async () => {
    const { cookies } = await loggedIn();
    const responses = [
      await me({ request: get("/api/me", { cookies }), env }),
      await login({ request: get("/auth/google/login"), env }),
      await updateProfile({
        request: write("POST", "/api/profile", { body: { nickname: "x" }, cookies }),
        env,
      }),
      await logout({ request: write("POST", "/api/logout"), env }),
    ];
    for (const response of responses) {
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    }
  });

  it("オープンリダイレクト: next に外部の URL を入れても、/account/ に戻る", async () => {
    for (const next of ["https://evil.test/", "//evil.test", "/\\evil.test"]) {
      const result = await signIn(env, google, {
        path: `/auth/google/login?next=${encodeURIComponent(next)}`,
      });
      assert.equal(result.callbackResponse.headers.get("Location"), "/account/", next);
    }
  });

  it("ソースに、シークレット(クライアントシークレットなど)を出力していない", async () => {
    const { cookies } = await loggedIn();
    const outputs = [
      await (await me({ request: get("/api/me", { cookies }), env })).text(),
      JSON.stringify([...(await login({ request: get("/auth/google/login"), env })).headers]),
    ].join("\n");
    assert.ok(!outputs.includes("test-secret"));
    assert.ok(!outputs.includes(env.SESSION_SECRET));
  });

  it("ORIGIN の定数は、SITE_ORIGIN と同じ", () => {
    assert.equal(env.SITE_ORIGIN, ORIGIN);
  });
});

describe("想定外の失敗", () => {
  // 例外の内容は、ログにだけ出す(テストの出力を汚さないよう、捕まえる)
  beforeEach(() => mock.method(console, "error", () => {}));
  afterEach(() => console.error.mock.restore());

  const broken = () => {
    const db = createDb();
    db.prepare = () => {
      throw new Error("D1 is down: secret-detail");
    };
    return makeEnv({ DB: db });
  };

  it("API は、例外を JSON の 500 にして、内部の内容を返さない", async () => {
    const request = get("/api/me", { cookies: { [SESSION_COOKIE]: "some-token" } }); // Cookie がなければ、DB を引かない
    const response = await apiGuard({ next: () => me({ request, env: broken() }) });
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.deepEqual(JSON.parse(text), { error: "server-error" });
    assert.ok(!text.includes("secret-detail"));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("/auth は、例外をログインの失敗として、/account/ に戻す(Cookie は付けない)", async () => {
    const response = await authGuard({
      next: () => login({ request: get("/auth/google/login"), env: broken() }),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/account/?error=failed");
    assert.equal(response.headers.getSetCookie().length, 0);
  });

  it("例外がなければ、そのまま通す", async () => {
    const response = await apiGuard({ next: () => me({ request: get("/api/me"), env }) });
    assert.equal(response.status, 200);
  });

  it("初めてのログインが同時に 2 回来ても、利用者は 1 人(UNIQUE で落ちない)", async () => {
    const [a, b] = await Promise.all([
      upsertUser(env.DB, { sub: "same-sub", email: "a@example.com", now: 1000 }),
      upsertUser(env.DB, { sub: "same-sub", email: "a@example.com", now: 1000 }),
    ]);
    assert.equal(a.user.id, b.user.id);
    assert.equal((await rows(env, "SELECT * FROM users")).length, 1);
    assert.deepEqual([a.created, b.created].sort(), [false, true]);
  });
});
