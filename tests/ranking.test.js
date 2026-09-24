// オンラインランキング(Phase 19 PR 3)の通しのテスト。本物と同じ SQL(node:sqlite の D1 互換)を使う。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  onRequestGet as getRanking,
  onRequestPost as postRanking,
} from "../functions/api/games/escape-boss/ranking.js";
import { onRequestPost as postOptIn } from "../functions/api/ranking-opt-in.js";
import { onRequestGet as getMe } from "../functions/api/me.js";
import { onRequestDelete as deleteAccount } from "../functions/api/account.js";
import { maxScoreFor } from "../functions/_lib/ranking-limits.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const body = (response) => response.json();

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

async function optIn(cookies, enabled = true) {
  return postOptIn({
    request: write("POST", "/api/ranking-opt-in", { body: { enabled }, cookies }),
    env,
  });
}

const entry = (overrides = {}) => ({
  roleId: "senpai",
  difficultyId: "normal",
  jobId: "engineer",
  nickname: "どうき",
  title: "先輩超え",
  score: 1000,
  ...overrides,
});

describe("POST /api/ranking-opt-in", () => {
  it("ログインしていなければ 401", async () => {
    const response = await postOptIn({
      request: write("POST", "/api/ranking-opt-in", { body: { enabled: true } }),
      env,
    });
    assert.equal(response.status, 401);
  });

  it("参加に切り替えられ、/api/me にも反映される", async () => {
    const cookies = await login();
    const response = await optIn(cookies, true);
    assert.equal(response.status, 200);
    assert.equal((await body(response)).rankingOptIn, true);

    const me = await body(await getMe({ request: get("/api/me", { cookies }), env }));
    assert.equal(me.user.rankingOptIn, true);
  });

  it("既定は不参加", async () => {
    const cookies = await login();
    const me = await body(await getMe({ request: get("/api/me", { cookies }), env }));
    assert.equal(me.user.rankingOptIn, false);
  });

  it("不参加に切り替えると、公開されていた記録も、すぐに消える", async () => {
    const cookies = await login();
    await optIn(cookies, true);
    await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
      env,
    });
    const before = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    assert.equal(before.entries.length, 1);

    await optIn(cookies, false);
    const after = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    assert.equal(after.entries.length, 0);
  });

  it("enabled が真偽値でなければ 400", async () => {
    const cookies = await login();
    const response = await postOptIn({
      request: write("POST", "/api/ranking-opt-in", { body: { enabled: "yes" }, cookies }),
      env,
    });
    assert.equal(response.status, 400);
  });
});

describe("GET /api/games/escape-boss/ranking", () => {
  it("ログイン不要(だれでも見られる)。まだなければ、空", async () => {
    const response = await getRanking({
      request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
      env,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { entries: [] });
  });

  it("知らない役職・難易度は 400", async () => {
    const response = await getRanking({
      request: get("/api/games/escape-boss/ranking?role=unknown&difficulty=normal"),
      env,
    });
    assert.equal(response.status, 400);
  });

  it("個人を特定する情報(メールアドレス・アカウントID)を含まない", async () => {
    const cookies = await login();
    await optIn(cookies);
    await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
      env,
    });
    const response = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    const text = JSON.stringify(response);
    assert.ok(!text.includes("alice@example.com"));
    assert.deepEqual(Object.keys(response.entries[0]).sort(), [
      "achievedAt",
      "jobId",
      "nickname",
      "score",
      "title",
    ]);
  });
});

