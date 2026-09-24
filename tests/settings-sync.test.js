// サイト全体の見た目の設定(テーマ・文字サイズ・アニメーション軽減)の、アカウントへの同期(Phase 21 PR 3)の通しのテスト。
// 本物と同じ SQL(node:sqlite の D1 互換)を使う。外部には通信しない。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { onRequestDelete as deleteAccount } from "../functions/api/account.js";
import {
  onRequestGet as getSync,
  onRequestPost as postSync,
} from "../functions/api/settings/sync.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const body = (response) => response.json();
const PATH = "/api/settings/sync";

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv();
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

async function login() {
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

const settings = (overrides = {}) => ({
  theme: "dark",
  fontSize: "large",
  reducedMotion: "reduce",
  ...overrides,
});

describe("GET /api/settings/sync", () => {
  it("ログインしていなければ 401", async () => {
    const response = await getSync({ request: get(PATH), env });
    assert.equal(response.status, 401);
  });

  it("同期したことがなければ、settings は null", async () => {
    const cookies = await login();
    const response = await getSync({ request: get(PATH, { cookies }), env });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { settings: null });
  });
});

describe("POST /api/settings/sync", () => {
  it("ログインしていなければ 401", async () => {
    const response = await postSync({ request: write("POST", PATH, { body: settings() }), env });
    assert.equal(response.status, 401);
  });

  it("別オリジンからは、CSRF で断る", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", PATH, {
        body: settings(),
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("保存でき、GET で読み返せる", async () => {
    const cookies = await login();
    const post = await postSync({
      request: write("POST", PATH, { body: settings(), cookies }),
      env,
    });
    assert.equal(post.status, 200);
    const posted = await body(post);
    assert.equal(posted.ok, true);
    assert.equal(posted.settings.theme, "dark");
    assert.equal(posted.settings.fontSize, "large");
    assert.equal(posted.settings.reducedMotion, "reduce");
    assert.ok(Number.isInteger(posted.settings.updatedAt));

    const get2 = await getSync({ request: get(PATH, { cookies }), env });
    const fetched = await body(get2);
    assert.deepEqual(fetched.settings, posted.settings);
  });

  it("2回目の保存は、1回目を置き換える(2件にならない)", async () => {
    const cookies = await login();
    await postSync({
      request: write("POST", PATH, { body: settings({ theme: "light" }), cookies }),
      env,
    });
    await postSync({
      request: write("POST", PATH, { body: settings({ theme: "dark" }), cookies }),
      env,
    });
    const response = await getSync({ request: get(PATH, { cookies }), env });
    assert.equal((await body(response)).settings.theme, "dark");
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM site_settings").first();
    assert.equal(rows.n, 1);
  });

  it("不正な値は、それぞれ既定に整えて保存する(全体は断らない)", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", PATH, {
        body: { theme: "neon", fontSize: "huge", reducedMotion: "always" },
        cookies,
      }),
      env,
    });
    assert.equal(response.status, 200);
    const posted = await body(response);
    assert.equal(posted.settings.theme, "system");
    assert.equal(posted.settings.fontSize, "standard");
    assert.equal(posted.settings.reducedMotion, "system");
  });

  it("オブジェクトでない本文は、400", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", PATH, { body: "not-json-object", cookies }),
      env,
    });
    assert.equal(response.status, 400);
  });

  it("回数を制限する(30回/10分)", async () => {
    const cookies = await login();
    let last;
    for (let i = 0; i < 31; i += 1) {
      last = await postSync({ request: write("POST", PATH, { body: settings(), cookies }), env });
    }
    assert.equal(last.status, 429);
  });

  it("大きすぎる本文は断る", async () => {
    const cookies = await login();
    const huge = settings({ theme: "x".repeat(100_000) });
    const response = await postSync({ request: write("POST", PATH, { body: huge, cookies }), env });
    assert.ok([400, 413].includes(response.status), response.status);
  });
});

describe("アカウントを削除すると、同期した設定も消える", () => {
  it("削除後、DB から site_settings の行が消える", async () => {
    const signed = await signIn(env, google);
    const cookies = { [SESSION_COOKIE]: signed.session.value };
    await postSync({ request: write("POST", PATH, { body: settings(), cookies }), env });
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM site_settings").first();
    assert.equal(before.n, 1);

    await deleteAccount({
      request: write("DELETE", "/api/account", { body: { confirm: "delete" }, cookies }),
      env,
    });
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM site_settings").first();
    assert.equal(after.n, 0);
  });
});
