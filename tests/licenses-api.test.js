// ライセンスの API のテスト(Phase 9 PR 2): 登録・一覧・アカウント削除との関係。
// 本物と同じ SQL(node:sqlite の D1 互換)と、偽の Google を使う。外部には通信しない。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { onRequestDelete as deleteAccount } from "../functions/api/account.js";
import * as licensesModule from "../functions/api/licenses.js";
import * as redeemModule from "../functions/api/licenses/redeem.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { hashKey, newLicense, normalizeKey } from "../functions/_lib/licenses.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const list = licensesModule.onRequestGet;
const redeem = redeemModule.onRequestPost;

const rows = async (env, sql, ...params) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .all()
  ).results;

const UNKNOWN_KEY = "NLTO-AAAAA-AAAAA-AAAAA-AAAAA";

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv();
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

async function loggedIn(identity) {
  google.identity = {
    sub: "google-sub-1",
    email: "alice@example.com",
    email_verified: true,
    ...identity,
  };
  const { session } = await signIn(env, google);
  assert.ok(session);
  return { [SESSION_COOKIE]: session.value };
}
const bob = () => loggedIn({ sub: "google-sub-2", email: "bob@example.com" });

/** 発行して、DB に入れる(発行スクリプトの INSERT と、同じ列)。表示用のキーを返す。 */
async function issue({ productId = "kii-michi", note = "" } = {}) {
  const { key, row } = await newLicense({ productId, note, now: 1_000 });
  await env.DB.prepare(
    "INSERT INTO licenses (id, key_hash, key_hint, product_id, note, issued_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(row.id, row.keyHash, row.keyHint, row.productId, row.note, row.issuedAt)
    .run();
  return key;
}

const post = (cookies, key, options = {}) =>
  redeem({
    request: write("POST", "/api/licenses/redeem", { body: { key }, cookies, ...options }),
    env,
  });
const mine = (cookies) => list({ request: get("/api/licenses", { cookies }), env });
const remove = (cookies) =>
  deleteAccount({
    request: write("DELETE", "/api/account", { body: { confirm: "delete" }, cookies }),
    env,
  });

describe("登録", () => {
  it("正しいキーを登録できる。応答にキーそのものは含まれない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    const response = await post(cookies, key);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.already, false);
    assert.equal(data.license.productId, "kii-michi");
    assert.equal(data.license.status, "active");
    assert.equal(data.license.hint, normalizeKey(key).slice(-4));
    assert.ok(data.license.redeemedAt > 0);
    assert.ok(!JSON.stringify(data).includes(normalizeKey(key)));
  });

  it("小文字・ハイフンなし・空白つきでも登録できる", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    const sloppy = ` ${key.toLowerCase().replaceAll("-", " ")} `;
    assert.equal((await post(cookies, sloppy)).status, 200);
  });

  it("同じ人が、同じキーをもう一度登録しても、成功(already: true)。増えない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    await post(cookies, key);
    const again = await post(cookies, key);
    assert.equal(again.status, 200);
    assert.equal((await again.json()).already, true);
    const listed = await (await mine(cookies)).json();
    assert.equal(listed.licenses.length, 1);
  });

  it("他の人が使用済みのキーは、断る。存在しないキーと、まったく同じ応答(探れない)", async () => {
    const aliceCookies = await loggedIn();
    const key = await issue();
    await post(aliceCookies, key);

    const bobCookies = await bob();
    const used = await post(bobCookies, key);
    const unknown = await post(bobCookies, UNKNOWN_KEY);
    assert.equal(used.status, 400);
    assert.equal(unknown.status, 400);
    assert.deepEqual(await used.json(), { error: "license-invalid" });
    assert.deepEqual(await unknown.json(), { error: "license-invalid" });
    // 使用済みのキーは、Bob の一覧にも入らない
    assert.deepEqual((await (await mine(bobCookies)).json()).licenses, []);
  });

  it("無効にされた未登録のキーは、登録できない", async () => {
    const cookies = await loggedIn();
    const fresh = await issue();
    await env.DB.prepare("UPDATE licenses SET revoked_at = 5").run();
    assert.equal((await post(cookies, fresh)).status, 400);
  });

  it("登録した後に無効にされると、一覧には残り、状態が revoked になる。再登録はできない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    await post(cookies, key);
    await env.DB.prepare("UPDATE licenses SET revoked_at = 5").run();
    const listed = await (await mine(cookies)).json();
    assert.equal(listed.licenses[0].status, "revoked");
    assert.equal((await post(cookies, key)).status, 400);
  });

  it("形が違うキーは、400 license-format(回数の制限があるので、2 人に分けて試す)", async () => {
    const attempts = [
      [await loggedIn(), ["", "abc", "NLTO-ABCDE", undefined, null]],
      [await bob(), [123, { a: 1 }, ["NLTO-ABCDE"]]],
    ];
    for (const [cookies, keys] of attempts) {
      for (const key of keys) {
        const response = await post(cookies, key);
        assert.equal(response.status, 400, String(key));
        assert.equal((await response.json()).error, "license-format");
      }
    }
  });

  it("同時に 2 人が、同じキーを登録しても、成功するのは 1 人だけ", async () => {
    const aliceCookies = await loggedIn();
    const bobCookies = await bob();
    const key = await issue();
    const results = await Promise.all([post(aliceCookies, key), post(bobCookies, key)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    const owners = await rows(env, "SELECT user_id FROM licenses");
    assert.equal(owners.length, 1);
    assert.ok(owners[0].user_id);
  });

  it("ハッシュだけを保存する。DB のどこにも、キーそのものはない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    await post(cookies, key);
    const dump = JSON.stringify([
      await rows(env, "SELECT * FROM licenses"),
      await rows(env, "SELECT * FROM audit_log"),
      await rows(env, "SELECT * FROM rate_limits"),
    ]);
    const canonical = normalizeKey(key);
    assert.ok(!dump.includes(canonical));
    assert.ok(!dump.includes(key));
    assert.ok(dump.includes(await hashKey(canonical)));
  });

  it("監査ログ: 成功は商品 ID、失敗は種類だけ。キーは入らない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    await post(cookies, UNKNOWN_KEY);
    await post(cookies, key);
    await post(cookies, key); // 2 回目(already)は、記録を増やさない
    const log = await rows(
      env,
      "SELECT event, detail FROM audit_log WHERE event LIKE 'license%' ORDER BY id",
    );
    assert.deepEqual(log, [
      { event: "license-redeem-failed", detail: "" },
      { event: "license-redeem", detail: "kii-michi" },
    ]);
  });
});