describe("POST /api/games/escape-boss/ranking", () => {
  it("ログインしていなければ 401", async () => {
    const response = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry() }),
      env,
    });
    assert.equal(response.status, 401);
  });

  it("別オリジンからは、CSRF で断る", async () => {
    const cookies = await login();
    await optIn(cookies);
    const response = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", {
        body: entry(),
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("参加していなければ、403(ranking-opt-out)", async () => {
    const cookies = await login();
    const response = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
      env,
    });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "ranking-opt-out");
  });

  it("参加していれば、保存でき、GET で読み返せる", async () => {
    const cookies = await login();
    await optIn(cookies);
    const post = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
      env,
    });
    assert.equal(post.status, 200);
    const get1 = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    assert.equal(get1.entries[0].nickname, "どうき");
    assert.equal(get1.entries[0].score, 1000);
  });

  it("自己ベストより低いスコアは、置き換えない(上がったときだけ、置き換える)", async () => {
    const cookies = await login();
    await optIn(cookies);
    await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", {
        body: entry({ score: 2000 }),
        cookies,
      }),
      env,
    });
    await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", {
        body: entry({ score: 1000, nickname: "べつめい" }),
        cookies,
      }),
      env,
    });
    const response = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    assert.equal(response.entries.length, 1);
    assert.equal(response.entries[0].score, 2000);
    assert.equal(response.entries[0].nickname, "どうき");
  });

  it("1利用者 × 役職 × 難易度で、1件だけ(2件に増えない)", async () => {
    const cookies = await login();
    await optIn(cookies);
    for (const score of [500, 1500, 1200]) {
      await postRanking({
        request: write("POST", "/api/games/escape-boss/ranking", {
          body: entry({ score }),
          cookies,
        }),
        env,
      });
    }
    const response = await body(
      await getRanking({
        request: get("/api/games/escape-boss/ranking?role=senpai&difficulty=normal"),
        env,
      }),
    );
    assert.equal(response.entries.length, 1);
    assert.equal(response.entries[0].score, 1500);
  });

  it("あり得ない大きさのスコア(改ざん)は、400で断る", async () => {
    const cookies = await login();
    await optIn(cookies);
    const response = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", {
        body: entry({ score: maxScoreFor("senpai") + 1 }),
        cookies,
      }),
      env,
    });
    assert.equal(response.status, 400);
    assert.equal((await body(response)).error, "invalid-score");
  });

  it("やさしい(練習)は、ランキングの対象外(400)", async () => {
    const cookies = await login();
    await optIn(cookies);
    const response = await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", {
        body: entry({ difficultyId: "easy" }),
        cookies,
      }),
      env,
    });
    assert.equal(response.status, 400);
  });

  it("知らない役職・職種は、400", async () => {
    const cookies = await login();
    await optIn(cookies);
    for (const bad of [{ roleId: "unknown" }, { jobId: "unknown" }]) {
      const response = await postRanking({
        request: write("POST", "/api/games/escape-boss/ranking", { body: entry(bad), cookies }),
        env,
      });
      assert.equal(response.status, 400, JSON.stringify(bad));
    }
  });

  it("ニックネーム・称号が不正なら、400", async () => {
    const cookies = await login();
    await optIn(cookies);
    for (const bad of [{ nickname: "x".repeat(50) }, { title: "y".repeat(50) }]) {
      const response = await postRanking({
        request: write("POST", "/api/games/escape-boss/ranking", { body: entry(bad), cookies }),
        env,
      });
      assert.equal(response.status, 400, JSON.stringify(bad));
    }
  });

  it("回数を制限する(60回/10分)", async () => {
    const cookies = await login();
    await optIn(cookies);
    let last;
    for (let i = 0; i < 61; i += 1) {
      last = await postRanking({
        request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
        env,
      });
    }
    assert.equal(last.status, 429);
  });
});

describe("アカウントを削除すると、オンラインランキングの記録も消える", () => {
  it("削除後、DB から ranking_entries の行が消える", async () => {
    const cookies = await login();
    await optIn(cookies);
    await postRanking({
      request: write("POST", "/api/games/escape-boss/ranking", { body: entry(), cookies }),
      env,
    });
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM ranking_entries").first();
    assert.equal(before.n, 1);

    await deleteAccount({
      request: write("DELETE", "/api/account", { body: { confirm: "delete" }, cookies }),
      env,
    });
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM ranking_entries").first();
    assert.equal(after.n, 0);
  });
});
