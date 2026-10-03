// 記事の、公開API(GET /api/articles)・管理API(Issue #195 PR 1)のテスト。
// 管理API: /api/admin/articles(一覧・新規作成)・/api/admin/articles/:id(1件取得・更新・削除)。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  onRequestDelete as deleteArticle,
  onRequestGet as getArticle,
  onRequestPut as putArticle,
} from "../functions/api/admin/articles/[id].js";
import {
  onRequestGet as listArticles,
  onRequestPost as createArticle,
} from "../functions/api/admin/articles/index.js";
import { onRequestGet as getPublic, onRequest as anyPublic } from "../functions/api/articles.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { validateArticle } from "../scripts/lib/frontmatter.mjs";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const body = (response) => response.json();
const BASE = "/api/admin/articles";

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

const article = (over = {}) => ({
  slug: "sample-article",
  title: "サンプルの記事",
  description: "サンプルの記事の説明です。検索結果に出る、短い説明の文章になります。",
  date: "2026-10-01",
  tags: ["サンプル"],
  draft: false,
  body: "## 見出し\n\n本文の段落です。\n",
  ...over,
});

const create = async (cookies, value) =>
  createArticle({ request: write("POST", BASE, { body: { article: value }, cookies }), env });
const update = (cookies, slug, value) =>
  putArticle({
    request: write("PUT", `${BASE}/${slug}`, { body: { article: value }, cookies }),
    env,
    params: { id: slug },
  });
const one = (cookies, slug) =>
  getArticle({ request: get(`${BASE}/${slug}`, { cookies }), env, params: { id: slug } });
const listSlugs = async (cookies) =>
  (await body(await listArticles({ request: get(BASE, { cookies }), env }))).articles.map(
    (a) => a.slug,
  );
const publicList = async () =>
  body(
    await getPublic({
      env: { DB: env.DB },
      request: new Request("https://nolito.test/api/articles"),
    }),
  );

describe("GET /api/articles(公開)", () => {
  it("D1 から { articles } を組み立てる(最初は空)。キャッシュしてよい", async () => {
    const response = await getPublic({
      env: { DB: env.DB },
      request: new Request("https://nolito.test/api/articles"),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await body(response), { articles: [] });
    assert.match(response.headers.get("Cache-Control"), /public/);
  });

  it("公開の記事だけが、新しい順に出る。下書き・本文は出ない", async () => {
    const cookies = await adminCookies();
    await create(cookies, article({ slug: "old", date: "2026-09-01" }));
    await create(cookies, article({ slug: "new", date: "2026-10-01" }));
    await create(cookies, article({ slug: "secret", draft: true }));
    const data = await publicList();
    assert.deepEqual(
      data.articles.map((a) => a.slug),
      ["new", "old"],
    );
    assert.equal(data.articles[0].url, "/articles/new/");
    assert.equal(data.articles[0].body, undefined);
    assert.equal(data.articles[0].draft, undefined);
  });

  it("D1 がない環境では、ASSETS 経由で静的な内容にフォールバックする", async () => {
    const calls = [];
    const assets = {
      fetch: (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ articles: [] }));
      },
    };
    const response = await getPublic({
      env: { ASSETS: assets },
      request: new Request("https://nolito.test/api/articles"),
    });
    assert.equal(response.status, 200);
    assert.ok(calls[0].endsWith("/data/articles.json"), calls[0]);
  });

  it("D1 も ASSETS もなければ 503。メソッドが違えば 405", async () => {
    const request = new Request("https://nolito.test/api/articles");
    assert.equal((await getPublic({ env: {}, request })).status, 503);
    const post = new Request("https://nolito.test/api/articles", { method: "POST" });
    assert.equal((await anyPublic({ env: {}, request: post })).status, 405);
  });
});