describe("守り", () => {
  it("ログインしていなければ 401(登録も一覧も)", async () => {
    const key = await issue();
    assert.equal((await post({}, key)).status, 401);
    assert.equal((await mine({})).status, 401);
    assert.equal((await rows(env, "SELECT user_id FROM licenses"))[0].user_id, null);
  });

  it("招待から外されたら、登録も一覧も 403", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    const removed = { ...env, ALLOWED_EMAILS: "" };
    const registered = await redeem({
      request: write("POST", "/api/licenses/redeem", { body: { key }, cookies }),
      env: removed,
    });
    assert.equal(registered.status, 403);
    assert.equal(
      (await list({ request: get("/api/licenses", { cookies }), env: removed })).status,
      403,
    );
  });

  it("CSRF: Origin が違う・独自ヘッダーがない・JSON でないと、登録できない", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    for (const [options, status] of [
      [{ headers: { Origin: "https://evil.test" } }, 403],
      [{ headers: { Origin: null } }, 403],
      [{ headers: { "X-NOLITO-CSRF": null } }, 403],
      [{ json: false, headers: { "Content-Type": "text/plain" } }, 415],
    ]) {
      assert.equal((await post(cookies, key, options)).status, status, JSON.stringify(options));
    }
    assert.equal((await rows(env, "SELECT user_id FROM licenses"))[0].user_id, null);
  });

  it("回数を制限する(5 回 / 10 分 / 1 人)。総当たりで、キーを探れない", async () => {
    const cookies = await loggedIn();
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await post(cookies, UNKNOWN_KEY)).status);
    assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429, 429]);
    // 制限中は、正しいキーでも、通らない
    const key = await issue();
    assert.equal((await post(cookies, key)).status, 429);
  });

  it("送信元(IP)ごとにも制限する(アカウントを増やしても、抜けられない)", async () => {
    const aliceCookies = await loggedIn();
    const bobCookies = await bob();
    const ip = { headers: { "CF-Connecting-IP": "203.0.113.7" } };
    let last;
    for (let i = 0; i < 21; i += 1) {
      last = await post(i % 2 === 0 ? aliceCookies : bobCookies, UNKNOWN_KEY, ip);
      if (i < 10) assert.equal(last.status, 400, `${i}`);
    }
    assert.equal(last.status, 429);
  });

  it("GET で、登録はできない(405)。許すメソッドを知らせる", () => {
    const response = redeemModule.onRequest();
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "POST");
    assert.equal(licensesModule.onRequest().headers.get("Allow"), "GET");
  });
});

