// アフィリエイト・広告のリンクの、公開API(GET /api/affiliates)・管理API(Phase 29 PR 3)のテスト。
// 管理API: /api/admin/affiliates(一覧・新規作成)・/api/admin/affiliates/:id(1件取得・更新・削除)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  onRequestDelete as deleteLink,
  onRequestGet as getLink,
  onRequestPut as putLink,
} from "../functions/api/admin/affiliates/[id].js";
import {
  onRequestGet as listLinks,
  onRequestPost as createLink,
} from "../functions/api/admin/affiliates/index.js";
import { onRequestGet as getPublic, onRequest as anyPublic } from "../functions/api/affiliates.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const body = (response) => response.json();
const BASE = "/api/admin/affiliates";

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

async function adminCookies() {
  google.identity = { ...google.identity, email: "alice@example.com" };
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

async function memberCookies() {
  google.identity = { ...google.identity, email: "bob@example.com" };
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

const link = (over = {}) => ({
  id: "sample-link",
  kind: "affiliate",
  title: "サンプルのサービス",
  description: "説明の文です。",
  advertiser: "サンプル社",
  url: "https://example.com/item",
  placements: ["article"],
  ...over,
});

const create = async (cookies, value) =>
  createLink({ request: write("POST", BASE, { body: { link: value }, cookies }), env });
const update = (cookies, id, value) =>
  putLink({
    request: write("PUT", `${BASE}/${id}`, { body: { link: value }, cookies }),
    env,
    params: { id },
  });
const listIds = async (cookies) =>
  (await body(await listLinks({ request: get(BASE, { cookies }), env }))).links.map((l) => l.id);

describe("GET /api/affiliates(公開)", () => {
  it("D1 から { version, links } を組み立てる(最初は空)。キャッシュしてよい", async () => {
    const response = await getPublic({
      env: { DB: env.DB },
      request: new Request("https://nolito.test/api/affiliates"),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { version: 1, links: [] });
    assert.match(response.headers.get("Cache-Control"), /public/);
  });

  it("管理APIで作ったリンクが、公開の一覧に出る", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    const response = await getPublic({
      env: { DB: env.DB },
      request: new Request("https://nolito.test/api/affiliates"),
    });
    assert.deepEqual(
      (await body(response)).links.map((l) => l.id),
      ["sample-link"],
    );
  });

  it("D1 がない環境では、ASSETS 経由で静的な内容にフォールバックする", async () => {
    const calls = [];
    const assets = {
      fetch: (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ version: 1, links: [] }));
      },
    };
    const response = await getPublic({
      env: { ASSETS: assets },
      request: new Request("https://nolito.test/api/affiliates"),
    });
    assert.equal(response.status, 200);
    assert.ok(calls[0].endsWith("/data/affiliates.json"), calls[0]);
  });

  it("D1 も ASSETS もなければ 503。メソッドが違えば 405", async () => {
    const request = new Request("https://nolito.test/api/affiliates");
    assert.equal((await getPublic({ env: {}, request })).status, 503);
    const post = new Request("https://nolito.test/api/affiliates", { method: "POST" });
    assert.equal((await anyPublic({ env: {}, request: post })).status, 405);
  });
});

describe("GET /api/admin/affiliates", () => {
  it("ログインしていなければ 401、管理者でなければ 403 not-admin", async () => {
    assert.equal((await listLinks({ request: get(BASE), env })).status, 401);
    const cookies = await memberCookies();
    const response = await listLinks({ request: get(BASE, { cookies }), env });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "not-admin");
  });

  it("管理者なら、一覧を返す(最初は空)", async () => {
    const cookies = await adminCookies();
    assert.deepEqual(await listIds(cookies), []);
  });
});