describe("GET /api/admin/articles", () => {
  it("ログインしていなければ 401、管理者でなければ 403 not-admin", async () => {
    assert.equal((await listArticles({ request: get(BASE), env })).status, 401);
    const cookies = await memberCookies();
    const response = await listArticles({ request: get(BASE, { cookies }), env });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "not-admin");
  });

  it("管理者なら、下書きも含めて返す。本文は含めない", async () => {
    const cookies = await adminCookies();
    await create(cookies, article({ slug: "draft-one", draft: true }));
    const response = await listArticles({ request: get(BASE, { cookies }), env });
    const data = await body(response);
    assert.deepEqual(
      data.articles.map((a) => [a.slug, a.draft]),
      [["draft-one", true]],
    );
    assert.equal(data.articles[0].body, undefined);
  });
});

describe("POST /api/admin/articles", () => {
  it("管理者でなければ 403。別オリジンからは、CSRF で断る", async () => {
    assert.equal((await create(await memberCookies(), article())).status, 403);
    const cookies = await adminCookies();
    const response = await createArticle({
      request: write("POST", BASE, {
        body: { article: article() },
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("正しい内容なら作成でき、1件取得で本文も読める。監査ログには本文を入れず、文字数だけ残る", async () => {
    const cookies = await adminCookies();
    const response = await create(cookies, article());
    assert.equal(response.status, 201);
    assert.deepEqual(await listSlugs(cookies), ["sample-article"]);
    assert.equal((await body(await one(cookies, "sample-article"))).article.body, article().body);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'article' AND action = 'create'",
    ).first();
    assert.equal(audit.resource_id, "sample-article");
    assert.equal(audit.before_json, null);
    const after = JSON.parse(audit.after_json);
    assert.equal(after.bodyChars, article().body.length);
    assert.equal(after.body, undefined);
  });

  it("同じスラッグが既にあれば 409", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    const response = await create(cookies, article({ title: "別の題名" }));
    assert.equal(response.status, 409);
    assert.equal((await body(response)).error, "article-slug-exists");
  });

  it("形式が不正なら 400(details にエラーの一覧)。保存しない", async () => {
    const cookies = await adminCookies();
    for (const bad of [
      article({ slug: "Bad Slug" }),
      article({ title: "" }),
      article({ description: "短い" }),
      article({ date: "2026-13-40" }),
      article({ tags: ["a", "b", "c", "d", "e", "f"] }),
      article({ body: "" }),
      article({ body: "[x](javascript:alert(1))" }),
      article({ body: "# 見出し1は使えない" }),
      article({ body: "![](/assets/img/x.png)" }),
    ]) {
      const response = await create(cookies, bad);
      assert.equal(response.status, 400, JSON.stringify(bad));
      const data = await body(response);
      assert.equal(data.error, "invalid-article");
      assert.ok(data.details.length > 0);
    }
    assert.deepEqual(await listSlugs(cookies), []);
  });

  it("本文の生の HTML は、実行されず文字になる(エラーにはならない)", async () => {
    const cookies = await adminCookies();
    const response = await create(cookies, article({ body: "本文<script>alert(1)</script>\n" }));
    assert.equal(response.status, 201);
  });

  it("article がオブジェクトでなければ 400", async () => {
    const cookies = await adminCookies();
    assert.equal((await create(cookies, "not-an-object")).status, 400);
    assert.equal((await create(cookies, [article()])).status, 400);
  });

  it("更新日(updated)は、空でもよい。あるなら日付の形", async () => {
    const cookies = await adminCookies();
    assert.equal((await create(cookies, article({ slug: "a", updated: null }))).status, 201);
    assert.equal((await create(cookies, article({ slug: "b", updated: "" }))).status, 201);
    assert.equal(
      (await create(cookies, article({ slug: "c", updated: "2026-10-02" }))).status,
      201,
    );
    assert.equal((await create(cookies, article({ slug: "d", updated: "昨日" }))).status, 400);
  });
});

describe("GET/PUT /api/admin/articles/:id", () => {
  it("存在しないスラッグは 404", async () => {
    const cookies = await adminCookies();
    const none = await one(cookies, "nope");
    assert.equal(none.status, 404);
    assert.equal((await body(none)).error, "article-not-found");
  });

  it("管理者でなければ 403。存在しないスラッグは 404", async () => {
    assert.equal((await update(await memberCookies(), "sample-article", article())).status, 403);
    const cookies = await adminCookies();
    assert.equal((await update(cookies, "nope", article({ slug: "nope" }))).status, 404);
  });

  it("URL と本文のスラッグが違えば 400 article-slug-mismatch", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    const response = await update(cookies, "sample-article", article({ slug: "other" }));
    assert.equal(response.status, 400);
    assert.equal((await body(response)).error, "article-slug-mismatch");
  });

  it("更新でき、内容が置き換わる。監査ログに変更前後(本文は文字数)が残る", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    const response = await update(
      cookies,
      "sample-article",
      article({ title: "新しい題名", body: "新しい本文です。\n", draft: true }),
    );
    assert.equal(response.status, 200);
    const saved = (await body(await one(cookies, "sample-article"))).article;
    assert.equal(saved.title, "新しい題名");
    assert.equal(saved.body, "新しい本文です。\n");
    assert.equal(saved.draft, true);
    assert.deepEqual((await publicList()).articles, []);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'article' AND action = 'update'",
    ).first();
    assert.equal(JSON.parse(audit.before_json).title, "サンプルの記事");
    assert.equal(JSON.parse(audit.after_json).title, "新しい題名");
    assert.equal(JSON.parse(audit.after_json).bodyChars, "新しい本文です。\n".length);
  });

  it("形式が不正なら 400。保存しない", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    const response = await update(
      cookies,
      "sample-article",
      article({ body: "[x](javascript:1)" }),
    );
    assert.equal(response.status, 400);
    assert.equal((await body(await one(cookies, "sample-article"))).article.body, article().body);
  });
});