describe("一覧", () => {
  it("自分のものだけを、新しく登録した順に返す。キーの全体・ハッシュ・メモは返さない", async () => {
    const aliceCookies = await loggedIn();
    const bobCookies = await bob();
    const first = await issue({ productId: "kii-michi", note: "内部メモ" });
    const second = await issue({ productId: "escape-boss" });
    const others = await issue();
    await post(aliceCookies, first);
    await env.DB.prepare("UPDATE licenses SET redeemed_at = redeemed_at - 100").run(); // 登録順を確定
    await post(aliceCookies, second);
    await post(bobCookies, others);

    const data = await (await mine(aliceCookies)).json();
    assert.deepEqual(
      data.licenses.map((l) => l.productId),
      ["escape-boss", "kii-michi"],
    );
    assert.deepEqual(Object.keys(data.licenses[0]).sort(), [
      "hint",
      "id",
      "productId",
      "redeemedAt",
      "status",
    ]);
    const text = JSON.stringify(data);
    for (const secret of [normalizeKey(first), normalizeKey(second), "内部メモ", "key_hash"]) {
      assert.ok(!text.includes(secret), secret);
    }
    assert.equal((await (await mine(bobCookies)).json()).licenses.length, 1);
  });

  it("応答は no-store", async () => {
    const cookies = await loggedIn();
    assert.equal((await mine(cookies)).headers.get("Cache-Control"), "no-store");
  });

  it("空のときは、空の配列", async () => {
    assert.deepEqual(await (await mine(await loggedIn())).json(), { licenses: [] });
  });
});

describe("アカウントの削除との関係", () => {
  it("削除すると、記録は残り、結びつきだけが外れる。同じキーを、また登録できる", async () => {
    const cookies = await loggedIn();
    const key = await issue();
    await post(cookies, key);
    assert.equal((await remove(cookies)).status, 200);

    const [license] = await rows(env, "SELECT user_id, redeemed_at, revoked_at FROM licenses");
    assert.deepEqual(license, { user_id: null, redeemed_at: null, revoked_at: null });

    // 入り直した(新しいアカウントの)自分が、同じキーを登録できる
    const again = await loggedIn();
    assert.equal((await post(again, key)).status, 200);
  });

  it("削除しても、ほかの人のライセンスは、そのまま", async () => {
    const aliceCookies = await loggedIn();
    const bobCookies = await bob();
    await post(aliceCookies, await issue());
    await post(bobCookies, await issue({ productId: "escape-boss" }));
    await remove(aliceCookies);
    const data = await (await mine(bobCookies)).json();
    assert.deepEqual(
      data.licenses.map((l) => l.productId),
      ["escape-boss"],
    );
  });

  it("削除した人を特定できる情報が、ライセンスに残らない", async () => {
    const cookies = await loggedIn();
    await post(cookies, await issue());
    const [before] = await rows(env, "SELECT user_id FROM licenses");
    assert.ok(before.user_id);
    await remove(cookies);
    const dump = JSON.stringify(await rows(env, "SELECT * FROM licenses"));
    assert.ok(!dump.includes(before.user_id));
  });
});