describe("POST /api/admin/affiliates", () => {
  it("管理者でなければ 403。別オリジンからは、CSRF で断る", async () => {
    const member = await memberCookies();
    assert.equal((await create(member, link())).status, 403);
    const cookies = await adminCookies();
    const response = await createLink({
      request: write("POST", BASE, {
        body: { link: link() },
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("正しい内容なら作成でき、一覧に増える。監査ログにも残る", async () => {
    const cookies = await adminCookies();
    const response = await create(cookies, link());
    assert.equal(response.status, 201);
    assert.equal((await body(response)).link.id, "sample-link");
    assert.deepEqual(await listIds(cookies), ["sample-link"]);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'affiliate' AND action = 'create'",
    ).first();
    assert.equal(audit.resource_id, "sample-link");
    assert.equal(audit.before_json, null);
    assert.equal(JSON.parse(audit.after_json).id, "sample-link");
  });

  it("同じ id が既にあれば 409", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    const response = await create(cookies, link({ title: "別の題名" }));
    assert.equal(response.status, 409);
    assert.equal((await body(response)).error, "affiliate-id-exists");
  });

  it("形式が不正なら 400(details にエラーの一覧)。保存しない", async () => {
    const cookies = await adminCookies();
    for (const bad of [
      link({ url: "http://example.com/" }),
      link({ kind: "sponsor" }),
      link({ placements: ["play"] }),
      link({ title: "<b>x</b>" }),
    ]) {
      const response = await create(cookies, bad);
      assert.equal(response.status, 400);
      const data = await body(response);
      assert.equal(data.error, "invalid-affiliate");
      assert.ok(data.details.length > 0);
    }
    assert.deepEqual(await listIds(cookies), []);
  });

  it("link がオブジェクトでなければ 400", async () => {
    const cookies = await adminCookies();
    assert.equal((await create(cookies, "not-an-object")).status, 400);
    assert.equal((await create(cookies, [link()])).status, 400);
  });
});

describe("GET/PUT /api/admin/affiliates/:id", () => {
  it("存在しない id は 404。存在すれば、1件を返す", async () => {
    const cookies = await adminCookies();
    const none = await getLink({
      request: get(`${BASE}/nope`, { cookies }),
      env,
      params: { id: "nope" },
    });
    assert.equal(none.status, 404);
    assert.equal((await body(none)).error, "affiliate-not-found");

    await create(cookies, link());
    const one = await getLink({
      request: get(`${BASE}/sample-link`, { cookies }),
      env,
      params: { id: "sample-link" },
    });
    assert.equal((await body(one)).link.title, "サンプルのサービス");
  });

  it("管理者でなければ 403。存在しない id は 404", async () => {
    const member = await memberCookies();
    assert.equal((await update(member, "sample-link", link())).status, 403);
    const cookies = await adminCookies();
    assert.equal((await update(cookies, "nope", link({ id: "nope" }))).status, 404);
  });

  it("URL と本文の id が違えば 400 affiliate-id-mismatch", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    const response = await update(cookies, "sample-link", link({ id: "other" }));
    assert.equal(response.status, 400);
    assert.equal((await body(response)).error, "affiliate-id-mismatch");
  });

  it("更新でき、内容が置き換わる。監査ログに変更前後が残る。並びは変わらない", async () => {
    const cookies = await adminCookies();
    await create(cookies, link({ id: "first" }));
    await create(cookies, link({ id: "second" }));
    const response = await update(cookies, "first", link({ id: "first", title: "新しい題名" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await listIds(cookies), ["first", "second"]);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'affiliate' AND action = 'update'",
    ).first();
    assert.equal(JSON.parse(audit.before_json).title, "サンプルのサービス");
    assert.equal(JSON.parse(audit.after_json).title, "新しい題名");
  });

  it("形式が不正なら 400。保存しない", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    const response = await update(cookies, "sample-link", link({ url: "javascript:alert(1)" }));
    assert.equal(response.status, 400);
    const one = await getLink({
      request: get(`${BASE}/sample-link`, { cookies }),
      env,
      params: { id: "sample-link" },
    });
    assert.equal((await body(one)).link.url, "https://example.com/item");
  });
});

describe("DELETE /api/admin/affiliates/:id", () => {
  const remove = (cookies, id) =>
    deleteLink({ request: write("DELETE", `${BASE}/${id}`, { cookies }), env, params: { id } });

  it("管理者でなければ 403。存在しない id は 404", async () => {
    assert.equal((await remove(await memberCookies(), "sample-link")).status, 403);
    assert.equal((await remove(await adminCookies(), "nope")).status, 404);
  });

  it("ログインから10分を過ぎていたら、再ログインを求める(403 reauth-required)。削除しない", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 601").run();
    const response = await remove(cookies, "sample-link");
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "reauth-required");
    assert.deepEqual(await listIds(cookies), ["sample-link"]);
  });

  it("削除でき、一覧から消える。監査ログに残る", async () => {
    const cookies = await adminCookies();
    await create(cookies, link());
    assert.equal((await remove(cookies, "sample-link")).status, 200);
    assert.deepEqual(await listIds(cookies), []);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'affiliate' AND action = 'delete'",
    ).first();
    assert.equal(audit.resource_id, "sample-link");
    assert.equal(audit.after_json, null);
    assert.equal(JSON.parse(audit.before_json).id, "sample-link");
  });
});

describe("管理画面のページ・つなぎ込み", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  it("ページは noindex で、専用のスクリプトを読み込み、JS が探す目印が HTML にある", () => {
    const html = read("public/account/admin/affiliates/index.html");
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /\/assets\/js\/admin\/affiliates-page\.js/);
    const js = read("public/assets/js/admin/affiliates-page.js");
    for (const [, mark] of js.matchAll(/"\[(data-[a-z-]+)\]"/g)) {
      assert.ok(html.includes(mark), `HTML に ${mark} がありません`);
    }
    for (const [, id] of js.matchAll(/"#([a-z-]+)"/g)) {
      assert.ok(html.includes(`id="${id}"`), `HTML に #${id} がありません`);
    }
  });

  it("/account/ に、管理者だけに見えるリンクがある", () => {
    const html = read("public/account/index.html");
    assert.match(html, /data-admin-link[\s\S]*?\/account\/admin\//);
    assert.ok(read("public/account/admin/index.html").includes("/account/admin/affiliates/"));
  });

  it("公開の描画は /api/affiliates を読む。新しいエラーの文がそろっている", async () => {
    assert.match(read("public/assets/js/components/affiliate-list.js"), /"\/api\/affiliates"/);
    const { API_ERRORS } = await import("../public/assets/js/account/messages.js");
    for (const code of [
      "invalid-affiliate",
      "affiliate-id-exists",
      "affiliate-not-found",
      "affiliate-id-mismatch",
    ]) {
      assert.ok(API_ERRORS[code], code);
    }
  });
});