describe("DELETE /api/admin/articles/:id", () => {
  const remove = (cookies, slug) =>
    deleteArticle({
      request: write("DELETE", `${BASE}/${slug}`, { cookies }),
      env,
      params: { id: slug },
    });

  it("管理者でなければ 403。存在しないスラッグは 404", async () => {
    assert.equal((await remove(await memberCookies(), "sample-article")).status, 403);
    assert.equal((await remove(await adminCookies(), "nope")).status, 404);
  });

  it("ログインから10分を過ぎていたら、再ログインを求める(403 reauth-required)。削除しない", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 601").run();
    const response = await remove(cookies, "sample-article");
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "reauth-required");
    assert.deepEqual(await listSlugs(cookies), ["sample-article"]);
  });

  it("削除でき、一覧から消える。監査ログに残る", async () => {
    const cookies = await adminCookies();
    await create(cookies, article());
    assert.equal((await remove(cookies, "sample-article")).status, 200);
    assert.deepEqual(await listSlugs(cookies), []);

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'article' AND action = 'delete'",
    ).first();
    assert.equal(audit.resource_id, "sample-article");
    assert.equal(audit.after_json, null);
    assert.equal(JSON.parse(audit.before_json).slug, "sample-article");
  });
});

describe("検証の共有・エラーの文", () => {
  it("先頭情報の検証は、原稿のビルドと同じ関数(frontmatter.mjs が再エクスポート)", () => {
    const { slug, ...rest } = article();
    const front = { ...rest, body: undefined };
    delete front.body;
    assert.equal(validateArticle(front, slug).slug, slug);
    assert.throws(() => validateArticle({ ...front, title: "" }, slug));
  });

  it("新しいエラーの文がそろっている", async () => {
    const { API_ERRORS } = await import("../public/assets/js/account/messages.js");
    for (const code of [
      "invalid-article",
      "article-slug-exists",
      "article-not-found",
      "article-slug-mismatch",
      "articles-unavailable",
    ]) {
      assert.ok(API_ERRORS[code], code);
    }
  });
});
