// ゲームの記録の、アカウントへの同期(Phase 19 PR 2)の通しのテスト。
// 本物と同じ SQL(node:sqlite の D1 互換)を使う。外部には通信しない。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  onRequestGet as getSync,
  onRequestPost as postSync,
} from "../functions/api/games/escape-boss/sync.js";
import { onRequestDelete as deleteAccount } from "../functions/api/account.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";
import { bestKey, clearKey } from "../public/assets/js/games/escape-boss/storage.js";

const body = (response) => response.json();

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv();
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

// ログインして、session の Cookie( { [SESSION_COOKIE]: 値 } )を返す
async function login() {
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

const progress = (overrides = {}) => ({
  nickname: "どうき",
  titleId: "newbie",
  totalClears: 3,
  totalWords: 40,
  clears: { senpai: 2 },
  clearedJobs: { engineer: true },
  exp: 500,
  jobs: { engineer: { plays: 5, clears: 2, words: 40, hits: 100, miss: 5 } },
  difficultyClears: { [clearKey("senpai", "normal")]: 2 },
  bests: { [bestKey("engineer", "senpai", "normal")]: { score: 1500, playedAt: 1 } },
  achievements: { "clear-senpai": 100 },
  ...overrides,
});

describe("GET /api/games/escape-boss/sync", () => {
  it("ログインしていなければ 401", async () => {
    const response = await getSync({ request: get("/api/games/escape-boss/sync"), env });
    assert.equal(response.status, 401);
  });

  it("同期したことがなければ、progress は null", async () => {
    const cookies = await login();
    const response = await getSync({
      request: get("/api/games/escape-boss/sync", { cookies }),
      env,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { progress: null });
  });
});

describe("POST /api/games/escape-boss/sync", () => {
  it("ログインしていなければ 401", async () => {
    const response = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", { body: progress() }),
      env,
    });
    assert.equal(response.status, 401);
  });

  it("別オリジンからは、CSRF で断る", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", {
        body: progress(),
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("保存でき、GET で読み返せる(要約の形をそのまま保つ)", async () => {
    const cookies = await login();
    const post = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", { body: progress(), cookies }),
      env,
    });
    assert.equal(post.status, 200);
    const posted = await body(post);
    assert.equal(posted.ok, true);
    assert.equal(posted.progress.nickname, "どうき");
    assert.equal(posted.progress.exp, 500);

    const get2 = await getSync({ request: get("/api/games/escape-boss/sync", { cookies }), env });
    const fetched = await body(get2);
    assert.equal(fetched.progress.nickname, "どうき");
    assert.deepEqual(fetched.progress.bests, progress().bests);
    assert.deepEqual(fetched.progress.jobs, progress().jobs);
    assert.ok(Number.isInteger(fetched.progress.updatedAt));
  });

  it("2回目の保存は、1回目を置き換える(2件にならない)", async () => {
    const cookies = await login();
    await postSync({
      request: write("POST", "/api/games/escape-boss/sync", {
        body: progress({ exp: 100 }),
        cookies,
      }),
      env,
    });
    await postSync({
      request: write("POST", "/api/games/escape-boss/sync", {
        body: progress({ exp: 200 }),
        cookies,
      }),
      env,
    });
    const response = await getSync({
      request: get("/api/games/escape-boss/sync", { cookies }),
      env,
    });
    assert.equal((await body(response)).progress.exp, 200);
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM game_progress").first();
    assert.equal(rows.n, 1);
  });

  it("不正な値は、それぞれ既定・空に整えて保存する(全体は断らない)", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", {
        body: { nickname: "x".repeat(50), exp: -100, jobs: { bad: "x" } },
        cookies,
      }),
      env,
    });
    assert.equal(response.status, 200);
    const posted = await body(response);
    assert.equal(posted.progress.nickname.length, 12);
    assert.equal(posted.progress.exp, 0);
  });

  it("オブジェクトでない本文は、400", async () => {
    const cookies = await login();
    const response = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", { body: "not-json-object", cookies }),
      env,
    });
    assert.equal(response.status, 400);
  });

  it("回数を制限する(30回/10分)", async () => {
    const cookies = await login();
    let last;
    for (let i = 0; i < 31; i += 1) {
      last = await postSync({
        request: write("POST", "/api/games/escape-boss/sync", { body: progress(), cookies }),
        env,
      });
    }
    assert.equal(last.status, 429);
  });

  it("大きすぎる本文は断る", async () => {
    const cookies = await login();
    const huge = progress({ jobs: { engineer: { note: "a".repeat(100_000) } } });
    const response = await postSync({
      request: write("POST", "/api/games/escape-boss/sync", { body: huge, cookies }),
      env,
    });
    // Content-Length が付いていれば 413(先に断る)、そうでなければ本文を読んでから 400(too-large)
    assert.ok([400, 413].includes(response.status), response.status);
  });
});

describe("アカウントを削除すると、同期した記録も消える", () => {
  it("削除後、DB から game_progress の行が消える", async () => {
    const signed = await signIn(env, google);
    const cookies = { [SESSION_COOKIE]: signed.session.value };
    await postSync({
      request: write("POST", "/api/games/escape-boss/sync", { body: progress(), cookies }),
      env,
    });
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM game_progress").first();
    assert.equal(before.n, 1);

    await deleteAccount({
      request: write("DELETE", "/api/account", { body: { confirm: "delete" }, cookies }),
      env,
    });
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM game_progress").first();
    assert.equal(after.n, 0);
  });
});
